import { describe, expect, it } from 'vitest';
import { parseInvoicePreference } from './invoice-preference';

describe('server invoice preference parsing', () => {
  it('normalizes a mobile barcode and company preference', () => {
    expect(parseInvoicePreference({
      kind: 'personal', notificationEmail: '', carrier: 'mobile', carrierId: '/trm+o+p',
    })).toMatchObject({ carrierId: '/TRM+O+P' });
    expect(parseInvoicePreference({
      kind: 'company', notificationEmail: 'ap@example.com', buyerName: '範例公司', taxId: '04595257',
    })).toMatchObject({ kind: 'company', taxId: '04595257' });
  });

  it('rejects unknown fields encoded as a different preference shape', () => {
    expect(parseInvoicePreference({
      kind: 'personal', notificationEmail: '', carrier: 'none', carrierId: 'hidden',
    })).toBeUndefined();
    expect(parseInvoicePreference({
      kind: 'company', notificationEmail: '', buyerName: '範例公司', taxId: '12345678',
    })).toBeUndefined();
  });
});
