import { createHash } from 'node:crypto';
import type { InvoicePreference } from '../_shared/invoice-preference.ts';

const AMEGO_BASE_URL = 'https://invoice-api.amego.tw';
const MAX_RESPONSE_BYTES = 65_536;
const RETRYABLE_PROVIDER_CODES = new Set([10, 15, 18, 21]);

interface JobLineItem {
  productName: string;
  quantity: number;
  price: string;
}

export interface AmegoJob {
  job_id: string;
  shopify_order_gid: string;
  amego_order_id: string;
  operation: 'issue' | 'void';
  request_payload: {
    currencyCode: string;
    totalAmount: string | number;
    lineItems: JobLineItem[];
    preference: InvoicePreference;
  };
  expected_total_amount: string | number;
  expected_buyer_identifier: string | null;
  provider_invoice_number?: string | null;
  mutation_accepted: boolean;
  lease_token: string;
  attempts: number;
}

export interface AmegoCredentials {
  sellerTaxId: string;
  appKey: string;
  mode: 'test' | 'production';
  allowedSellerTaxIds: string[];
}

export type AmegoDispatchResult =
  | { outcome: 'issued' | 'voided'; invoiceNumber: string; providerStatus: 99; providerUpdatedAt: string }
  | { outcome: 'provider_pending'; invoiceNumber?: string; invoiceType?: string; providerStatus?: number; errorCode: string; mutationAccepted: boolean }
  | { outcome: 'failed'; errorCode: string; errorMessage: string; retryable: boolean; mutationRejected?: boolean };

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as UnknownRecord : undefined;

const integerMoney = (value: unknown, label: string): number => {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`${label} must be whole TWD`);
  return amount;
};

const unixSecondsToIso = (value: unknown): string => {
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) throw new Error('Invalid provider timestamp');
  return new Date(seconds * 1_000).toISOString();
};

export function validateAmegoCredentials(credentials: AmegoCredentials): void {
  if (!/^\d{8}$/.test(credentials.sellerTaxId)) throw new Error('Invalid Amego seller tax ID');
  if (credentials.appKey.length < 16 || credentials.appKey.length > 200) throw new Error('Invalid Amego App Key');
  if (!credentials.allowedSellerTaxIds.includes(credentials.sellerTaxId)) {
    throw new Error('Amego seller tax ID is not allowlisted');
  }
  if (credentials.mode === 'test' && credentials.sellerTaxId !== '12345678') {
    throw new Error('Amego test mode requires the documented test seller');
  }
  if (credentials.mode === 'production' && credentials.sellerTaxId === '12345678') {
    throw new Error('Amego production mode rejects the documented test seller');
  }
}

export function amegoMd5(value: string): string {
  return createHash('md5').update(value, 'utf8').digest('hex');
}

export function buildAmegoInvoicePayload(job: AmegoJob): UnknownRecord {
  const request = job.request_payload;
  if (request.currencyCode !== 'TWD') throw new Error('Only TWD invoices are supported');
  const totalAmount = integerMoney(request.totalAmount, 'Total amount');
  if (!Array.isArray(request.lineItems) || request.lineItems.length === 0 || request.lineItems.length > 250) {
    throw new Error('Invalid invoice line items');
  }

  const productItems = request.lineItems.map((line) => {
    const quantity = Number(line.quantity);
    const unitPrice = integerMoney(line.price, 'Unit price');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('Invalid invoice quantity');
    const description = String(line.productName ?? '').trim().slice(0, 256);
    if (!description) throw new Error('Invoice description is required');
    return {
      Description: description,
      Quantity: String(quantity),
      UnitPrice: String(unitPrice),
      Amount: String(unitPrice * quantity),
      Remark: '',
      TaxType: '1',
    };
  });

  const itemTotal = productItems.reduce((sum, item) => sum + Number(item.Amount), 0);
  if (itemTotal !== totalAmount) {
    productItems.push({
      Description: itemTotal < totalAmount ? '運費／訂單調整' : '折扣／訂單調整',
      Quantity: '1',
      UnitPrice: String(totalAmount - itemTotal),
      Amount: String(totalAmount - itemTotal),
      Remark: '',
      TaxType: '1',
    });
  }

  const preference = request.preference;
  const common: UnknownRecord = {
    OrderId: job.amego_order_id,
    BuyerIdentifier: '0000000000',
    BuyerName: '客人',
    BuyerAddress: '',
    BuyerTelephoneNumber: '',
    BuyerEmailAddress: preference.notificationEmail,
    MainRemark: '',
    CarrierType: '',
    CarrierId1: '',
    CarrierId2: '',
    NPOBAN: '',
    ProductItem: productItems,
    SalesAmount: String(totalAmount),
    FreeTaxSalesAmount: '0',
    ZeroTaxSalesAmount: '0',
    TaxType: '1',
    TaxRate: '0.05',
    TaxAmount: '0',
    TotalAmount: String(totalAmount),
  };

  if (preference.kind === 'company') {
    const salesAmount = Math.round(totalAmount / 1.05);
    return {
      ...common,
      BuyerIdentifier: preference.taxId,
      BuyerName: preference.buyerName,
      SalesAmount: String(salesAmount),
      TaxAmount: String(totalAmount - salesAmount),
      DetailVat: 1,
    };
  }

  if (preference.carrier === 'mobile') {
    common.CarrierType = '3J0002';
    common.CarrierId1 = preference.carrierId;
    common.CarrierId2 = preference.carrierId;
  } else if (preference.carrier === 'amego-email') {
    common.CarrierType = 'amego';
    common.CarrierId1 = preference.carrierId;
    common.CarrierId2 = preference.carrierId;
  } else if (preference.carrier === 'donation') {
    common.NPOBAN = preference.carrierId;
  }
  return common;
}

async function readLimitedJson(response: Response): Promise<UnknownRecord> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error('Amego response is too large');
  if (!response.body) throw new Error('Amego response body is missing');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Amego response is too large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  const value = JSON.parse(text) as unknown;
  const record = asRecord(value);
  if (!record) throw new Error('Amego response is not an object');
  return record;
}

async function callAmego(
  path: '/json/f0401' | '/json/f0501' | '/json/invoice_query',
  data: unknown,
  credentials: AmegoCredentials,
  fetcher: typeof fetch,
): Promise<UnknownRecord> {
  const serialized = JSON.stringify(data);
  const time = String(Math.floor(Date.now() / 1_000));
  const form = new URLSearchParams({
    invoice: credentials.sellerTaxId,
    data: serialized,
    time,
    sign: amegoMd5(serialized + time + credentials.appKey),
  });
  const response = await fetcher(`${AMEGO_BASE_URL}${path}`, {
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Amego HTTP ${response.status}`);
  return readLimitedJson(response);
}

function evaluateQuery(job: AmegoJob, response: UnknownRecord): AmegoDispatchResult | undefined {
  if (Number(response.code) !== 0) return undefined;
  const data = asRecord(response.data);
  if (!data) return undefined;
  const invoiceNumber = typeof data.invoice_number === 'string' ? data.invoice_number : '';
  const invoiceType = typeof data.invoice_type === 'string' ? data.invoice_type : '';
  const providerStatus = Number(data.invoice_status);
  const orderId = typeof data.order_id === 'string' ? data.order_id : '';
  const totalAmount = Number(data.total_amount);
  const expectedTotal = integerMoney(job.expected_total_amount, 'Total amount');
  if (orderId !== job.amego_order_id || totalAmount !== expectedTotal || !/^[A-Z]{2}\d{8}$/.test(invoiceNumber)) {
    return { outcome: 'failed', errorCode: 'RECONCILIATION_MISMATCH', errorMessage: 'Provider invoice does not match the immutable order snapshot', retryable: false };
  }
  if (job.operation === 'issue') {
    if (data.buyer_identifier !== job.expected_buyer_identifier) {
      return { outcome: 'failed', errorCode: 'RECONCILIATION_MISMATCH', errorMessage: 'Provider buyer identifier does not match the immutable order snapshot', retryable: false };
    }
  }
  if (providerStatus === 91) {
    return { outcome: 'failed', errorCode: 'PROVIDER_STATUS_91', errorMessage: 'Provider reports an invoice processing error', retryable: false };
  }
  if (job.operation === 'issue' && invoiceType === 'C0401' && providerStatus === 99) {
    return { outcome: 'issued', invoiceNumber, providerStatus: 99, providerUpdatedAt: unixSecondsToIso(data.create_date) };
  }
  if (job.operation === 'void' && invoiceType === 'C0501' && providerStatus === 99 && Number(data.cancel_date) > 0) {
    return { outcome: 'voided', invoiceNumber, providerStatus: 99, providerUpdatedAt: unixSecondsToIso(data.cancel_date) };
  }
  if (job.operation === 'void' && providerStatus === 99 && invoiceType !== 'C0401') {
    return { outcome: 'failed', errorCode: 'UNSUPPORTED_VOID_SOURCE', errorMessage: 'Only a confirmed C0401 invoice can be voided', retryable: false };
  }
  return {
    outcome: 'provider_pending', invoiceNumber, invoiceType, providerStatus,
    errorCode: 'PROVIDER_PENDING', mutationAccepted: job.mutation_accepted,
  };
}

export async function dispatchAmegoJob(
  job: AmegoJob,
  credentials: AmegoCredentials,
  fetcher: typeof fetch = fetch,
  markMutationStarted: () => Promise<void> = async () => undefined,
): Promise<AmegoDispatchResult> {
  let mutationAccepted = job.mutation_accepted;
  try {
    validateAmegoCredentials(credentials);
  } catch (error) {
    return {
      outcome: 'failed',
      errorCode: 'INVALID_CONFIGURATION',
      errorMessage: error instanceof Error ? error.message : 'Invalid Amego configuration',
      retryable: false,
    };
  }
  try {
    const query = await callAmego(
      '/json/invoice_query',
      { type: 'order', order_id: job.amego_order_id },
      credentials,
      fetcher,
    );
    const existing = evaluateQuery(job, query);
    const readyToVoid = job.operation === 'void'
      && existing?.outcome === 'provider_pending'
      && existing.providerStatus === 99
      && existing.invoiceType === 'C0401'
      && Boolean(existing.invoiceNumber);
    if (existing && !readyToVoid) return existing;

    if (readyToVoid) {
      if (job.mutation_accepted) {
        return {
          outcome: 'provider_pending',
          invoiceNumber: existing.invoiceNumber,
          providerStatus: existing.providerStatus,
          errorCode: 'VOID_ACCEPTED_AWAITING_PROVIDER',
          mutationAccepted: true,
        };
      }
      // Persist the fenced at-most-once boundary before an external side effect.
      await markMutationStarted();
      mutationAccepted = true;
      const voidResponse = await callAmego(
        '/json/f0501',
        [{ CancelInvoiceNumber: existing.invoiceNumber }],
        credentials,
        fetcher,
      );
      const voidCode = Number(voidResponse.code);
      if (voidCode !== 0) {
        if (!RETRYABLE_PROVIDER_CODES.has(voidCode)) {
          return {
            outcome: 'provider_pending',
            invoiceNumber: existing.invoiceNumber,
            providerStatus: existing.providerStatus,
            errorCode: `AMEGO_${Number.isFinite(voidCode) ? voidCode : 'INVALID'}`,
            mutationAccepted: true,
          };
        }
        return {
          outcome: 'failed',
          errorCode: `AMEGO_${Number.isFinite(voidCode) ? voidCode : 'INVALID'}`,
          errorMessage: 'Amego rejected the void request',
          retryable: true,
          mutationRejected: true,
        };
      }
      const confirmation = await callAmego(
        '/json/invoice_query',
        { type: 'order', order_id: job.amego_order_id },
        credentials,
        fetcher,
      );
      return evaluateQuery(job, confirmation) ?? {
        outcome: 'provider_pending',
        invoiceNumber: existing.invoiceNumber,
        errorCode: 'PROVIDER_PENDING',
        mutationAccepted: true,
      };
    }

    const queryCode = Number(query.code);
    if (queryCode !== 71) {
      return {
        outcome: 'failed',
        errorCode: `AMEGO_${Number.isFinite(queryCode) ? queryCode : 'INVALID'}`,
        errorMessage: 'Unable to reconcile the provider invoice before mutation',
        retryable: RETRYABLE_PROVIDER_CODES.has(queryCode),
      };
    }

    if (job.operation === 'void') {
      return { outcome: 'failed', errorCode: 'INVOICE_NOT_FOUND', errorMessage: 'Cannot void an invoice that the provider cannot find', retryable: false };
    }

    if (job.mutation_accepted) {
      return {
        outcome: 'provider_pending',
        errorCode: 'ISSUE_ACCEPTED_AWAITING_PROVIDER',
        mutationAccepted: true,
      };
    }

    let invoicePayload: UnknownRecord;
    try {
      invoicePayload = buildAmegoInvoicePayload(job);
    } catch (error) {
      return {
        outcome: 'failed',
        errorCode: 'INVALID_INVOICE_SNAPSHOT',
        errorMessage: error instanceof Error ? error.message : 'Invalid invoice snapshot',
        retryable: false,
      };
    }

    // Persist the fenced at-most-once boundary before an external side effect.
    await markMutationStarted();
    mutationAccepted = true;
    const issueResponse = await callAmego(
      '/json/f0401',
      invoicePayload,
      credentials,
      fetcher,
    );
    const issueCode = Number(issueResponse.code);
    if (issueCode !== 0 && issueCode !== 3040171) {
      if (!RETRYABLE_PROVIDER_CODES.has(issueCode)) {
        return {
          outcome: 'provider_pending',
          errorCode: `AMEGO_${Number.isFinite(issueCode) ? issueCode : 'INVALID'}`,
          mutationAccepted: true,
        };
      }
      return {
        outcome: 'failed',
        errorCode: `AMEGO_${Number.isFinite(issueCode) ? issueCode : 'INVALID'}`,
        errorMessage: 'Amego rejected the invoice request',
        retryable: true,
        mutationRejected: true,
      };
    }

    const confirmation = await callAmego(
      '/json/invoice_query',
      { type: 'order', order_id: job.amego_order_id },
      credentials,
      fetcher,
    );
    return evaluateQuery(job, confirmation) ?? {
      outcome: 'provider_pending',
      errorCode: 'PROVIDER_PENDING',
      mutationAccepted: true,
    };
  } catch (error) {
    if (mutationAccepted) {
      return {
        outcome: 'provider_pending',
        errorCode: 'MUTATION_OUTCOME_UNKNOWN',
        mutationAccepted: true,
      };
    }
    return {
      outcome: 'failed',
      errorCode: 'NETWORK_OR_PROTOCOL_ERROR',
      errorMessage: error instanceof Error ? error.message.slice(0, 300) : 'Unknown provider error',
      retryable: true,
    };
  }
}
