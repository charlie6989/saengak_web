/**
 * SAENGAK Sentry 資安脫敏與安全錯誤捕獲模組
 * 嚴格遵循 PCI-DSS 與個資保護法規，確保前端錯誤回報與 Breadcrumb 絕不洩漏敏感機密與未脫敏個資。
 */

export const DENIED_KEYS = [
  'prime',
  'card_number',
  'card_key',
  'cvv',
  'cvc',
  'expiry',
  'password',
  'secret',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
] as const;

export const PII_KEYS = [
  'name',
  'receiver_name',
  'phone',
  'receiver_phone',
  'email',
  'address',
  'receiver_address',
] as const;

export const REDACTED_SENSITIVE = '[REDACTED_SENSITIVE]';
export const REDACTED_PII = '[REDACTED_PII]';
export const REDACTED_CIRCULAR = '[CIRCULAR]';

/**
 * 判斷欄位名稱是否屬於完全拒絕收集的機密鍵值 (如卡號、CVV、密碼、Token)
 */
export function isDeniedKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const normalized = key.toLowerCase().replace(/[-_]/g, '');
  return DENIED_KEYS.some((denied) => {
    const normDenied = denied.toLowerCase().replace(/[-_]/g, '');
    return normalized === normDenied || normalized.includes(normDenied);
  });
}

/**
 * 判斷欄位名稱是否屬於個資識別鍵值 (如姓名、電話、Email、地址)
 */
export function isPiiKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  const normalized = key.toLowerCase().replace(/[-_]/g, '');
  return PII_KEYS.some((pii) => {
    const normPii = pii.toLowerCase().replace(/[-_]/g, '');
    return normalized === normPii;
  });
}

/**
 * 姓名脫敏 (如: 王明 -> 王*, 王小明 -> 王*明, 歐陽小明 -> 歐**明)
 */
export function maskName(name: string): string {
  if (typeof name !== 'string' || !name.trim()) return REDACTED_PII;
  const trimmed = name.trim();
  const len = trimmed.length;

  if (len <= 1) return '*';
  if (len === 2) return `${trimmed[0]}*`;
  if (len === 3) return `${trimmed[0]}*${trimmed[2]}`;

  // 4 字元以上：保留首尾，中間以星號遮蔽
  const middleStars = '*'.repeat(len - 2);
  return `${trimmed[0]}${middleStars}${trimmed[len - 1]}`;
}

/**
 * 手機/電話脫敏 (如: 0912345678 -> 0912***678)
 */
export function maskPhone(phone: string): string {
  if (typeof phone !== 'string' || !phone.trim()) return REDACTED_PII;
  const cleaned = phone.replace(/[^0-9+]/g, '');

  // 台灣 10 碼手機號碼 (09xxxxxxxx)
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 4)}***${cleaned.slice(7)}`;
  }

  // 其他長度電話 (大於等於 7 碼)
  if (cleaned.length >= 7) {
    const headLen = Math.min(3, Math.floor(cleaned.length / 3));
    const tailLen = Math.min(3, Math.floor(cleaned.length / 3));
    const starLen = Math.max(3, cleaned.length - headLen - tailLen);
    return `${cleaned.slice(0, headLen)}${'*'.repeat(starLen)}${cleaned.slice(cleaned.length - tailLen)}`;
  }

  return REDACTED_PII;
}

/**
 * Email 脫敏 (如: alice@example.com -> a***@example.com)
 */
export function maskEmail(email: string): string {
  if (typeof email !== 'string' || !email.includes('@')) return REDACTED_PII;
  const parts = email.split('@');
  if (parts.length !== 2) return REDACTED_PII;

  const [username, domain] = parts;
  if (!username || !domain) return REDACTED_PII;

  const firstChar = username[0];
  return `${firstChar}***@${domain}`;
}

/**
 * 地址脫敏 (保留前 6 字縣市行政區，其餘遮蔽)
 */
export function maskAddress(address: string): string {
  if (typeof address !== 'string' || !address.trim()) return REDACTED_PII;
  const trimmed = address.trim();
  if (trimmed.length > 6) {
    return `${trimmed.slice(0, 6)}***`;
  }
  return REDACTED_PII;
}

/**
 * 依據 PII key 名稱進行對應脫敏處理
 */
export function maskPiiValue(key: string, value: any): any {
  if (typeof value !== 'string') {
    return REDACTED_PII;
  }

  const normKey = key.toLowerCase();
  if (normKey.includes('email')) {
    return maskEmail(value);
  }
  if (normKey.includes('phone') || normKey.includes('tel')) {
    return maskPhone(value);
  }
  if (normKey.includes('name')) {
    return maskName(value);
  }
  if (normKey.includes('address')) {
    return maskAddress(value);
  }

  return REDACTED_PII;
}

// 敏感正規表達式 (卡號、JWT、Bearer Token、Prime)
const CREDIT_CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{1,7}\b/g;
const JWT_REGEX = /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)?\b/g;
const BEARER_REGEX = /Bearer\s+[a-zA-Z0-9_\-\.]{15,}/gi;
const PRIME_REGEX = /prime_[a-zA-Z0-9_]{15,}/gi;

/**
 * 對單一字串內容進行正則掃描與深層脫敏
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return str;

  let result = str;
  result = result.replace(CREDIT_CARD_REGEX, REDACTED_SENSITIVE);
  result = result.replace(JWT_REGEX, REDACTED_SENSITIVE);
  result = result.replace(BEARER_REGEX, 'Bearer ' + REDACTED_SENSITIVE);
  result = result.replace(PRIME_REGEX, REDACTED_SENSITIVE);

  return result;
}

/**
 * 深度遞迴物件與陣列過濾函式
 * 支援循環引用防護、Error 物件處理與深層 PII/敏感鍵值過濾
 */
export function sanitizeObject(obj: any, seen = new WeakSet<object>()): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  // 處理循環引用
  if (seen.has(obj)) {
    return REDACTED_CIRCULAR;
  }
  seen.add(obj);

  // 處理 Error 物件
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: sanitizeString(obj.message),
      stack: obj.stack ? sanitizeString(obj.stack) : undefined,
    };
  }

  // 處理陣列
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, seen));
  }

  // 處理普通物件
  const sanitized: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isDeniedKey(key)) {
      sanitized[key] = REDACTED_SENSITIVE;
    } else if (isPiiKey(key)) {
      sanitized[key] = maskPiiValue(key, value);
    } else {
      sanitized[key] = sanitizeObject(value, seen);
    }
  }

  return sanitized;
}

/**
 * Sentry beforeBreadcrumb 鉤子函式
 * 深度過濾每個 Breadcrumb 中的 data 與 message
 */
export function sanitizeBreadcrumb(breadcrumb: any): any {
  if (!breadcrumb || typeof breadcrumb !== 'object') {
    return breadcrumb;
  }

  return sanitizeObject(breadcrumb);
}

/**
 * Sentry beforeSend 鉤子函式
 * 深度過濾 Event Payload
 */
export function sanitizeEvent(event: any): any {
  if (!event || typeof event !== 'object') {
    return event;
  }

  return sanitizeObject(event);
}

/**
 * 產生 6 碼隨機短碼 Event ID (如: #a8f92d)
 */
export function generateShortEventId(): string {
  const hex = Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0');
  return `#${hex}`;
}

/**
 * 安全捕獲例外函式
 * 脫敏 context 後記錄並嘗試發送至 Sentry，回傳短碼 Event ID 供前端與客服對帳定位
 */
export function captureExceptionSafe(error: any, context?: any): string {
  const eventId = generateShortEventId();
  const safeContext = context ? sanitizeObject(context) : undefined;
  const safeError = error instanceof Error ? sanitizeObject(error) : error;

  // 若全域環境已掛載 Sentry，安全呼叫 Sentry captureException
  try {
    const globalSentry = (typeof window !== 'undefined' && (window as any).Sentry) ? (window as any).Sentry : null;
    if (globalSentry && typeof globalSentry.captureException === 'function') {
      globalSentry.captureException(error, {
        extra: safeContext,
        tags: { safeEventId: eventId },
      });
    }
  } catch (sentryErr) {
    console.warn('[Sentry] captureException 執行失敗，降級為安全本機紀錄', sentryErr);
  }

  // 安全記錄於開發環境 console
  if (process.env.NODE_ENV !== 'production' || typeof window === 'undefined') {
    console.error(`[SAENGAK Safe Exception Track] ${eventId}:`, safeError, safeContext);
  }

  return eventId;
}
