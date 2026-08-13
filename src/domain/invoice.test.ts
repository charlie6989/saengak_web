import { describe, expect, it } from 'vitest';
import { isValidTaiwanTaxId, validateInvoicePreference } from './invoice';

describe('invoice preference validation', () => {
  it('validates Taiwan tax IDs including the digit-seven exception', () => {
    expect(isValidTaiwanTaxId('04595257')).toBe(true);
    expect(isValidTaiwanTaxId('12345678')).toBe(false);
  });

  it('accepts personal email, mobile barcode, and donation preferences', () => {
    expect(validateInvoicePreference({
      kind: 'personal', notificationEmail: 'buyer@example.com', carrier: 'none', carrierId: '',
    })).toBeUndefined();
    expect(validateInvoicePreference({
      kind: 'personal', notificationEmail: '', carrier: 'mobile', carrierId: '/TRM+O+P',
    })).toBeUndefined();
    expect(validateInvoicePreference({
      kind: 'personal', notificationEmail: '', carrier: 'donation', carrierId: '275',
    })).toBeUndefined();
  });

  it('rejects malformed or internally inconsistent preferences', () => {
    expect(validateInvoicePreference({
      kind: 'personal', notificationEmail: 'not-email', carrier: 'none', carrierId: '',
    })).toContain('Email');
    expect(validateInvoicePreference({
      kind: 'personal', notificationEmail: '', carrier: 'mobile', carrierId: '0912345678',
    })).toContain('手機條碼');
    expect(validateInvoicePreference({
      kind: 'company', notificationEmail: '', buyerName: '', taxId: '04595257',
    })).toContain('公司抬頭');
  });
});
