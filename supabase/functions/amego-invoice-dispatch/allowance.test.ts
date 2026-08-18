import { describe, expect, it, vi } from 'vitest';
import {
  buildAmegoAllowancePayload,
  dispatchAmegoAllowanceJob,
  type AmegoAllowanceJob,
} from './allowance';

const job: AmegoAllowanceJob = {
  job_id: '11111111-1111-4111-8111-111111111111',
  shopify_order_gid: 'gid://shopify/Order/9554194432293',
  shopify_refund_gid: 'gid://shopify/Refund/889900112233',
  amego_order_id: 'S9554194432293',
  allowance_number: '889900112233',
  operation: 'allowance_issue',
  request_payload: {
    currencyCode: 'TWD',
    allowanceDate: '20260813',
    lineItems: [{
      description: '深層修護私密清潔露', quantity: 1, netAmount: '648', taxAmount: '32',
    }],
  },
  expected_net_amount: '648',
  expected_tax_amount: '32',
  expected_invoice_total_amount: '680',
  provider_invoice_number: 'AA12345678',
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

const invoice = {
  invoice_number: 'AA12345678', invoice_type: 'C0401', invoice_status: 99,
  invoice_date: 20260801, order_id: job.amego_order_id,
  buyer_identifier: '0000000000', buyer_name: '客人',
  total_amount: 680,
};

describe('Amego allowance dispatch', () => {
  it('builds a seller-issued taxable allowance from provider invoice identity', () => {
    expect(buildAmegoAllowancePayload(job, invoice)).toEqual([expect.objectContaining({
      AllowanceNumber: '889900112233',
      AllowanceDate: '20260813',
      AllowanceType: '2',
      BuyerIdentifier: '0000000000',
      TaxAmount: '32',
      TotalAmount: '648',
      ProductItem: [expect.objectContaining({
        OriginalInvoiceNumber: 'AA12345678',
        OriginalInvoiceDate: 20260801,
        Amount: '648',
        Tax: 32,
      })],
    })]);
  });

  it('queries before issuing and confirms only D0401 status 99 with exact totals', async () => {
    const marker = vi.fn().mockResolvedValue(undefined);
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ code: 71, msg: '查無資料' }))
      .mockResolvedValueOnce(response({ code: 0, data: invoice }))
      .mockResolvedValueOnce(response({ code: 0, msg: '' }))
      .mockResolvedValueOnce(response({
        code: 0,
        data: {
          allowance_number: job.allowance_number, invoice_type: 'D0401',
          invoice_status: 99, total_amount: 648, tax_amount: 32,
          create_date: 1_788_000_000,
        },
      }));

    await expect(dispatchAmegoAllowanceJob(job, credentials, fetcher, marker))
      .resolves.toMatchObject({
        outcome: 'allowance_issued', allowanceNumber: job.allowance_number,
        providerStatus: 99,
      });
    expect(marker).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[2][0]).toBe('https://invoice-api.amego.tw/json/g0401');
  });

  it('never resends an accepted allowance whose provider result is not visible yet', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ code: 71, msg: '查無資料' }));
    await expect(dispatchAmegoAllowanceJob(
      { ...job, mutation_accepted: true }, credentials, fetcher,
    )).resolves.toMatchObject({
      outcome: 'provider_pending', mutationAccepted: true,
      errorCode: 'ALLOWANCE_ISSUE_ACCEPTED_AWAITING_PROVIDER',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects a provider allowance with different accounting totals', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({
      code: 0,
      data: {
        allowance_number: job.allowance_number, invoice_type: 'D0401',
        invoice_status: 99, total_amount: 647, tax_amount: 32,
        create_date: 1_788_000_000,
      },
    }));
    await expect(dispatchAmegoAllowanceJob(job, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'failed', errorCode: 'ALLOWANCE_RECONCILIATION_MISMATCH',
      retryable: false,
    });
  });

  it('rejects a source invoice whose provider total differs from the approved snapshot', async () => {
    const marker = vi.fn();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ code: 71, msg: '查無資料' }))
      .mockResolvedValueOnce(response({
        code: 0,
        data: { ...invoice, total_amount: 679 },
      }));

    await expect(dispatchAmegoAllowanceJob(job, credentials, fetcher, marker))
      .resolves.toMatchObject({
        outcome: 'failed', errorCode: 'SOURCE_INVOICE_NOT_CONFIRMED',
      });
    expect(marker).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('rejects an invalid approved invoice total before provider mutation', async () => {
    const marker = vi.fn();
    const fetcher = vi.fn().mockResolvedValue(response({ code: 71, msg: '查無資料' }));

    await expect(dispatchAmegoAllowanceJob(
      { ...job, expected_invoice_total_amount: null as unknown as string },
      credentials,
      fetcher,
      marker,
    )).resolves.toMatchObject({
      outcome: 'failed', errorCode: 'INVALID_ALLOWANCE_SNAPSHOT', retryable: false,
    });
    expect(marker).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('accepts a provider-confirmed B0401 company allowance', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({
      code: 0,
      data: {
        allowance_number: job.allowance_number, invoice_type: 'B0401',
        invoice_status: 99, total_amount: 648, tax_amount: 32,
        create_date: 1_788_000_000,
      },
    }));
    await expect(dispatchAmegoAllowanceJob(job, credentials, fetcher)).resolves.toMatchObject({
      outcome: 'allowance_issued', providerStatus: 99,
    });
  });

  it('voids a confirmed D0401 allowance and confirms D0501 status 99', async () => {
    const voidJob = {
      ...job,
      operation: 'allowance_void' as const,
      request_payload: {} as AmegoAllowanceJob['request_payload'],
    };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({
        code: 0,
        data: {
          allowance_number: job.allowance_number, invoice_type: 'D0401',
          invoice_status: 99, total_amount: 648, tax_amount: 32,
          create_date: 1_788_000_000,
        },
      }))
      .mockResolvedValueOnce(response({ code: 0, msg: '' }))
      .mockResolvedValueOnce(response({
        code: 0,
        data: {
          allowance_number: job.allowance_number, invoice_type: 'D0501',
          invoice_status: 99, total_amount: 648, tax_amount: 32,
          cancel_date: 1_788_000_100,
        },
      }));

    await expect(dispatchAmegoAllowanceJob(voidJob, credentials, fetcher, vi.fn()))
      .resolves.toMatchObject({
        outcome: 'allowance_voided', allowanceNumber: job.allowance_number,
      });
    expect(fetcher.mock.calls[1][0]).toBe('https://invoice-api.amego.tw/json/g0501');
  });

  it('keeps query-only reconciliation for ambiguous already-voided responses', async () => {
    const voidJob = { ...job, operation: 'allowance_void' as const };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({
        code: 0,
        data: {
          allowance_number: job.allowance_number, invoice_type: 'D0401',
          invoice_status: 99, total_amount: 648, tax_amount: 32,
          create_date: 1_788_000_000,
        },
      }))
      .mockResolvedValueOnce(response({ code: 4050132, msg: '折讓已作廢' }));
    await expect(dispatchAmegoAllowanceJob(voidJob, credentials, fetcher, vi.fn()))
      .resolves.toMatchObject({
        outcome: 'provider_pending', errorCode: 'AMEGO_4050132', mutationAccepted: true,
      });
  });
});
