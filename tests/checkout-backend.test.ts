import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  payByPrime,
  getTradeRecord,
  refundTransaction,
} from '../api/_lib/tappay';
import {
  recalculateCheckoutTotal,
  createShopifyOrder,
} from '../api/_lib/shopify-admin';
import { POST as checkoutHandler } from '../api/checkout';
import { POST as confirmHandler } from '../api/checkout/confirm';
import { POST as statusHandler } from '../api/checkout/status';
import { POST as invoiceHandler } from '../api/invoice/guangmao';
import { POST as webhookHandler, verifyShopifyHmac } from '../api/webhooks/shopify';
import { POST as cronReconcileHandler } from '../api/cron/reconcile';
import { resetMemoryStore as resetMemoryRateLimits } from '../api/_lib/ratelimit';
import {
  createTransactionLog,
  getTransactionLog,
  resetMemoryDatabase,
} from '../api/_lib/supabase-admin';

describe('SAENGAK Serverless Commerce 後端中樞測試套件', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CHECKOUT_RELEASE_ENABLED = 'true';
    process.env.TAPPAY_PARTNER_KEY = 'test_partner_key_1234567890';
    process.env.TAPPAY_MERCHANT_ID = 'SAENGAK_TEST';
    process.env.SHOPIFY_ADMIN_ACCESS_TOKEN = 'shpat_test_token_123';
    process.env.SHOPIFY_STORE_DOMAIN = 'gh2xgs-zf.myshopify.com';
    process.env.SHOPIFY_WEBHOOK_SECRET = 'webhook_secret_key_123';
    process.env.CRON_SECRET = 'cron_secret_test_token_123';
    resetMemoryRateLimits();
    resetMemoryDatabase();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('1. TapPay 金流模組 (api/_lib/tappay.ts)', () => {
    it('成功發起 pay-by-prime 扣款授權', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          msg: 'Success',
          rec_trade_id: 'REC_TRADE_1001',
          bank_transaction_id: 'BANK_TX_2001',
          auth_code: 'AUTH_8888',
          amount: 1580,
          card_info: {
            last_four: '4242',
            bin_code: '424242',
            issuer: 'Test Bank',
          },
        }),
      });

      const res = await payByPrime(
        {
          prime: 'test_prime_token',
          amount: 1580,
          cardholder: {
            phoneNumber: '0912345678',
            name: '林美麗',
            email: 'buyer@example.com',
          },
        },
        { fetcher: mockFetcher, partnerKey: 'test_partner_key' }
      );

      expect(res.status).toBe(0);
      expect(res.recTradeId).toBe('REC_TRADE_1001');
      expect(res.amount).toBe(1580);
      expect(res.cardInfo?.lastFour).toBe('4242');
    });

    it('3DS 驗證情境回傳 payment_url', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          msg: 'Success',
          rec_trade_id: 'REC_TRADE_3DS_01',
          payment_url: 'https://sandbox.tappaysdk.com/tpc/3ds/redirect?id=123',
          amount: 2500,
        }),
      });

      const res = await payByPrime(
        {
          prime: 'test_prime_3ds',
          amount: 2500,
          cardholder: {
            phoneNumber: '0988776655',
            name: '陳小美',
            email: 'chen@example.com',
          },
          enable3DS: true,
        },
        { fetcher: mockFetcher, partnerKey: 'test_partner_key' }
      );

      expect(res.paymentUrl).toContain('https://sandbox.tappaysdk.com');
      expect(res.recTradeId).toBe('REC_TRADE_3DS_01');
    });

    it('TapPay 扣款授權失敗 (status != 0)', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 10003,
          msg: 'Card Expired',
          rec_trade_id: 'REC_TRADE_FAIL',
        }),
      });

      const res = await payByPrime(
        {
          prime: 'test_prime_fail',
          amount: 1000,
          cardholder: {
            phoneNumber: '0900000000',
            name: '王大同',
            email: 'wang@example.com',
          },
        },
        { fetcher: mockFetcher, partnerKey: 'test_partner_key' }
      );

      expect(res.status).toBe(10003);
      expect(res.msg).toBe('Card Expired');
    });

    it('查詢交易紀錄 getTradeRecord', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          trade_records: [
            {
              rec_trade_id: 'REC_TRADE_QUERY_1',
              record_status: 0,
              amount: 1980,
              auth_code: 'AUTH_OK',
            },
          ],
        }),
      });

      const record = await getTradeRecord('REC_TRADE_QUERY_1', {
        fetcher: mockFetcher,
        partnerKey: 'test_key',
      });

      expect(record.isPaid).toBe(true);
      expect(record.amount).toBe(1980);
      expect(record.recTradeId).toBe('REC_TRADE_QUERY_1');
    });

    it('執行退款 refundTransaction', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 0,
          msg: 'Success',
          refund_id: 'REF_9999',
          amount: 1980,
        }),
      });

      const refund = await refundTransaction('REC_TRADE_QUERY_1', 1980, {
        fetcher: mockFetcher,
        partnerKey: 'test_key',
      });

      expect(refund.status).toBe(0);
      expect(refund.refundId).toBe('REF_9999');
    });
  });

  describe('2. Shopify Admin & 售價重算模組 (api/_lib/shopify-admin.ts)', () => {
    it('recalculateCheckoutTotal 伺服器端權威金額重算 (滿額免運)', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            nodes: [
              {
                id: 'gid://shopify/ProductVariant/445566',
                title: '50ml',
                availableForSale: true,
                price: { amount: '890.00', currencyCode: 'TWD' },
                product: { id: 'gid://shopify/Product/112233', title: '私密緊緻精華' },
              },
            ],
          },
        }),
      });

      const result = await recalculateCheckoutTotal(
        [{ variantId: 'gid://shopify/ProductVariant/445566', quantity: 2 }],
        { shippingMethodCode: 'STANDARD', configOverride: { fetcher: mockFetcher } }
      );

      expect(result.subtotal).toBe(1780); // 890 * 2
      expect(result.shippingFee).toBe(0); // 滿 1500 免運
      expect(result.totalAmount).toBe(1780);
      expect(result.items[0].productTitle).toBe('私密緊緻精華');
    });

    it('recalculateCheckoutTotal 售罄防護', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            nodes: [
              {
                id: 'gid://shopify/ProductVariant/778899',
                title: '售罄規格',
                availableForSale: false,
                price: { amount: '500.00', currencyCode: 'TWD' },
                product: { id: 'gid://shopify/Product/99', title: '測試商品' },
              },
            ],
          },
        }),
      });

      await expect(
        recalculateCheckoutTotal(
          [{ variantId: 'gid://shopify/ProductVariant/778899', quantity: 1 }],
          { configOverride: { fetcher: mockFetcher } }
        )
      ).rejects.toThrow('售罄');
    });

    it('createShopifyOrder 建立訂單並附帶 note_attributes (卡號零落地)', async () => {
      const mockFetcher = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          order: {
            id: 9988776655,
            order_number: 1088,
            name: '#1088',
            total_price: '1780.00',
            financial_status: 'paid',
          },
        }),
      });

      const order = await createShopifyOrder(
        {
          items: [{ variantId: '445566', quantity: 2, price: 890 }],
          customer: { email: 'test@saengak.com.tw', firstName: '小美' },
          shippingAddress: {
            firstName: '小美',
            lastName: '林',
            phone: '0912345678',
            address1: '信義路五段7號',
            city: '台北市',
          },
          shippingFee: 0,
          transactionId: 'REC_TRADE_1001',
          idempotencyKey: 'idemp-uuid-1234-5678-90ab',
        },
        { fetcher: mockFetcher, adminAccessToken: 'shpat_test' }
      );

      expect(order.id).toBe('gid://shopify/Order/9988776655');
      expect(order.orderNumber).toBe('1088');
      expect(order.financialStatus).toBe('paid');
    });
  });

  describe('3. 結帳主 API (api/checkout.ts)', () => {
    it('非白名單 Origin 應回傳 403 Forbidden', async () => {
      const req = new Request('https://saengak.com.tw/api/checkout', {
        method: 'POST',
        headers: {
          Origin: 'https://malicious-site.com',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idemp-test-origin-0001',
        },
        body: JSON.stringify({}),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(403);
    });

    it('Fail-Closed 開關關閉時回傳 503 維護提示', async () => {
      process.env.CHECKOUT_RELEASE_ENABLED = 'false';

      const req = new Request('https://saengak.com.tw/api/checkout', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idemp-test-fail-closed-0001',
        },
        body: JSON.stringify({}),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.code).toBe('CHECKOUT_DISABLED');
    });

    it('缺少 Idempotency-Key 應回傳 400 Bad Request', async () => {
      const req = new Request('https://saengak.com.tw/api/checkout', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(400);
    });

    it('相同 Idempotency-Key 傳遞不同 Payload 應回傳 422 Unprocessable Entity', async () => {
      const key = 'idemp-mismatch-test-123456';
      await createTransactionLog({
        idempotency_key: key,
        payload_hash: 'existing_hash_aaa',
        user_identifier: 'test@saengak.com.tw',
        status: 'INITIATED',
        amount: 1000,
      });

      const req = new Request('https://saengak.com.tw/api/checkout', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          prime: 'prime_xyz',
          items: [{ variantId: '123', quantity: 1 }],
          customer: { email: 'test@saengak.com.tw' },
          shippingAddress: { firstName: '王', address1: '信義路' },
        }),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    });

    it('相同 Idempotency-Key 僅變更發票抬頭/統編亦應被視為 Payload 竄改 (422)', async () => {
      const key = 'idemp-invoice-mismatch-654321';
      await createTransactionLog({
        idempotency_key: key,
        payload_hash: 'existing_hash_bbb',
        user_identifier: 'test@saengak.com.tw',
        status: 'INITIATED',
        amount: 1000,
      });

      const req = new Request('https://saengak.com.tw/api/checkout', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          prime: 'prime_xyz',
          items: [{ variantId: '123', quantity: 1 }],
          customer: { email: 'test@saengak.com.tw' },
          shippingAddress: { firstName: '王', address1: '信義路' },
          invoicePreference: { kind: 'company', taxId: '12345678' },
        }),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(422);
      const data = await res.json();
      expect(data.code).toBe('IDEMPOTENCY_PAYLOAD_MISMATCH');
    });

    it('金流授權成功 -> 建單成功 -> 寫入發票 Outbox (Happy Path 整合測試)', async () => {
      const key = 'idemp-happy-path-001';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('graphql.json')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                nodes: [
                  {
                    id: 'gid://shopify/ProductVariant/1001',
                    title: '30ml',
                    availableForSale: true,
                    price: { amount: '990.00', currencyCode: 'TWD' },
                    product: { id: 'gid://shopify/Product/1', title: '測試商品' },
                  },
                ],
              },
            }),
          } as Response;
        }
        if (urlStr.includes('pay-by-prime')) {
          return {
            ok: true,
            json: async () => ({
              status: 0,
              msg: 'Success',
              rec_trade_id: 'REC_HAPPY_001',
              amount: 1090,
            }),
          } as Response;
        }
        if (urlStr.includes('orders.json')) {
          return {
            ok: true,
            json: async () => ({
              order: {
                id: 5551234,
                order_number: 3001,
                name: '#3001',
                total_price: '1090.00',
                financial_status: 'paid',
              },
            }),
          } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
      });

      const req = new Request('https://saengak.com.tw/api/checkout', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          prime: 'prime_happy',
          items: [{ variantId: 'gid://shopify/ProductVariant/1001', quantity: 1 }],
          customer: { email: 'happy@saengak.com.tw' },
          shippingAddress: { firstName: '美麗', address1: '信義路五段7號', city: '台北市' },
        }),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.status).toBe('ORDER_CREATED');
      expect(data.orderId).toBe('gid://shopify/Order/5551234');
      expect(data.amount).toBe(1090); // 990 (subtotal) + 100 (未滿 1500 之標準運費)

      const log = await getTransactionLog(key);
      expect(log?.status).toBe('ORDER_CREATED');
      expect(log?.shopify_order_id).toBe('gid://shopify/Order/5551234');

      fetchSpy.mockRestore();
    });

    it('金流授權成功但 Shopify 建單失敗 -> 自動觸發 TapPay 退款補償 (COMPENSATED)', async () => {
      const key = 'idemp-compensation-001';

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('graphql.json')) {
          return {
            ok: true,
            json: async () => ({
              data: {
                nodes: [
                  {
                    id: 'gid://shopify/ProductVariant/2002',
                    title: '50ml',
                    availableForSale: true,
                    price: { amount: '1600.00', currencyCode: 'TWD' },
                    product: { id: 'gid://shopify/Product/2', title: '測試商品B' },
                  },
                ],
              },
            }),
          } as Response;
        }
        if (urlStr.includes('pay-by-prime')) {
          return {
            ok: true,
            json: async () => ({
              status: 0,
              msg: 'Success',
              rec_trade_id: 'REC_COMPENSATE_001',
              amount: 1600,
            }),
          } as Response;
        }
        if (urlStr.includes('orders.json')) {
          // 模擬 Shopify 建單失敗
          return { ok: false, status: 500, text: async () => 'Internal Server Error' } as Response;
        }
        if (urlStr.includes('refund')) {
          return {
            ok: true,
            json: async () => ({ status: 0, msg: 'Success', refund_id: 'REF_COMPENSATE_001' }),
          } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
      });

      const req = new Request('https://saengak.com.tw/api/checkout', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          prime: 'prime_compensate',
          items: [{ variantId: 'gid://shopify/ProductVariant/2002', quantity: 1 }],
          customer: { email: 'compensate@saengak.com.tw' },
          shippingAddress: { firstName: '小明', address1: '中山路一段1號', city: '台北市' },
        }),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.code).toBe('ORDER_CREATION_FAILED');

      const log = await getTransactionLog(key);
      expect(log?.status).toBe('COMPENSATED');

      fetchSpy.mockRestore();
    });
  });

  describe('4. 3DS Callback 與確認 API (api/checkout/confirm.ts)', () => {
    it('3DS 回調二次向 TapPay Record 查核成功後建單', async () => {
      const key = 'idemp-3ds-confirm-001';
      await createTransactionLog({
        idempotency_key: key,
        payload_hash: 'hash_123',
        user_identifier: '3ds_user@saengak.com.tw',
        status: 'INITIATED',
        tappay_rec_trade_id: 'REC_TRADE_3DS_OK',
        amount: 1800,
        payload: {
          items: [{ variantId: '112233', quantity: 1 }],
          shippingFee: 0,
        },
      });

      // 模擬 fetch: 先查 TapPay Record API 成功，再建立 Shopify Order
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('trade-history') || urlStr.includes('record')) {
          return {
            ok: true,
            json: async () => ({
              status: 0,
              trade_records: [
                {
                  rec_trade_id: 'REC_TRADE_3DS_OK',
                  record_status: 0,
                  amount: 1800,
                  auth_code: '3DS_AUTH_99',
                },
              ],
            }),
          } as Response;
        }
        if (urlStr.includes('orders.json')) {
          return {
            ok: true,
            json: async () => ({
              order: {
                id: 88889999,
                order_number: 2001,
                name: '#2001',
                total_price: '1800.00',
                financial_status: 'paid',
              },
            }),
          } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
      });

      const req = new Request('https://saengak.com.tw/api/checkout/confirm', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          rec_trade_id: 'REC_TRADE_3DS_OK',
          idempotencyKey: key,
        }),
      });

      const res = await confirmHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.status).toBe('ORDER_CREATED');
      expect(data.orderNumber).toBe('2001');

      const log = await getTransactionLog(key);
      expect(log?.status).toBe('ORDER_CREATED');
      expect(log?.shopify_order_id).toBe('gid://shopify/Order/88889999');

      fetchSpy.mockRestore();
    });
  });

  describe('5. 交易狀態查詢 API (api/checkout/status.ts)', () => {
    it('以 idempotency_key 查詢交易進度 (安全脫敏)', async () => {
      const key = 'idemp-status-query-123456';
      await createTransactionLog({
        idempotency_key: key,
        payload_hash: 'hash_test',
        user_identifier: 'user@example.com',
        status: 'ORDER_CREATED',
        shopify_order_id: 'gid://shopify/Order/77777',
        amount: 2100,
      });

      const req = new Request(`https://saengak.com.tw/api/checkout/status?idempotency_key=${key}`, {
        method: 'GET',
        headers: {
          Origin: 'https://saengak.com.tw',
        },
      });

      const res = await statusHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('ORDER_CREATED');
      expect(data.orderId).toBe('gid://shopify/Order/77777');
      expect(data.amount).toBe(2100);
      // 確保無卡號或 Prime 欄位洩漏
      expect(data.prime).toBeUndefined();
      expect(data.card_number).toBeUndefined();
    });
  });

  describe('6. 光貿電子發票 Worker API (api/invoice/guangmao.ts)', () => {
    it('未授權呼叫應回傳 401', async () => {
      process.env.AmegoDispatchToken = 'super_secret_dispatch_token_1234567890';

      const req = new Request('https://saengak.com.tw/api/invoice/guangmao', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid_token',
        },
      });

      const res = await invoiceHandler(req);
      expect(res.status).toBe(401);
    });
  });

  describe('7. Shopify Webhook 處理 API (api/webhooks/shopify.ts)', () => {
    it('verifyShopifyHmac 正確驗證 HMAC 簽章', () => {
      const secret = 'test_webhook_secret_key';
      const body = JSON.stringify({ id: 123456, total_price: '1000' });
      const validHmac = createHmac('sha256', secret).update(body, 'utf8').digest('base64');

      expect(verifyShopifyHmac(body, validHmac, secret)).toBe(true);
      expect(verifyShopifyHmac(body, 'invalid_hmac', secret)).toBe(false);
    });

    it('非授權商店網域應回傳 403 Forbidden', async () => {
      const req = new Request('https://saengak.com.tw/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'x-shopify-topic': 'orders/create',
          'x-shopify-shop-domain': 'other-malicious-store.myshopify.com',
          'x-shopify-webhook-id': 'e1b2c3d4-0000-0000-0000-000000000001',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: 12345 }),
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(403);
    });
  });

  describe('8. 對帳與分散式補償排程 (api/cron/reconcile.ts)', () => {
    it('未提供正確 CRON_SECRET 回傳 401', async () => {
      process.env.CRON_SECRET = 'valid_cron_secret_key';

      const req = new Request('https://saengak.com.tw/api/cron/reconcile', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer wrong_key',
        },
      });

      const res = await cronReconcileHandler(req);
      expect(res.status).toBe(401);
    });

    it('逾時扣款但無訂單之交易自動執行 TapPay Refund 補償', async () => {
      process.env.CRON_SECRET = 'valid_cron_secret_key';

      const staleKey = 'idemp-stale-payment-captured';
      await createTransactionLog({
        idempotency_key: staleKey,
        payload_hash: 'hash_stale',
        user_identifier: 'stale_user@example.com',
        status: 'PAYMENT_CAPTURED',
        tappay_rec_trade_id: 'REC_TRADE_STALE_01',
        amount: 2800,
        updated_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 分鐘前
      });

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
        const urlStr = String(url);
        if (urlStr.includes('trade-history') || urlStr.includes('record')) {
          return {
            ok: true,
            json: async () => ({
              status: 0,
              trade_records: [
                {
                  rec_trade_id: 'REC_TRADE_STALE_01',
                  record_status: 0,
                  amount: 2800,
                },
              ],
            }),
          } as Response;
        }
        if (urlStr.includes('refund')) {
          return {
            ok: true,
            json: async () => ({
              status: 0,
              msg: 'Success',
              refund_id: 'REF_STALE_COMPENSATION',
            }),
          } as Response;
        }
        return { ok: true, json: async () => ({}) } as Response;
      });

      const req = new Request('https://saengak.com.tw/api/cron/reconcile', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer valid_cron_secret_key',
        },
      });

      const res = await cronReconcileHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.summary.compensated).toBe(1);

      const log = await getTransactionLog(staleKey);
      expect(log?.status).toBe('COMPENSATED');

      fetchSpy.mockRestore();
    });
  });

  describe('9. Fail-Closed 迴歸測試 (防止安全檢查在密鑰缺失時靜默放行)', () => {
    it('isOriginAllowed: 缺少 Origin 標頭時應拒絕而非放行', async () => {
      const req = new Request('https://saengak.com.tw/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'idemp-no-origin-header-0001',
          // 刻意不帶 Origin 標頭 (模擬非瀏覽器的伺服器對伺服器呼叫)
        },
        body: JSON.stringify({}),
      });

      const res = await checkoutHandler(req);
      expect(res.status).toBe(403);
    });

    it('Webhook: SHOPIFY_WEBHOOK_SECRET 未設定時應拒絕而非跳過簽章驗證', async () => {
      delete process.env.SHOPIFY_WEBHOOK_SECRET;
      delete process.env.ShopifyWebhookSecret;

      const req = new Request('https://saengak.com.tw/api/webhooks/shopify', {
        method: 'POST',
        headers: {
          'x-shopify-topic': 'orders/create',
          'x-shopify-shop-domain': 'gh2xgs-zf.myshopify.com',
          'x-shopify-webhook-id': 'audit-regression-0001',
          'Content-Type': 'application/json',
          // 刻意不帶 x-shopify-hmac-sha256 標頭
        },
        body: JSON.stringify({ id: 1 }),
      });

      const res = await webhookHandler(req);
      expect(res.status).toBe(500);
      expect(res.status).not.toBe(200);
    });

    it('Cron Reconcile: CRON_SECRET 未設定時應拒絕而非放行任意呼叫者觸發退款補償', async () => {
      delete process.env.CRON_SECRET;

      const req = new Request('https://saengak.com.tw/api/cron/reconcile', {
        method: 'POST',
        // 刻意不帶 Authorization 標頭
      });

      const res = await cronReconcileHandler(req);
      expect(res.status).toBe(500);
      expect(res.status).not.toBe(200);
    });

    it('Invoice Guangmao: AmegoDispatchToken 與 CRON_SECRET 皆未設定時應拒絕', async () => {
      delete process.env.AmegoDispatchToken;
      delete process.env.CRON_SECRET;

      const req = new Request('https://saengak.com.tw/api/invoice/guangmao', {
        method: 'POST',
        // 刻意不帶 Authorization 標頭
      });

      const res = await invoiceHandler(req);
      expect(res.status).toBe(500);
      expect(res.status).not.toBe(200);
    });
  });
});
