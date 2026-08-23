import { Turnstile } from '@marsidev/react-turnstile';

const configuredSiteKey = import.meta.env.VITE_PUBLIC_TURNSTILE_SITE_KEY?.trim();

export const isAuthCaptchaEnabled = Boolean(configuredSiteKey);

export function isAuthCaptchaReady(
  token: string,
  enabled = isAuthCaptchaEnabled,
): boolean {
  return !enabled || Boolean(token);
}

export function captchaTokenOptions(token: string): { captchaToken?: string } {
  return token ? { captchaToken: token } : {};
}

interface AuthCaptchaProps {
  onTokenChange: (token: string) => void;
  resetKey: number;
}

export default function AuthCaptcha({ onTokenChange, resetKey }: AuthCaptchaProps) {
  if (!configuredSiteKey) return null;

  return (
    <div className="space-y-2">
      <Turnstile
        key={resetKey}
        siteKey={configuredSiteKey}
        onSuccess={onTokenChange}
        onExpire={() => onTokenChange('')}
        onError={() => onTokenChange('')}
      />
      <p className="text-xs text-gray-500">請完成安全驗證後繼續。</p>
    </div>
  );
}
