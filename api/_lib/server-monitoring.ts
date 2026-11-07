import { randomUUID } from 'node:crypto';

/**
 * 伺服器端失敗回報：把 webhook／發票失敗送到既有的 Sentry 專案，並寫一行 Vercel log。
 *
 * 只送「穩定代碼」，不送 payload、資料庫錯誤訊息或任何 Error 內容：這些可能夾帶姓名、電話、Email、地址或統編。
 * 標籤限定為下列鍵值，且值必須符合 SAFE_VALUE（不含空白與 @），其他內容一律丟棄。
 * 使用 envelope API 直接送出，不增加 Vercel Function 的相依與冷啟動成本。
 */

const SAFE_VALUE = /^[A-Za-z0-9_./:-]{1,100}$/;
const SEND_TIMEOUT_MS = 1500;
const CLIENT_NAME = 'lucissi-care-server/1.0';

export type FailureArea = 'shopify_webhook' | 'invoice' | 'cod_collection';
export type FailureLevel = 'error' | 'warning';

export interface ServerFailure {
  area: FailureArea;
  /** 穩定的失敗代碼，例如 ORDER_SYNC_FAILED。Sentry 依 area + failure 分組。 */
  failure: string;
  level?: FailureLevel;
  tags?: {
    topic?: string;
    error_code?: string;
    webhook_id?: string;
    job_id?: string;
    outcome?: string;
  };
}

interface ParsedDsn {
  publicKey: string;
  envelopeUrl: string;
}

export function parseSentryDsn(dsn: string | undefined): ParsedDsn | null {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.split('/').filter(Boolean).pop();
    if (url.protocol !== 'https:' || !url.username || !projectId) return null;
    return { publicKey: url.username, envelopeUrl: `https://${url.host}/api/${projectId}/envelope/` };
  } catch {
    return null;
  }
}

/** 只取錯誤物件上的代碼（如 Postgres 23505），絕不讀 message／details，避免夾帶個資。 */
export function safeErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && SAFE_VALUE.test(code) ? code : undefined;
}

function safeTags(failure: ServerFailure): Record<string, string> {
  const tags: Record<string, string> = { area: failure.area };
  for (const [key, value] of Object.entries(failure.tags ?? {})) {
    if (typeof value === 'string' && SAFE_VALUE.test(value)) tags[key] = value;
  }
  return tags;
}

function buildEnvelope(failure: ServerFailure, code: string, tags: Record<string, string>, dsn: string): string {
  const eventId = randomUUID().replace(/-/g, '');
  const sentAt = new Date().toISOString();
  const event = {
    event_id: eventId,
    timestamp: sentAt,
    platform: 'node',
    level: failure.level ?? 'error',
    logger: 'server-monitoring',
    environment: process.env.VERCEL_ENV || 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA || undefined,
    message: { formatted: `${failure.area}: ${code}` },
    fingerprint: [failure.area, code],
    tags,
  };
  return [
    JSON.stringify({ event_id: eventId, sent_at: sentAt, dsn }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');
}

/**
 * 回報失敗。絕不 throw、最多等待 SEND_TIMEOUT_MS，不影響原本的回應與重試語意。
 * 未設定 DSN 時只寫 log。
 */
export async function reportServerFailure(failure: ServerFailure): Promise<void> {
  const code = SAFE_VALUE.test(failure.failure) ? failure.failure : 'UNKNOWN_FAILURE';
  const tags = safeTags(failure);
  const log = failure.level === 'warning' ? console.warn : console.error;
  log('[server-failure]', JSON.stringify({ failure: code, ...tags }));

  const dsn = process.env.SENTRY_DSN || process.env.VITE_PUBLIC_SENTRY_DSN;
  const parsed = parseSentryDsn(dsn);
  if (!parsed) return;

  try {
    await fetch(parsed.envelopeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=${CLIENT_NAME}, sentry_key=${parsed.publicKey}`,
      },
      body: buildEnvelope(failure, code, tags, dsn!),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
  } catch {
    // 監控失敗不可影響訂單與發票流程；上面的 log 已保留紀錄
  }
}
