import { randomBytes } from 'node:crypto';

/**
 * LUCISSI 會員首單免運的代碼與折扣名稱規則。
 * 每位會員各自一個 Shopify 折扣，名稱固定以 PERK_TITLE_PREFIX 開頭、代碼符合 PERK_CODE_PATTERN；
 * 公開優惠列表與一般領券流程以這兩個規則排除，不依賴任何環境變數（fail closed）。
 */

export const PERK_TITLE_PREFIX = 'LUCISSI 會員首單免運';
export const PERK_CODE_PATTERN = /^LC[A-HJ-NP-Z2-9]{10}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePerkCode(bytes: Buffer = randomBytes(10)): string {
  let code = 'LC';
  for (const byte of bytes) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  return code;
}

export function isMemberPerkCode(code: string | undefined | null): boolean {
  return PERK_CODE_PATTERN.test((code || '').trim().toUpperCase());
}

export function isMemberPerkTitle(title: string | undefined | null): boolean {
  return (title || '').trim().startsWith(PERK_TITLE_PREFIX);
}
