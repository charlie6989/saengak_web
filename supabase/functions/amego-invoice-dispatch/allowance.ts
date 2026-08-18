import {
  callAmego,
  type AmegoCredentials,
  validateAmegoCredentials,
} from './amego.ts';

const RETRYABLE_PROVIDER_CODES = new Set([10, 15, 18, 21]);

interface AllowanceLineItem {
  description: string;
  quantity: number;
  netAmount: string | number;
  taxAmount: string | number;
}

export interface AmegoAllowanceJob {
  job_id: string;
  shopify_order_gid: string;
  shopify_refund_gid: string;
  amego_order_id: string;
  allowance_number: string;
  operation: 'allowance_issue' | 'allowance_void';
  request_payload: {
    currencyCode: string;
    allowanceDate: string;
    lineItems: AllowanceLineItem[];
  };
  expected_net_amount: string | number;
  expected_tax_amount: string | number;
  expected_invoice_total_amount: string | number;
  provider_invoice_number: string;
  mutation_accepted: boolean;
  lease_token: string;
  attempts: number;
}

export type AmegoAllowanceDispatchResult =
  | {
    outcome: 'allowance_issued' | 'allowance_voided';
    allowanceNumber: string;
    providerStatus: 99;
    providerUpdatedAt: string;
  }
  | {
    outcome: 'provider_pending';
    allowanceNumber?: string;
    allowanceType?: string;
    providerStatus?: number;
    errorCode: string;
    mutationAccepted: boolean;
  }
  | {
    outcome: 'failed';
    errorCode: string;
    errorMessage: string;
    retryable: boolean;
    mutationRejected?: boolean;
  };

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined;

const integerMoney = (value: unknown, label: string): number => {
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error(`${label} must be whole TWD`);
  }
  return amount;
};

const unixSecondsToIso = (value: unknown): string => {
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error('Invalid provider timestamp');
  }
  return new Date(seconds * 1_000).toISOString();
};

const decimal = (value: number): string => {
  if (!Number.isFinite(value) || value < 0) throw new Error('Invalid allowance unit price');
  return value.toFixed(7).replace(/\.?0+$/, '');
};

function unwrapAllowanceStatus(response: UnknownRecord, allowanceNumber: string): UnknownRecord | undefined {
  const rawData = response.data;
  if (Array.isArray(rawData)) {
    return rawData.map(asRecord).find((item) => item?.allowance_number === allowanceNumber);
  }
  const record = asRecord(rawData);
  if (!record) return undefined;
  if (record.allowance_number === allowanceNumber) return record;
  return asRecord(record[allowanceNumber]);
}

function evaluateAllowance(
  job: AmegoAllowanceJob,
  response: UnknownRecord,
): AmegoAllowanceDispatchResult | undefined {
  if (Number(response.code) !== 0) return undefined;
  const data = unwrapAllowanceStatus(response, job.allowance_number);
  if (!data) return undefined;

  const allowanceNumber = typeof data.allowance_number === 'string'
    ? data.allowance_number
    : job.allowance_number;
  const allowanceType = typeof data.invoice_type === 'string'
    ? data.invoice_type
    : typeof data.type === 'string' ? data.type : '';
  const providerStatus = Number(data.invoice_status ?? data.status);
  const netAmount = Number(data.total_amount);
  const taxAmount = Number(data.tax_amount);
  const expectedNet = integerMoney(job.expected_net_amount, 'Allowance net amount');
  const expectedTax = integerMoney(job.expected_tax_amount, 'Allowance tax amount');

  if (
    allowanceNumber !== job.allowance_number ||
    netAmount !== expectedNet ||
    taxAmount !== expectedTax
  ) {
    return {
      outcome: 'failed',
      errorCode: 'ALLOWANCE_RECONCILIATION_MISMATCH',
      errorMessage: 'Provider allowance does not match the immutable refund snapshot',
      retryable: false,
    };
  }
  if (providerStatus === 91) {
    return {
      outcome: 'failed',
      errorCode: 'PROVIDER_STATUS_91',
      errorMessage: 'Provider reports an allowance processing error',
      retryable: false,
    };
  }
  if (
    job.operation === 'allowance_issue' &&
    ['D0401', 'B0401'].includes(allowanceType) &&
    providerStatus === 99
  ) {
    return {
      outcome: 'allowance_issued',
      allowanceNumber,
      providerStatus: 99,
      providerUpdatedAt: unixSecondsToIso(data.create_date),
    };
  }
  if (
    job.operation === 'allowance_void' &&
    ['D0501', 'B0501'].includes(allowanceType) &&
    providerStatus === 99 &&
    Number(data.cancel_date) > 0
  ) {
    return {
      outcome: 'allowance_voided',
      allowanceNumber,
      providerStatus: 99,
      providerUpdatedAt: unixSecondsToIso(data.cancel_date),
    };
  }
  if (
    job.operation === 'allowance_void' &&
    providerStatus === 99 &&
    !['D0401', 'B0401'].includes(allowanceType)
  ) {
    return {
      outcome: 'failed',
      errorCode: 'UNSUPPORTED_ALLOWANCE_VOID_SOURCE',
      errorMessage: 'Only a confirmed D0401 allowance can be voided',
      retryable: false,
    };
  }
  return {
    outcome: 'provider_pending',
    allowanceNumber,
    allowanceType,
    providerStatus,
    errorCode: 'ALLOWANCE_PROVIDER_PENDING',
    mutationAccepted: job.mutation_accepted,
  };
}

export function buildAmegoAllowancePayload(
  job: AmegoAllowanceJob,
  invoice: UnknownRecord,
): UnknownRecord[] {
  if (!/^[1-9]\d{0,15}$/.test(job.allowance_number)) {
    throw new Error('Invalid allowance number');
  }
  if (job.request_payload.currencyCode !== 'TWD') {
    throw new Error('Only TWD allowances are supported');
  }
  if (!/^\d{8}$/.test(job.request_payload.allowanceDate)) {
    throw new Error('Invalid allowance date');
  }
  if (!/^[A-Z]{2}\d{8}$/.test(job.provider_invoice_number)) {
    throw new Error('Invalid source invoice number');
  }
  const invoiceDate = String(invoice.invoice_date ?? '');
  const buyerIdentifier = String(invoice.buyer_identifier ?? '');
  const buyerName = String(invoice.buyer_name ?? '').trim().slice(0, 60);
  if (!/^\d{8}$/.test(invoiceDate) || !/^\d{8,10}$/.test(buyerIdentifier) || !buyerName) {
    throw new Error('Provider invoice is missing allowance identity fields');
  }

  const lineItems = job.request_payload.lineItems;
  if (!Array.isArray(lineItems) || lineItems.length === 0 || lineItems.length > 250) {
    throw new Error('Invalid allowance line items');
  }
  const productItems = lineItems.map((line) => {
    const quantity = Number(line.quantity);
    const netAmount = integerMoney(line.netAmount, 'Allowance line net amount');
    const taxAmount = integerMoney(line.taxAmount, 'Allowance line tax amount');
    const description = String(line.description ?? '').trim().slice(0, 256);
    if (!description || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new Error('Invalid allowance line item');
    }
    return {
      OriginalInvoiceDate: Number(invoiceDate),
      OriginalInvoiceNumber: job.provider_invoice_number,
      OriginalDescription: description,
      Quantity: quantity,
      UnitPrice: decimal(netAmount / quantity),
      Amount: String(netAmount),
      Tax: taxAmount,
      TaxType: 1,
    };
  });
  const expectedNet = integerMoney(job.expected_net_amount, 'Allowance net amount');
  const expectedTax = integerMoney(job.expected_tax_amount, 'Allowance tax amount');
  if (
    productItems.reduce((sum, item) => sum + Number(item.Amount), 0) !== expectedNet ||
    productItems.reduce((sum, item) => sum + Number(item.Tax), 0) !== expectedTax
  ) {
    throw new Error('Allowance lines do not match expected totals');
  }

  return [{
    AllowanceNumber: job.allowance_number,
    AllowanceDate: job.request_payload.allowanceDate,
    AllowanceType: '2',
    BuyerIdentifier: buyerIdentifier,
    BuyerName: buyerName,
    BuyerAddress: '',
    BuyerTelephoneNumber: '',
    BuyerEmailAddress: '',
    ProductItem: productItems,
    TaxAmount: String(expectedTax),
    TotalAmount: String(expectedNet),
  }];
}

async function queryAllowance(
  job: AmegoAllowanceJob,
  credentials: AmegoCredentials,
  fetcher: typeof fetch,
): Promise<UnknownRecord> {
  return callAmego(
    '/json/allowance_query',
    { allowance_number: job.allowance_number },
    credentials,
    fetcher,
  );
}

export async function dispatchAmegoAllowanceJob(
  job: AmegoAllowanceJob,
  credentials: AmegoCredentials,
  fetcher: typeof fetch = fetch,
  markMutationStarted: () => Promise<void> = async () => undefined,
): Promise<AmegoAllowanceDispatchResult> {
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
    const query = await queryAllowance(job, credentials, fetcher);
    const existing = evaluateAllowance(job, query);
    const readyToVoid = job.operation === 'allowance_void' &&
      existing?.outcome === 'provider_pending' &&
      existing.providerStatus === 99 &&
      ['D0401', 'B0401'].includes(existing.allowanceType ?? '');
    if (existing && !readyToVoid) return existing;

    if (readyToVoid) {
      if (job.mutation_accepted) {
        return {
          outcome: 'provider_pending',
          allowanceNumber: job.allowance_number,
          errorCode: 'ALLOWANCE_VOID_ACCEPTED_AWAITING_PROVIDER',
          mutationAccepted: true,
        };
      }
      await markMutationStarted();
      mutationAccepted = true;
      const response = await callAmego(
        '/json/g0501',
        [{ CancelAllowanceNumber: job.allowance_number }],
        credentials,
        fetcher,
      );
      const code = Number(response.code);
      if (code !== 0) {
        if (!RETRYABLE_PROVIDER_CODES.has(code)) {
          return {
            outcome: 'provider_pending',
            allowanceNumber: job.allowance_number,
            errorCode: `AMEGO_${Number.isFinite(code) ? code : 'INVALID'}`,
            mutationAccepted: true,
          };
        }
        return {
          outcome: 'failed',
          errorCode: `AMEGO_${Number.isFinite(code) ? code : 'INVALID'}`,
          errorMessage: 'Amego rejected the allowance void request',
          retryable: true,
          mutationRejected: true,
        };
      }
      const confirmation = await queryAllowance(job, credentials, fetcher);
      return evaluateAllowance(job, confirmation) ?? {
        outcome: 'provider_pending',
        allowanceNumber: job.allowance_number,
        errorCode: 'ALLOWANCE_PROVIDER_PENDING',
        mutationAccepted: true,
      };
    }

    const queryCode = Number(query.code);
    if (queryCode !== 71) {
      return {
        outcome: 'failed',
        errorCode: `AMEGO_${Number.isFinite(queryCode) ? queryCode : 'INVALID'}`,
        errorMessage: 'Unable to reconcile the provider allowance before mutation',
        retryable: RETRYABLE_PROVIDER_CODES.has(queryCode),
      };
    }
    if (job.operation === 'allowance_void') {
      return {
        outcome: 'failed',
        errorCode: 'ALLOWANCE_NOT_FOUND',
        errorMessage: 'Cannot void an allowance that the provider cannot find',
        retryable: false,
      };
    }
    if (job.mutation_accepted) {
      return {
        outcome: 'provider_pending',
        allowanceNumber: job.allowance_number,
        errorCode: 'ALLOWANCE_ISSUE_ACCEPTED_AWAITING_PROVIDER',
        mutationAccepted: true,
      };
    }

    let expectedInvoiceTotal: number;
    try {
      expectedInvoiceTotal = integerMoney(
        job.expected_invoice_total_amount,
        'Source invoice total amount',
      );
      if (expectedInvoiceTotal <= 0) {
        throw new Error('Source invoice total amount must be positive whole TWD');
      }
    } catch (error) {
      return {
        outcome: 'failed',
        errorCode: 'INVALID_ALLOWANCE_SNAPSHOT',
        errorMessage: error instanceof Error ? error.message : 'Invalid allowance snapshot',
        retryable: false,
      };
    }

    const invoiceQuery = await callAmego(
      '/json/invoice_query',
      { type: 'order', order_id: job.amego_order_id },
      credentials,
      fetcher,
    );
    const invoice = asRecord(invoiceQuery.data);
    if (
      Number(invoiceQuery.code) !== 0 ||
      !invoice ||
      !['C0401', 'A0401'].includes(String(invoice.invoice_type ?? '')) ||
      Number(invoice.invoice_status) !== 99 ||
      invoice.invoice_number !== job.provider_invoice_number ||
      invoice.order_id !== job.amego_order_id ||
      Number(invoice.total_amount) !== expectedInvoiceTotal
    ) {
      return {
        outcome: 'failed',
        errorCode: 'SOURCE_INVOICE_NOT_CONFIRMED',
        errorMessage: 'A confirmed C0401/A0401 source invoice is required for allowance',
        retryable: Number(invoiceQuery.code) === 71 || RETRYABLE_PROVIDER_CODES.has(Number(invoiceQuery.code)),
      };
    }

    let payload: UnknownRecord[];
    try {
      payload = buildAmegoAllowancePayload(job, invoice);
    } catch (error) {
      return {
        outcome: 'failed',
        errorCode: 'INVALID_ALLOWANCE_SNAPSHOT',
        errorMessage: error instanceof Error ? error.message : 'Invalid allowance snapshot',
        retryable: false,
      };
    }
    await markMutationStarted();
    mutationAccepted = true;
    const issueResponse = await callAmego('/json/g0401', payload, credentials, fetcher);
    const issueCode = Number(issueResponse.code);
    if (issueCode !== 0) {
      if (!RETRYABLE_PROVIDER_CODES.has(issueCode)) {
        return {
          outcome: 'provider_pending',
          allowanceNumber: job.allowance_number,
          errorCode: `AMEGO_${Number.isFinite(issueCode) ? issueCode : 'INVALID'}`,
          mutationAccepted: true,
        };
      }
      return {
        outcome: 'failed',
        errorCode: `AMEGO_${Number.isFinite(issueCode) ? issueCode : 'INVALID'}`,
        errorMessage: 'Amego rejected the allowance request',
        retryable: true,
        mutationRejected: true,
      };
    }
    const confirmation = await queryAllowance(job, credentials, fetcher);
    return evaluateAllowance(job, confirmation) ?? {
      outcome: 'provider_pending',
      allowanceNumber: job.allowance_number,
      errorCode: 'ALLOWANCE_PROVIDER_PENDING',
      mutationAccepted: true,
    };
  } catch (error) {
    if (mutationAccepted) {
      return {
        outcome: 'provider_pending',
        allowanceNumber: job.allowance_number,
        errorCode: 'ALLOWANCE_MUTATION_OUTCOME_UNKNOWN',
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
