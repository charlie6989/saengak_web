import { supabase, isSupabaseConfigured } from './supabase';
import { captureExceptionSafe } from './sentry';

export const FACEBOOK_APP_ID =
  import.meta.env.VITE_FACEBOOK_APP_ID || '2493428007846346';

export const isFacebookAuthConfigured = Boolean(FACEBOOK_APP_ID);

// 2026-11-08 查核：Meta App 2493428007846346 仍在開發模式，非管理員打開授權頁會看到「App not active」，
// 一般顧客無法用 Facebook 登入。App 切成正式模式（Live）後，在 Vercel 設定 VITE_FACEBOOK_LOGIN_ENABLED=true 再重新部署即可顯示。
// Meta App Review 期間：只有網址帶 `?fblogin=1` 的頁面顯示 Facebook 按鈕，供審核員測試；一般顧客看不到。
export const FACEBOOK_REVIEW_QUERY_PARAM = 'fblogin';

export function isFacebookLoginEnabled(search?: string): boolean {
  if (import.meta.env.VITE_FACEBOOK_LOGIN_ENABLED === 'true') return true;
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  return new URLSearchParams(query).get(FACEBOOK_REVIEW_QUERY_PARAM) === '1';
}

declare global {
  interface Window {
    FB?: {
      init: (options: {
        appId: string;
        cookie?: boolean;
        xfbml?: boolean;
        version: string;
      }) => void;
      login: (
        callback: (response: {
          authResponse?: {
            accessToken: string;
            userID: string;
            expiresIn: number;
            signedRequest: string;
          };
          status: 'connected' | 'not_authorized' | 'unknown';
        }) => void,
        options?: { scope: string; return_scopes?: boolean }
      ) => void;
      getLoginStatus: (
        callback: (response: {
          authResponse?: {
            accessToken: string;
            userID: string;
          };
          status: string;
        }) => void
      ) => void;
      api: (
        path: string,
        params: Record<string, any>,
        callback: (response: any) => void
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

let fbScriptPromise: Promise<void> | null = null;

/**
 * 動態載入 Facebook 官方 JavaScript SDK 腳本
 */
export function loadFacebookSDK(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  if (window.FB) {
    return Promise.resolve();
  }

  if (fbScriptPromise) {
    return fbScriptPromise;
  }

  fbScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src*="connect.facebook.net"]'
    );

    if (existingScript) {
      if (window.FB) {
        resolve();
      } else {
        existingScript.addEventListener('load', () => resolve());
        existingScript.addEventListener('error', (e) => reject(e));
      }
      return;
    }

    window.fbAsyncInit = function () {
      if (FACEBOOK_APP_ID && window.FB) {
        window.FB.init({
          appId: FACEBOOK_APP_ID,
          cookie: true,
          xfbml: true,
          version: 'v20.0',
        });
      }
      resolve();
    };

    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/zh_TW/sdk.js';
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      fbScriptPromise = null;
      reject(new Error('無法載入 Facebook 官方登入服務 SDK'));
    };

    document.head.appendChild(script);
  });

  return fbScriptPromise;
}

/**
 * 登入成功後自動同步 Facebook 姓名與頭像至 public.profiles
 */
async function syncFacebookProfile(user: any, fbData?: { name?: string; picture?: string }) {
  if (!user || !user.id) return;

  try {
    const meta = user.user_metadata || {};
    const name = fbData?.name || meta.full_name || meta.name || '';
    const avatar = fbData?.picture || meta.avatar_url || meta.picture || '';

    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, name, avatar')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email || '',
        name: name,
        avatar: avatar,
      });
    } else {
      const updates: Record<string, any> = {};
      if (!existingProfile.name && name) updates.name = name;
      if (!existingProfile.avatar && avatar) updates.avatar = avatar;

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);
      }
    }

    // 2. 自動同步至 user_social_accounts 獨立社群身分關聯表
    const fbId = user.identities?.find((i: any) => i.provider === 'facebook')?.id || user.id;
    await supabase.from('user_social_accounts').upsert(
      {
        user_id: user.id,
        provider: 'facebook',
        provider_user_id: String(fbId),
        provider_email: user.email || '',
        provider_name: name,
        avatar_url: avatar,
        last_sign_in_at: new Date().toISOString(),
      },
      { onConflict: 'provider,provider_user_id' }
    );
  } catch (err) {
    console.warn('同步 Facebook 個人資料至 profiles / user_social_accounts 失敗:', err);
  }
}

/**
 * 透過自建 Facebook 模組執行登入
 */
export async function triggerFacebookLogin(options?: {
  redirectTo?: string;
}): Promise<{
  user?: any;
  session?: any;
  error?: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return {
      error: new Error('會員系統正在連線，現階段暫無法登入'),
    };
  }

  // 1. 若環境尚未配置 Facebook App ID，先行攔截避免觸發後端 400 錯誤跳轉
  if (!FACEBOOK_APP_ID) {
    const message =
      '此登入方式暫時無法使用，請稍後再試或改用 Email 登入。';
    return { error: new Error(message) };
  }

  // 一律走 Supabase 標準 OAuth 轉址（與 LUCISSI 相同）。原本的 Facebook JS SDK 彈窗會被網站 CSP 擋下，
  // 且 Supabase 不支援以 Facebook access token 呼叫 signInWithIdToken，最後都會退回這條路徑。
  return fallbackOAuth(options?.redirectTo);
}

/**
 * 備用方案：透過 Supabase OAuth 重定向進行 Facebook 登入
 */
async function fallbackOAuth(redirectTo?: string): Promise<{
  user?: any;
  session?: any;
  error?: Error | null;
}> {
  try {
    const targetRedirect = redirectTo || `${window.location.origin}/auth/confirm`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: {
        redirectTo: targetRedirect,
        scopes: 'email,public_profile',
      },
    });

    if (error) {
      captureExceptionSafe(error, { source: 'facebookAuth.signInWithOAuth' });
      return { error };
    }

    return { error: null };
  } catch (err: any) {
    captureExceptionSafe(err, { source: 'facebookAuth.fallbackOAuth.catch' });
    return { error: err };
  }
}
