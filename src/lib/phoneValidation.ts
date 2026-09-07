/**
 * 台灣手機號碼嚴格格式驗證與正規化模組
 * 遵循標準：09 開頭，接續 8 碼數字，共 10 碼
 */

/**
 * 移除字串中所有全形/半形空白、橫槓連字號
 */
export function normalizeTaiwanPhone(rawPhone: string): string {
  if (!rawPhone || typeof rawPhone !== 'string') return '';
  // 移除半形空白、全形空白、半形/全形橫槓 (Unicode 2010-2015, 2212, ff0d, 3000)
  return rawPhone.replace(/[\s\-\u2010-\u2015\u2212\uff0d\u3000]/g, '').trim();
}

/**
 * 嚴格驗證是否為有效台灣手機號碼
 * 規則：正規化後必須符合 ^09\d{8}$
 */
export function isValidTaiwanPhone(rawPhone: string): boolean {
  const normalized = normalizeTaiwanPhone(rawPhone);
  return /^09\d{8}$/.test(normalized);
}

/**
 * 取得手機號碼驗證錯誤訊息，若合法則回傳 null
 */
export function getTaiwanPhoneErrorMessage(rawPhone: string): string | null {
  const trimmed = (rawPhone || '').trim();
  if (!trimmed) {
    return '請填寫手機號碼';
  }

  const normalized = normalizeTaiwanPhone(rawPhone);
  if (!/^\d+$/.test(normalized)) {
    return '手機號碼僅能包含數字';
  }

  if (!normalized.startsWith('09')) {
    return '台灣手機號碼必須以 09 開頭';
  }

  if (normalized.length !== 10) {
    return `手機號碼長度應為 10 碼（目前已輸入 ${normalized.length} 碼）`;
  }

  if (!/^09\d{8}$/.test(normalized)) {
    return '請輸入正確的台灣手機號碼格式（例：0912345678）';
  }

  return null;
}
