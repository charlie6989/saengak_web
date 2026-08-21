/**
 * TapPay Direct Pay SDK 金流整合模組
 * 依據 docs/CHECKOUT_PAYMENT_SPEC.md 規格：
 * - 卡號零落地 (Zero-Card-Storage / PCI-DSS SAQ A-EP)
 * - Pay-by-Prime 授權扣款
 * - 3D Secure (3DS) 驗證跳轉支援
 * - Transaction Record 狀態查詢
 * - Transaction Refund 自動退款補償
 */

export interface TapPayConfig {
  partnerKey: string;
  merchantId: string;
  isProduction?: boolean;
  fetcher?: typeof fetch;
}

export interface TapPayCardholder {
  phoneNumber: string;
  name: string;
  email: string;
  zipCode?: string;
  address?: string;
  nationalId?: string;
}

export interface PayByPrimeRequest {
  prime: string;
  amount: number;
  details?: string;
  cardholder: TapPayCardholder;
  origin?: string; // 供產生 3DS callback URL
  resultUrl?: string; // 自訂 3DS callback URL
  orderNumber?: string;
  enable3DS?: boolean;
}

export interface TapPayCardInfo {
  lastFour: string;
  binCode: string;
  issuer: string;
  funding: number;
  type: number;
  level: string;
  country: string;
  countryCode: string;
}

export interface PayByPrimeResponse {
  status: number; // 0: 扣款成功；其他為錯誤代碼
  msg: string;
  recTradeId: string;
  bankTransactionId?: string;
  authCode?: string;
  amount: number;
  paymentUrl?: string; // 若需 3DS 驗證跳轉則有值
  cardInfo?: TapPayCardInfo;
  transactionTimeMillis?: number;
}

export interface TradeRecordResponse {
  status: number;
  msg: string;
  recTradeId: string;
  isPaid: boolean;
  amount: number;
  recordStatus: number; // 0: 成功, 1: 待驗證, 2: 失敗
  bankTransactionId?: string;
  authCode?: string;
  rawResponse?: Record<string, unknown>;
}

export interface RefundResponse {
  status: number;
  msg: string;
  refundId?: string;
  recTradeId: string;
  amount?: number;
}

/**
 * 取得 TapPay 基本設定
 */
export function getTapPayConfig(override?: Partial<TapPayConfig>): TapPayConfig {
  const partnerKey = override?.partnerKey || process.env.TAPPAY_PARTNER_KEY || '';
  const merchantId = override?.merchantId || process.env.TAPPAY_MERCHANT_ID || 'SAENGAK_TAIWAN_TWD';
  const isProduction = override?.isProduction ?? (
    process.env.TAPPAY_ENV === 'production' ||
    process.env.NODE_ENV === 'production' && process.env.TAPPAY_SANDBOX !== 'true'
  );

  return {
    partnerKey,
    merchantId,
    isProduction,
    fetcher: override?.fetcher || fetch,
  };
}

/**
 * 取得 TapPay API 基礎端點 URL
 */
export function getTapPayBaseUrl(isProduction: boolean): string {
  return isProduction
    ? 'https://prod.tappaysdk.com'
    : 'https://sandbox.tappaysdk.com';
}

/**
 * 呼叫 TapPay pay-by-prime 進行信用卡授權扣款
 */
export async function payByPrime(
  request: PayByPrimeRequest,
  configOverride?: Partial<TapPayConfig>
): Promise<PayByPrimeResponse> {
  const config = getTapPayConfig(configOverride);
  if (!config.partnerKey) {
    throw new Error('TapPay Partner Key 未設定');
  }
  if (!request.prime) {
    throw new Error('TapPay Prime 不得為空');
  }
  if (!Number.isSafeInteger(request.amount) || request.amount <= 0) {
    throw new Error('扣款金額必須為正整數');
  }

  const baseUrl = getTapPayBaseUrl(config.isProduction ?? false);
  const url = `${baseUrl}/tpc/payment/pay-by-prime`;

  const origin = request.origin || 'https://saengak.com.tw';
  const callbackUrl = request.resultUrl || `${origin}/checkout/3ds-callback`;

  const payload: Record<string, unknown> = {
    prime: request.prime,
    partner_key: config.partnerKey,
    merchant_id: config.merchantId,
    details: request.details || 'SAENGAK 官方購物訂單',
    amount: request.amount,
    currency: 'TWD',
    order_number: request.orderNumber,
    cardholder: {
      phone_number: request.cardholder.phoneNumber,
      name: request.cardholder.name,
      email: request.cardholder.email,
      zip_code: request.cardholder.zipCode || '',
      address: request.cardholder.address || '',
      national_id: request.cardholder.nationalId || '',
    },
    remember: false,
  };

  // 啟用 3DS 驗證
  if (request.enable3DS !== false) {
    payload.three_domain_secure = true;
    payload.result_url = {
      frontend_redirect_url: callbackUrl,
      backend_notify_url: `${origin}/api/checkout/confirm`,
    };
  }

  const res = await (config.fetcher || fetch)(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.partnerKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`TapPay HTTP 錯誤 ${res.status}`);
  }

  const data = (await res.json()) as Record<string, any>;
  const status = Number(data.status);

  const cardInfoRaw = data.card_info;
  const cardInfo: TapPayCardInfo | undefined = cardInfoRaw
    ? {
        lastFour: cardInfoRaw.last_four || '',
        binCode: cardInfoRaw.bin_code || '',
        issuer: cardInfoRaw.issuer || '',
        funding: Number(cardInfoRaw.funding || 0),
        type: Number(cardInfoRaw.type || 0),
        level: cardInfoRaw.level || '',
        country: cardInfoRaw.country || '',
        countryCode: cardInfoRaw.country_code || '',
      }
    : undefined;

  return {
    status,
    msg: String(data.msg || (status === 0 ? 'Success' : 'Payment Failed')),
    recTradeId: String(data.rec_trade_id || ''),
    bankTransactionId: data.bank_transaction_id ? String(data.bank_transaction_id) : undefined,
    authCode: data.auth_code ? String(data.auth_code) : undefined,
    amount: Number(data.amount || request.amount),
    paymentUrl: data.payment_url ? String(data.payment_url) : undefined,
    cardInfo,
    transactionTimeMillis: Number(data.transaction_time_millis || Date.now()),
  };
}

/**
 * 查詢 TapPay 交易紀錄 (Record API) 確認真實扣款狀態
 */
export async function getTradeRecord(
  recTradeId: string,
  configOverride?: Partial<TapPayConfig>
): Promise<TradeRecordResponse> {
  const config = getTapPayConfig(configOverride);
  if (!config.partnerKey) {
    throw new Error('TapPay Partner Key 未設定');
  }
  if (!recTradeId) {
    throw new Error('rec_trade_id 不得為空');
  }

  const baseUrl = getTapPayBaseUrl(config.isProduction ?? false);
  const url = `${baseUrl}/tpc/transaction/trade-history`;

  const payload = {
    partner_key: config.partnerKey,
    records_per_page: 1,
    filters: {
      rec_trade_id: recTradeId,
    },
  };

  const res = await (config.fetcher || fetch)(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.partnerKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`TapPay Record API HTTP 錯誤 ${res.status}`);
  }

  const data = (await res.json()) as Record<string, any>;
  const status = Number(data.status);

  if (status !== 0) {
    return {
      status,
      msg: String(data.msg || 'Query Failed'),
      recTradeId,
      isPaid: false,
      amount: 0,
      recordStatus: 2,
      rawResponse: data,
    };
  }

  const tradeRecords = Array.isArray(data.trade_records) ? data.trade_records : [];
  const record = tradeRecords.find((r: any) => r.rec_trade_id === recTradeId) || tradeRecords[0];

  if (!record) {
    return {
      status: 404,
      msg: '找不到此筆交易紀錄',
      recTradeId,
      isPaid: false,
      amount: 0,
      recordStatus: 2,
      rawResponse: data,
    };
  }

  // record_status: 0 代表成功 (Paid), 1 代表進行中/待處理, 其餘為失敗
  const recordStatus = Number(record.record_status ?? (record.status === 0 ? 0 : 2));
  const isPaid = recordStatus === 0 && Number(record.amount) > 0;

  return {
    status: 0,
    msg: String(record.msg || 'Success'),
    recTradeId,
    isPaid,
    amount: Number(record.amount || 0),
    recordStatus,
    bankTransactionId: record.bank_transaction_id ? String(record.bank_transaction_id) : undefined,
    authCode: record.auth_code ? String(record.auth_code) : undefined,
    rawResponse: record,
  };
}

/**
 * 執行 TapPay 交易退款 (Refund API) - 分散式補償機制使用
 */
export async function refundTransaction(
  recTradeId: string,
  amount?: number,
  configOverride?: Partial<TapPayConfig>
): Promise<RefundResponse> {
  const config = getTapPayConfig(configOverride);
  if (!config.partnerKey) {
    throw new Error('TapPay Partner Key 未設定');
  }
  if (!recTradeId) {
    throw new Error('rec_trade_id 不得為空');
  }

  const baseUrl = getTapPayBaseUrl(config.isProduction ?? false);
  const url = `${baseUrl}/tpc/transaction/refund`;

  const payload: Record<string, unknown> = {
    partner_key: config.partnerKey,
    rec_trade_id: recTradeId,
  };
  if (amount !== undefined && amount > 0) {
    payload.amount = amount;
  }

  const res = await (config.fetcher || fetch)(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.partnerKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`TapPay Refund API HTTP 錯誤 ${res.status}`);
  }

  const data = (await res.json()) as Record<string, any>;
  const status = Number(data.status);

  return {
    status,
    msg: String(data.msg || (status === 0 ? 'Success' : 'Refund Failed')),
    refundId: data.refund_id ? String(data.refund_id) : undefined,
    recTradeId,
    amount: data.amount ? Number(data.amount) : amount,
  };
}
