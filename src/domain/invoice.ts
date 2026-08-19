export type InvoicePreference =
  | {
    kind: 'personal';
    notificationEmail: string;
    carrier: 'none' | 'mobile' | 'amego-email' | 'donation';
    carrierId: string;
  }
  | {
    kind: 'company';
    notificationEmail: string;
    buyerName: string;
    taxId: string;
  };

export const defaultInvoicePreference: InvoicePreference = {
  kind: 'personal',
  notificationEmail: '',
  carrier: 'none',
  carrierId: '',
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobileBarcodePattern = /^\/[0-9A-Z+\-.]{7}$/;
const donationCodePattern = /^\d{3,7}$/;

export function isValidTaiwanTaxId(value: string): boolean {
  if (!/^\d{8}$/.test(value)) return false;
  const digits = [...value].map(Number);
  const weights = [1, 2, 1, 2, 1, 2, 4, 1];
  const sum = digits.reduce((total, digit, index) => {
    const product = digit * weights[index];
    return total + Math.floor(product / 10) + (product % 10);
  }, 0);
  return sum % 10 === 0 || (digits[6] === 7 && (sum + 1) % 10 === 0);
}

export function validateInvoicePreference(preference: InvoicePreference): string | undefined {
  const email = preference.notificationEmail.trim();
  if (email && (email.length > 254 || !emailPattern.test(email))) {
    return '請輸入有效的發票通知 Email。';
  }

  if (preference.kind === 'company') {
    if (!isValidTaiwanTaxId(preference.taxId.trim())) return '請輸入有效的 8 碼統一編號。';
    const buyerName = preference.buyerName.trim();
    if (!buyerName || buyerName.length > 60) return '請輸入公司抬頭（最多 60 字）。';
    return undefined;
  }

  const carrierId = preference.carrierId.trim();
  if (preference.carrier === 'mobile' && !mobileBarcodePattern.test(carrierId.toUpperCase())) {
    return '手機條碼格式應為 / 開頭加 7 碼英數符號。';
  }
  if (preference.carrier === 'amego-email' && !emailPattern.test(carrierId)) {
    return '請輸入有效的光貿 Email 載具。';
  }
  if (preference.carrier === 'donation' && !donationCodePattern.test(carrierId)) {
    return '捐贈碼需為 3–7 碼數字。';
  }
  return undefined;
}
