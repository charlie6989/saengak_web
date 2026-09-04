import { describe, expect, it, vi } from 'vitest';
import { amegoMd5, buildAmegoInvoicePayload, dispatchAmegoJob, type AmegoJob } from './amego';

const job: AmegoJob = {
  job_id: '11111111-1111-4111-8111-111111111111',
  shopify_order_gid: 'gid://shopify/Order/9554194432293',
  amego_order_id: 'S9554194432293',
  operation: 'issue',
  request_payload: {
    currencyCode: 'TWD',
    totalAmount: '680',
    lineItems: [{ productName: '深層修護私密清潔露', quantity: 1, price: '650' }],
    preference: { kind: 'personal', notificationEmail: 'buyer@example.test', carrier: 'mobile', carrierId: '/TRM+O+P' },
  },
  expected_total_amount: '680',
  expected_buyer_identifier: '0000000000',
  provider_invoice_number: null,
  mutation_accepted: false,
  lease_token: '22222222-2222-4222-8222-222222222222',
  attempts: 1,
};

const credentials = {
  sellerTaxId: '12345678',
  appKey: 'fixture-only-app-key-0001',
  mode: 'test' as const,
  allowedSellerTaxIds: ['12345678'],
};

const response = (value: unknown) => new Response(JSON.stringify(value), {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
});

describe('Amego invoice dispatch', () => {
  it('uses the provider-required lowercase UTF-8 MD5 signature', () => {
    expect(amegoMd5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  it('builds a TWD invoice with an explicit order adjustment and carrier', () => {
    expect(buildAmegoInvoicePayload(job)).toMatchObject({
      OrderId: 'S9554194432293',
      BuyerIdentifier: '0000000000',
      CarrierType: '3J0002',
      CarrierId1: '/TRM+O+P',
      TotalAmount: '680',
      ProductItem: [
        { Description: '深層修護私密清潔露', Amount: '650' },
        { Description: '運費／訂單調整', Amount: '30' },
      ],
    });
  });

  it('builds two explicit lines for shipping and discount when they reconcile with the total', () => {
    const explicitJob: AmegoJob = {
      ...job,
      request_payload: {
        ...job.request_payload,
        totalAmount: '680',
        lineItems: [{ productName: '深層修護私密清潔露', quantity: 1, price: '634' }],
        shippingAmount: 146,
        discountAmount: 100,
      },
    };
    const payload = buildAmegoInvoicePayload(explicitJob);
    expect(payload).toMatchObject({
      TotalAmount: '680',
      ProductItem: [
        { Description: '深層修護私密清潔露', Amount: '634' },
        { Description: '運費', Amount: '146' },
        { Description: '折扣', Amount: '-100' },
      ],
    });
    const items = payload.ProductItem as Array<{ Description: string; Amount: string }>;
    expect(items.some((item) => item.Description.includes('／訂單調整'))).toBe(false);
    expect(items.reduce((sum, item) => sum + Number(item.Amount), 0)).toBe(680);
  });

  it('falls back to the single-line adjustment when discountAmount is missing', () => {
    const partialJob: AmegoJob = {
      ...job,
      request_payload: {
        ...job.request_payload,
        shippingAmount: 146,
        // discountAmount intentionally omitted to simulate a pre-migration job payload
      },
    };
    const payload = buildAmegoInvoicePayload(partialJob);
    expect(payload).toMatchObject({
      TotalAmount: '680',
      ProductItem: [
        { Description: '深層修護私密清潔露', Amount: '650' },
        { Description: '運費／訂單調整', Amount: '30' },
      ],
    });
    const items = payload.ProductItem as Array<{ Description: string; Amount: string }>;
    expect(items.reduce((sum, item) => sum + Number(item.Amount), 0)).toBe(680);
  });

  it('falls back to the single-line adjustment when shipping and discount do not reconcile with the total', () => {
    const mismatchedJob: AmegoJob = {
      ...job,
      request_payload: {
        ...job.request_payload,
        shippingAmount: 999,
        discountAmount: 0,
      },
    };
    const payload = buildAmegoInvoicePayload(mismatchedJob);
    expect(payload).toMatchObject({
      TotalAmount: '680',
      ProductItem: [
        { Description: '深層修護私密清潔露', Amount: '650' },
        { Description: '運費／訂單調整', Amount: '30' },
      ],
    });
    const items = payload.ProductItem as Array<{ Description: string; Amount: string }>;
    expect(items.reduce((sum, item) => sum + Number(item.Amount), 0)).toBe(680);
  });

  it('omits the shipping line when shippingAmount is zero but still applies a positive discount', () => {
    const freeShippingJob: AmegoJob = {
      ...job,
      request_payload: {
        ...job.request_payload,
        totalAmount: '600',
        lineItems: [{ productName: '深層修護私密清潔露', quantity: 1, price: '650' }],
        shippingAmount: 0,
        discountAmount: 50,
      },
    };
    const payload = buildAmegoInvoicePayload(freeShippingJob);
    expect(payload).toMatchObject({
      TotalAmount: '600',
      ProductItem: [
        { Description: '深層修護私密清潔露', Amount: '650' },
        { Description: '折扣', Amount: '-50' },
      ],
    });
    const items = payload.ProductItem as Array<{ Description: string; Amount: string }>;
    expect(items.some((item) => item.Description === '運費')).toBe(false);
    expect(items.reduce((sum, item) => sum + Number(item.Amount), 0)).toBe(600);
  });

  it('adds no adjustment line when shipping and discount are both zero and totals already reconcile', () => {
    const exactJob: AmegoJob = {
      ...job,
      request_payload: {
        ...job.request_payload,
        totalAmount: '650',
        lineItems: [{ productName: '深層修護私密清潔露', quantity: 1, price: '650' }],
        shippingAmount: 0,
        discountAmount: 0,
      },
    };
    const payload = buildAmegoInvoicePayload(exactJob);
    const items = payload.ProductItem as Array<{ Description: string; Amount: string }>;
    expect(items).toHaveLength(exactJob.request_payload.lineItems.length);
    expect(payload).toMatchObject({ TotalAmount: '650' });
    expect(items.reduce((sum, item) => sum + Number(item.Amount), 0)).toBe(650);
  });

  it('queries before issuing and marks issued only after status 99 readback', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ code: 71, msg: '查無資料' }))
      .mockResolvedValueOnce(response({ code: 0, msg: '', invoice_number: 'AA12345678' }))
      .mockResolvedValueOnce(response({
        code: 0,
        data: {
          invoice_number: 'AA12345678', invoice_type: 'C0401', invoice_status: 99,
          order_id: job.amego_order_id, total_amount: 680, buyer_identifier: '0000000000', create_date: 1_788_000_000,
        },
      }));

    await expect(dispatchAmegoJob(job, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'issued', invoiceNumber: 'AA12345678', providerStatus: 99,
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fetcher.mock.calls[1][0]).toBe('https://invoice-api.amego.tw/json/f0401');
  });

  it('does not mutate provider state when preflight reconciliation is unavailable', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ code: 21, msg: 'busy' }));
    await expect(dispatchAmegoJob(job, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'failed', errorCode: 'AMEGO_21', retryable: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects a mismatched provider invoice instead of adopting it', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({
      code: 0,
      data: {
        invoice_number: 'AA12345678', invoice_type: 'C0401', invoice_status: 99,
        order_id: 'SOTHER', total_amount: 680, buyer_identifier: '0000000000', create_date: 1_788_000_000,
      },
    }));
    await expect(dispatchAmegoJob(job, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'failed', errorCode: 'RECONCILIATION_MISMATCH', retryable: false,
    });
  });

  it('accepts an A0401 status 99 readback for a company invoice', async () => {
    const companyJob: AmegoJob = {
      ...job,
      expected_buyer_identifier: '12345678',
      request_payload: {
        ...job.request_payload,
        preference: {
          kind: 'company', notificationEmail: 'buyer@example.test',
          taxId: '12345678', buyerName: '測試公司',
        },
      },
    };
    const fetcher = vi.fn().mockResolvedValue(response({
      code: 0,
      data: {
        invoice_number: 'AA12345678', invoice_type: 'A0401', invoice_status: 99,
        order_id: job.amego_order_id, total_amount: 680,
        buyer_identifier: '12345678', create_date: 1_788_000_000,
      },
    }));
    await expect(dispatchAmegoJob(companyJob, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'issued', providerStatus: 99,
    });
  });

  it('rejects a B2C C0401 readback for an approved company invoice', async () => {
    const companyJob: AmegoJob = {
      ...job,
      expected_buyer_identifier: '12345678',
      request_payload: {
        ...job.request_payload,
        preference: {
          kind: 'company', notificationEmail: 'buyer@example.test',
          taxId: '12345678', buyerName: '測試公司',
        },
      },
    };
    const fetcher = vi.fn().mockResolvedValue(response({
      code: 0,
      data: {
        invoice_number: 'AA12345678', invoice_type: 'C0401', invoice_status: 99,
        order_id: job.amego_order_id, total_amount: 680,
        buyer_identifier: '12345678', create_date: 1_788_000_000,
      },
    }));
    await expect(dispatchAmegoJob(companyJob, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'failed', errorCode: 'UNEXPECTED_INVOICE_TYPE', retryable: false,
    });
  });

  it('can void an issued invoice after the PII request payload was scrubbed', async () => {
    const voidJob: AmegoJob = {
      ...job,
      operation: 'void',
      request_payload: {} as AmegoJob['request_payload'],
      provider_invoice_number: 'AA12345678',
    };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({
        code: 0,
        data: {
          invoice_number: 'AA12345678', invoice_type: 'C0401', invoice_status: 99,
          order_id: job.amego_order_id, total_amount: 680, create_date: 1_788_000_000,
        },
      }))
      .mockResolvedValueOnce(response({ code: 0, msg: '' }))
      .mockResolvedValueOnce(response({
        code: 0,
        data: {
          invoice_number: 'AA12345678', invoice_type: 'C0501', invoice_status: 99,
          order_id: job.amego_order_id, total_amount: 680, cancel_date: 1_788_000_100,
        },
      }));

    await expect(dispatchAmegoJob(voidJob, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'voided', invoiceNumber: 'AA12345678', providerStatus: 99,
    });
    expect(fetcher.mock.calls[1][0]).toBe('https://invoice-api.amego.tw/json/f0501');
  });

  it('polls without resending an accepted void mutation', async () => {
    const voidJob: AmegoJob = {
      ...job,
      operation: 'void',
      request_payload: {} as AmegoJob['request_payload'],
      provider_invoice_number: 'AA12345678',
      mutation_accepted: true,
    };
    const fetcher = vi.fn().mockResolvedValue(response({
      code: 0,
      data: {
        invoice_number: 'AA12345678', invoice_type: 'C0401', invoice_status: 99,
        order_id: job.amego_order_id, total_amount: 680, create_date: 1_788_000_000,
      },
    }));

    await expect(dispatchAmegoJob(voidJob, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'provider_pending', mutationAccepted: true, errorCode: 'VOID_ACCEPTED_AWAITING_PROVIDER',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('polls without resending an accepted issue mutation that is not visible yet', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ code: 71, msg: '查無資料' }));
    await expect(dispatchAmegoJob({ ...job, mutation_accepted: true }, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'provider_pending', mutationAccepted: true, errorCode: 'ISSUE_ACCEPTED_AWAITING_PROVIDER',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('reconciles an accepted issue after its PII payload was scrubbed', async () => {
    const acceptedJob = {
      ...job,
      request_payload: {} as AmegoJob['request_payload'],
      mutation_accepted: true,
    };
    const fetcher = vi.fn().mockResolvedValue(response({
      code: 0,
      data: {
        invoice_number: 'AA12345678', invoice_type: 'C0401', invoice_status: 99,
        order_id: job.amego_order_id, total_amount: 680, buyer_identifier: '0000000000', create_date: 1_788_000_000,
      },
    }));
    await expect(dispatchAmegoJob(acceptedJob, credentials, fetcher)).resolves.toMatchObject({ outcome: 'issued' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects voiding a non-C0401 provider document', async () => {
    const voidJob: AmegoJob = {
      ...job,
      operation: 'void',
      request_payload: {} as AmegoJob['request_payload'],
    };
    const fetcher = vi.fn().mockResolvedValue(response({
      code: 0,
      data: {
        invoice_number: 'AA12345678', invoice_type: 'C0701', invoice_status: 99,
        order_id: job.amego_order_id, total_amount: 680, create_date: 1_788_000_000,
      },
    }));
    await expect(dispatchAmegoJob(voidJob, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'failed', errorCode: 'UNSUPPORTED_VOID_SOURCE', retryable: false,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('does not resend when the provider response is lost after mutation dispatch', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ code: 71, msg: '查無資料' }))
      .mockRejectedValueOnce(new Error('connection closed after upload'));
    await expect(dispatchAmegoJob(job, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'provider_pending', mutationAccepted: true, errorCode: 'MUTATION_OUTCOME_UNKNOWN',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('allows bounded retry only after a parsed provider rejection', async () => {
    const marker = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ code: 71, msg: '查無資料' }))
      .mockResolvedValueOnce(response({ code: 21, msg: '系統忙碌' }));
    await expect(dispatchAmegoJob(job, credentials, fetcher, marker)).resolves.toMatchObject({
      outcome: 'failed', errorCode: 'AMEGO_21', retryable: true, mutationRejected: true,
    });
    expect(marker).toHaveBeenCalledTimes(1);
  });

  it('keeps query-only reconciliation for an ambiguous already-voided response', async () => {
    const voidJob: AmegoJob = {
      ...job,
      operation: 'void',
      request_payload: {} as AmegoJob['request_payload'],
    };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({
        code: 0,
        data: {
          invoice_number: 'AA12345678', invoice_type: 'C0401', invoice_status: 99,
          order_id: job.amego_order_id, total_amount: 680, create_date: 1_788_000_000,
        },
      }))
      .mockResolvedValueOnce(response({ code: 3050122, msg: '發票已作廢' }));
    await expect(dispatchAmegoJob(voidJob, credentials, fetcher, vi.fn())).resolves.toMatchObject({
      outcome: 'provider_pending', errorCode: 'AMEGO_3050122', mutationAccepted: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
