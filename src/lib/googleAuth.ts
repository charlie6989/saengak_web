import { supabase, isSupabaseConfigured } from './supabase';
import { captureExceptionSafe } from './sentry';

export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '1070435250760-tegmugca3bvmn1k5l8i437ctndajq844.apps.googleusercontent.com';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string; select_by?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
            context?: string;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
              locale?: string;
            }
          ) => void;
          prompt: (notification?: (notification: any) => void) => void;
          cancel: () => void;
        };
      };
    };
  }
}

let gsiScriptPromise: Promise<void> | null = null;

/**
 * 動態載入 Google Identity Services 腳本
 */
export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (gsiScriptPromise) {
    return gsiScriptPromise;
  }

  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    // 檢查頁面上是否已有載入中的標籤
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', (e) => reject(e));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiScriptPromise = null;
      reject(new Error('無法載入 Google 官方登入服務腳本'));
    };

    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

/**
 * 登入成功後自動同步 Google 姓名與頭像至 public.profiles
 */
async function syncGoogleProfile(user: any) {
  if (!user || !user.id) return;

  try {
    const meta = user.user_metadata || {};
    const name = meta.full_name || meta.name || '';
    const avatar = meta.avatar_url || meta.picture || '';

    // 檢查 profiles 表是否已有該使用者
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, name, avatar')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      // 若尚未建立，則新增 profile
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email || '',
        name: name,
        avatar: avatar,
      });
    } else {
      // 若姓名或頭像為空，則補填 Google 資料
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
    console.warn('同步 Google 個人資料至 profiles 略過或失敗:', err);
  }
}

/**
 * 透過 Google 憑證 (ID Token) 向 Supabase 換取 Session
 */
export async function handleGoogleCredential(credential: string): Promise<{
  session: any;
  user: any;
  error: Error | null;
}> {
  if (!isSupabaseConfigured) {
    return {
      session: null,
      user: null,
      error: new Error('會員系統尚未綁定資料庫，現階段暫無法登入'),
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: credential,
    });

    if (error) {
      captureExceptionSafe(error, { source: 'googleAuth.signInWithIdToken' });
      return { session: null, user: null, error };
    }

    if (data.user) {
      await syncGoogleProfile(data.user);
    }

    return { session: data.session, user: data.user, error: null };
  } catch (err: any) {
    captureExceptionSafe(err, { source: 'googleAuth.handleCredential.catch' });
    return { session: null, user: null, error: err };
  }
}

/**
 * 渲染 Google 官方登入按鈕於指定 DOM 容器
 */
export async function renderGoogleButton(
  container: HTMLElement,
  options: {
    theme?: 'outline' | 'filled_blue' | 'filled_black';
    size?: 'large' | 'medium' | 'small';
    text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
    shape?: 'rectangular' | 'pill' | 'circle' | 'square';
    width?: number | string;
    onSuccess: (result: { session: any; user: any }) => void;
    onError: (error: Error) => void;
  }
): Promise<() => void> {
  await loadGoogleIdentityScript();

  if (!window.google?.accounts?.id) {
    throw new Error('Google Identity Services SDK 未就緒');
  }

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: async (response) => {
      if (response.credential) {
        const { session, user, error } = await handleGoogleCredential(response.credential);
        if (error) {
          options.onError(error);
        } else if (session && user) {
          options.onSuccess({ session, user });
        }
      } else {
        options.onError(new Error('未取得 Google 登入憑證'));
      }
    },
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: options.theme || 'outline',
    size: options.size || 'large',
    text: options.text || 'continue_with',
    shape: options.shape || 'rectangular',
    logo_alignment: 'left',
    width: options.width || 360,
    locale: 'zh-TW',
  });

  return () => {
    try {
      window.google?.accounts?.id.cancel();
    } catch {
      // 忽略清理錯誤
    }
  };
}
