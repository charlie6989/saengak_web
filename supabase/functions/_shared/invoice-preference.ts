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

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobileBarcodePattern = /^\/[0-9A-Z+\-.]{7}$/;
const donationCodePattern = /^\d{3,7}$/;

const text = (value: unknown, maximum: number): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length <= maximum ? normalized : undefined;
};

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

export function parseInvoicePreference(value: unknown): InvoicePreference | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const notificationEmail = text(raw.notificationEmail, 254);
  if (notificationEmail === undefined || (notificationEmail && !emailPattern.test(notificationEmail))) {
    return undefined;
  }

  if (raw.kind === 'company') {
    const taxId = text(raw.taxId, 8);
    const buyerName = text(raw.buyerName, 60);
    if (!taxId || !buyerName || !isValidTaiwanTaxId(taxId)) return undefined;
    return { kind: 'company', notificationEmail, taxId, buyerName };
  }

  if (raw.kind !== 'personal') return undefined;
  const carrierValue = String(raw.carrier);
  if (!['none', 'mobile', 'amego-email', 'donation'].includes(carrierValue)) return undefined;
  const carrier = carrierValue as 'none' | 'mobile' | 'amego-email' | 'donation';
  const carrierId = text(raw.carrierId, 254);
  if (carrierId === undefined) return undefined;
  if (carrier === 'mobile' && !mobileBarcodePattern.test(carrierId.toUpperCase())) return undefined;
  if (carrier === 'amego-email' && !emailPattern.test(carrierId)) return undefined;
  if (carrier === 'donation' && !donationCodePattern.test(carrierId)) return undefined;
  if (carrier === 'none' && carrierId) return undefined;
  return {
    kind: 'personal',
    notificationEmail,
    carrier,
    carrierId: carrier === 'mobile' ? carrierId.toUpperCase() : carrierId,
  };
}
