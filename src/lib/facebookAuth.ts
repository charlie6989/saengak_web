import { supabase, isSupabaseConfigured } from './supabase';
import { captureExceptionSafe } from './sentry';

export const FACEBOOK_APP_ID =
  import.meta.env.VITE_FACEBOOK_APP_ID || '2493428007846346';

export const isFacebookAuthConfigured = Boolean(FACEBOOK_APP_ID);

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
  } catch (err) {
    console.warn('同步 Facebook 個人資料至 profiles 失敗:', err);
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
      error: new Error('會員系統尚未綁定雲端資料庫，現階段暫無法登入'),
    };
  }

  // 1. 若環境尚未配置 Facebook App ID，先行攔截避免觸發後端 400 錯誤跳轉
  if (!FACEBOOK_APP_ID) {
    const message =
      'Facebook 登入功能尚未啟用：系統尚未配置 Meta Facebook App ID。請在 Meta for Developers 建立應用程式並將 App ID 填入環境設定中。';
    return { error: new Error(message) };
  }

  // 2. 嘗試使用 Facebook JavaScript SDK 彈窗登入
  try {
    await loadFacebookSDK();

    if (window.FB) {
      return new Promise((resolve) => {
        window.FB!.login(
          async (response) => {
            if (response.status === 'connected' && response.authResponse) {
              try {
                const token = response.authResponse.accessToken;
                const { data, error } = await supabase.auth.signInWithIdToken({
                  provider: 'facebook',
                  token,
                });

                if (error) {
                  // 若 signInWithIdToken 不支援則退回標準 OAuth
                  throw error;
                }

                if (data.user) {
                  await syncFacebookProfile(data.user);
                }

                resolve({ user: data.user, session: data.session, error: null });
              } catch (tokenErr: any) {
                console.warn('Facebook IdToken 登入失敗，嘗試標準 OAuth:', tokenErr);
                // 轉為標準 OAuth 跳轉
                fallbackOAuth(options?.redirectTo).then(resolve);
              }
            } else {
              resolve({
                error: new Error('已取消 Facebook 登入授權'),
              });
            }
          },
          { scope: 'public_profile,email' }
        );
      });
    }
  } catch (sdkErr) {
    console.warn('載入 Facebook SDK 失敗，退回標準 OAuth:', sdkErr);
  }

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
