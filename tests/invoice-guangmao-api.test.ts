import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AmegoJob } from '../supabase/functions/amego-invoice-dispatch/amego.js';

/**
 * 這些測試只驗證 `api/invoice/guangmao.ts` 這個 Worker 外層的授權與認領迴圈邏輯
 * （對應稽核報告 P0-2／P0-3），刻意把光貿派送邏輯 (`dispatchAmegoJob`) 整個 mock 掉：
 *
 * 1. `dispatchAmegoJob` 的內部行為（簽章、payload 組裝、回讀比對）已由
 *    `supabase/functions/amego-invoice-dispatch/amego.test.ts` 完整覆蓋，無需重複測試。
 * 2. **本檔案全程不得對真實光貿 API (`https://invoice-api.amego.tw`) 或任何網路發出請求**——
 *    這支 API 串接的是正式環境（無獨立 sandbox host，僅以測試統編區分），一旦不慎打到真實
 *    端點就可能觸發真實開票。因此除了 mock `dispatchAmegoJob` 本身之外，也額外 stub 了全域
 *    `fetch` 並在每個測試斷言其從未被呼叫，形成雙重保險。
 */

const mocks = vi.hoisted(() => ({
  getSupabaseAdminClient: vi.fn(),
  updateTransactionLog: vi.fn(),
  dispatchAmegoJob: vi.fn(),
}));

vi.mock('../api/_lib/supabase-admin.js', () => ({
  getSupabaseAdminClient: mocks.getSupabaseAdminClient,
  updateTransactionLog: mocks.updateTransactionLog,
}));

vi.mock('../supabase/functions/amego-invoice-dispatch/amego.js', () => ({
  dispatchAmegoJob: mocks.dispatchAmegoJob,
}));

import vercelHandler from '../api/invoice/guangmao.js';

const DISPATCH_TOKEN = 'fixture-only-dispatch-token-never-real';
const CRON_TOKEN = 'fixture-only-cron-secret-never-real';

function buildJob(overrides: Partial<AmegoJob> = {}): AmegoJob {
  return {
    job_id: 'job-1',
    shopify_order_gid: 'gid://shopify/Order/1001',
    amego_order_id: 'S1001',
    operation: 'issue',
    request_payload: {
      currencyCode: 'TWD',
      totalAmount: 680,
      lineItems: [{ productName: '深層修護私密清潔露', quantity: 1, price: '680' }],
      preference: { kind: 'personal', notificationEmail: 'buyer@example.test', carrier: 'none', carrierId: '' },
    },
    expected_total_amount: 680,
    expected_buyer_identifier: '0000000000',
    provider_invoice_number: null,
    mutation_accepted: false,
    lease_token: 'lease-1',
    attempts: 1,
    ...overrides,
  };
}

/**
 * 依序 mock 多次 `claim_amego_invoice_job` 呼叫的回傳值（模擬 Outbox 依序被淨空的過程）。
 * `complete_amego_invoice_job` / `mark_amego_invoice_mutation_started` 一律回傳成功。
 */
function createAdminClientMock(claimQueue: Array<AmegoJob[]>) {
  let claimCallIndex = 0;
  const rpc = vi.fn(async (fnName: string) => {
    if (fnName === 'claim_amego_invoice_job') {
      const jobs = claimQueue[claimCallIndex] ?? [];
      claimCallIndex += 1;
      return { data: jobs, error: null };
    }
    return { data: null, error: null };
  });
  const eq = vi.fn().mockResolvedValue({ data: [] });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { rpc, from, eq, select };
}

function request(options: {
  method?: 'GET' | 'POST';
  token?: string;
  body?: Record<string, unknown>;
} = {}): Request {
  const headers: Record<string, string> = {};
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  if (options.body) headers['content-type'] = 'application/json';
  return new Request('https://saengak.com.tw/api/invoice/guangmao', {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

describe('光貿發票 Worker API (api/invoice/guangmao.ts)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();

    // 絕對防線：即便程式邏輯或 mock 有誤導致真的呼叫到 fetch，也只會打到這支從不連網的假函式。
    fetchMock = vi.fn().mockRejectedValue(new Error('測試環境嚴禁對外發出任何真實網路請求'));
    vi.stubGlobal('fetch', fetchMock);

    delete process.env.AmegoDispatchToken;
    delete process.env.CRON_SECRET;
    process.env.AmegoInvoiceReleaseEnabled = 'true';
    mocks.getSupabaseAdminClient.mockReturnValue(null);
    mocks.dispatchAmegoJob.mockReset();
    mocks.updateTransactionLog.mockResolvedValue(null);
  });

  describe('P0-2：授權金鑰 Fail-Closed 與雙金鑰接受', () => {
    it('兩把金鑰皆未設定時一律回 500 拒絕（Fail-Closed），且不觸碰資料庫或網路', async () => {
      const response = await vercelHandler.fetch(request({ token: 'anything' }));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(500);
      expect(data.error).toBeTruthy();
      expect(mocks.getSupabaseAdminClient).not.toHaveBeenCalled();
      expect(mocks.dispatchAmegoJob).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('呼叫端帶的 token 與兩把金鑰皆不相符時回 401', async () => {
      process.env.AmegoDispatchToken = DISPATCH_TOKEN;
      process.env.CRON_SECRET = CRON_TOKEN;

      const response = await vercelHandler.fetch(request({ token: 'not-the-right-token' }));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(401);
      expect(data.error).toBeTruthy();
      expect(mocks.dispatchAmegoJob).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('回歸測試：即使 AmegoDispatchToken 也已設定，仍必須接受相符的 CRON_SECRET（Vercel Cron 實際送出的金鑰）', async () => {
      process.env.AmegoDispatchToken = DISPATCH_TOKEN;
      process.env.CRON_SECRET = CRON_TOKEN;
      mocks.getSupabaseAdminClient.mockReturnValue(createAdminClientMock([[]]));

      const response = await vercelHandler.fetch(request({ token: CRON_TOKEN }));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('向下相容：兩把金鑰皆設定時，舊有的 AmegoDispatchToken 仍必須被接受', async () => {
      process.env.AmegoDispatchToken = DISPATCH_TOKEN;
      process.env.CRON_SECRET = CRON_TOKEN;
      mocks.getSupabaseAdminClient.mockReturnValue(createAdminClientMock([[]]));

      const response = await vercelHandler.fetch(request({ token: DISPATCH_TOKEN }));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('只設定其中一把金鑰時，僅該把金鑰能通過驗證', async () => {
      process.env.CRON_SECRET = CRON_TOKEN;
      mocks.getSupabaseAdminClient.mockReturnValue(createAdminClientMock([[]]));

      const response = await vercelHandler.fetch(request({ token: CRON_TOKEN }));
      expect(response.status).toBe(200);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('發票開立閘門關閉時回 503，且不觸碰網路', async () => {
      process.env.AmegoDispatchToken = DISPATCH_TOKEN;
      process.env.AmegoInvoiceReleaseEnabled = 'false';

      const response = await vercelHandler.fetch(request({ token: DISPATCH_TOKEN }));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(503);
      expect(data.error).toBeTruthy();
      expect(mocks.dispatchAmegoJob).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('P0-3：單次呼叫應持續認領直到 Outbox 淨空，而非只處理 1 筆', () => {
    beforeEach(() => {
      process.env.AmegoDispatchToken = DISPATCH_TOKEN;
    });

    it('目前無待處理任務時，僅嘗試認領一次即回報「無待處理任務」', async () => {
      const admin = createAdminClientMock([[]]);
      mocks.getSupabaseAdminClient.mockReturnValue(admin);

      const response = await vercelHandler.fetch(request({ token: DISPATCH_TOKEN }));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(data.message).toContain('目前無待處理的發票任務');
      expect(admin.rpc).toHaveBeenCalledTimes(1);
      expect(mocks.dispatchAmegoJob).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('回歸測試：Outbox 有 2 筆待處理任務時，單次呼叫（模擬 Vercel Cron 的 GET 觸發）必須全部處理完，而非只處理第 1 筆就停手', async () => {
      const job1 = buildJob({ job_id: 'job-1', shopify_order_gid: 'gid://shopify/Order/1001', lease_token: 'lease-1' });
      const job2 = buildJob({ job_id: 'job-2', shopify_order_gid: 'gid://shopify/Order/1002', lease_token: 'lease-2' });
      const admin = createAdminClientMock([[job1], [job2], []]);
      admin.eq.mockResolvedValue({ data: [{ idempotency_key: 'idem-1001' }] });
      mocks.getSupabaseAdminClient.mockReturnValue(admin);

      mocks.dispatchAmegoJob.mockImplementation(async (job: AmegoJob) => {
        if (job.job_id === 'job-1') {
          return { outcome: 'issued', invoiceNumber: 'AB12345678', providerStatus: 99, providerUpdatedAt: '2026-09-07T00:00:00.000Z' };
        }
        return { outcome: 'failed', errorCode: 'AMEGO_99', errorMessage: '模擬終態失敗', retryable: false };
      });

      // Vercel Cron 一律以 GET 觸發且不帶 body，對應現行 vercel.json 的每日排程情境。
      const response = await vercelHandler.fetch(request({ method: 'GET', token: DISPATCH_TOKEN }));
      const data = await response.json() as Record<string, unknown>;

      // 認領 3 次：job-1、job-2、最後一次回傳空陣列代表 Outbox 已淨空，迴圈才停止。
      expect(admin.rpc).toHaveBeenCalledWith('claim_amego_invoice_job', { p_shopify_order_gid: null });
      const claimCalls = admin.rpc.mock.calls.filter((call) => call[0] === 'claim_amego_invoice_job');
      expect(claimCalls).toHaveLength(3);

      // 兩筆 job 都應該被實際派送，而不是只派送第一筆。
      expect(mocks.dispatchAmegoJob).toHaveBeenCalledTimes(2);
      expect(mocks.dispatchAmegoJob.mock.calls[0][0].job_id).toBe('job-1');
      expect(mocks.dispatchAmegoJob.mock.calls[1][0].job_id).toBe('job-2');

      // 兩筆 job 都應該各自呼叫 complete_amego_invoice_job 收尾，且 outcome 正確映射。
      const completeCalls = admin.rpc.mock.calls.filter((call) => call[0] === 'complete_amego_invoice_job');
      expect(completeCalls).toHaveLength(2);
      expect(completeCalls[0][1]).toMatchObject({ p_job_id: 'job-1', p_outcome: 'issued', p_invoice_number: 'AB12345678' });
      expect(completeCalls[1][1]).toMatchObject({ p_job_id: 'job-2', p_outcome: 'failed_terminal' });

      // 開立成功的 job-1 應觸發 transaction_logs 投影更新。
      expect(mocks.updateTransactionLog).toHaveBeenCalledWith('idem-1001', {
        status: 'INVOICE_ISSUED',
        invoice_id: 'AB12345678',
      });

      // 回應摘要正確反映本次共處理 2 筆，且保留首筆頂層欄位供既有呼叫端相容讀取。
      expect(data.ok).toBe(true);
      expect(data.processedCount).toBe(2);
      expect(data.jobId).toBe('job-1');
      expect(data.outcome).toBe('issued');
      expect(Array.isArray(data.jobs)).toBe(true);
      expect((data.jobs as unknown[]).length).toBe(2);

      // 全程仍未對外發出任何真實網路請求（dispatchAmegoJob 本身已被 mock 取代）。
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('指定 shopifyOrderGid 時只處理該筆訂單，不會連帶淨空其餘 Outbox 積壓任務', async () => {
      const targetJob = buildJob({ job_id: 'job-1', shopify_order_gid: 'gid://shopify/Order/1001' });
      const otherJob = buildJob({ job_id: 'job-2', shopify_order_gid: 'gid://shopify/Order/9999' });
      // 即使佇列裡「還有」下一筆工作，指定單一訂單時也不應該再多認領一次。
      const admin = createAdminClientMock([[targetJob], [otherJob]]);
      mocks.getSupabaseAdminClient.mockReturnValue(admin);
      mocks.dispatchAmegoJob.mockResolvedValue({
        outcome: 'provider_pending',
        errorCode: 'PROVIDER_PENDING',
        mutationAccepted: false,
      });

      const response = await vercelHandler.fetch(request({
        method: 'POST',
        token: DISPATCH_TOKEN,
        body: { shopifyOrderGid: 'gid://shopify/Order/1001' },
      }));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(admin.rpc).toHaveBeenCalledWith('claim_amego_invoice_job', { p_shopify_order_gid: 'gid://shopify/Order/1001' });
      const claimCalls = admin.rpc.mock.calls.filter((call) => call[0] === 'claim_amego_invoice_job');
      expect(claimCalls).toHaveLength(1);
      expect(mocks.dispatchAmegoJob).toHaveBeenCalledTimes(1);
      expect(mocks.dispatchAmegoJob.mock.calls[0][0].job_id).toBe('job-1');
      expect(data.processedCount).toBe(1);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('Supabase 服務金鑰未設定時安全降級為 Mock Mode，不嘗試認領任何工作', async () => {
      mocks.getSupabaseAdminClient.mockReturnValue(null);

      const response = await vercelHandler.fetch(request({ token: DISPATCH_TOKEN }));
      const data = await response.json() as Record<string, unknown>;

      expect(response.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(mocks.dispatchAmegoJob).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('SEC-6：Amego 憑證 Fail-Closed（AmegoSellerTaxId／AmegoAppKey 缺漏時嚴禁靜默補上硬編測試值）', () => {
    beforeEach(() => {
      process.env.AmegoDispatchToken = DISPATCH_TOKEN;
    });

    it('AmegoSellerTaxId 與 AmegoAppKey 均未設定時回 500，且不觸碰資料庫、不派送任何 job、不對外發出網路請求', async () => {
      const originalSellerTaxId = process.env.AmegoSellerTaxId;
      const originalAppKey = process.env.AmegoAppKey;
      delete process.env.AmegoSellerTaxId;
      delete process.env.AmegoAppKey;

      try {
        const response = await vercelHandler.fetch(request({ token: DISPATCH_TOKEN }));
        const data = await response.json() as Record<string, unknown>;

        expect(response.status).toBe(500);
        expect(data.error).toBeTruthy();
        expect(mocks.getSupabaseAdminClient).not.toHaveBeenCalled();
        expect(mocks.dispatchAmegoJob).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        if (originalSellerTaxId === undefined) delete process.env.AmegoSellerTaxId;
        else process.env.AmegoSellerTaxId = originalSellerTaxId;
        if (originalAppKey === undefined) delete process.env.AmegoAppKey;
        else process.env.AmegoAppKey = originalAppKey;
      }
    });

    it('僅 AmegoSellerTaxId 缺漏（AmegoAppKey 已設定）時仍視為憑證不齊全，回 500 並拒絕派送', async () => {
      const originalSellerTaxId = process.env.AmegoSellerTaxId;
      const originalAppKey = process.env.AmegoAppKey;
      delete process.env.AmegoSellerTaxId;
      process.env.AmegoAppKey = 'fixture-only-app-key-never-real';

      try {
        const response = await vercelHandler.fetch(request({ token: DISPATCH_TOKEN }));
        const data = await response.json() as Record<string, unknown>;

        expect(response.status).toBe(500);
        expect(data.error).toBeTruthy();
        expect(mocks.dispatchAmegoJob).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        if (originalSellerTaxId === undefined) delete process.env.AmegoSellerTaxId;
        else process.env.AmegoSellerTaxId = originalSellerTaxId;
        if (originalAppKey === undefined) delete process.env.AmegoAppKey;
        else process.env.AmegoAppKey = originalAppKey;
      }
    });

    it('僅 AmegoAppKey 缺漏（AmegoSellerTaxId 已設定）時仍視為憑證不齊全，回 500 並拒絕派送', async () => {
      const originalSellerTaxId = process.env.AmegoSellerTaxId;
      const originalAppKey = process.env.AmegoAppKey;
      process.env.AmegoSellerTaxId = 'fixture-only-seller-tax-id-never-real';
      delete process.env.AmegoAppKey;

      try {
        const response = await vercelHandler.fetch(request({ token: DISPATCH_TOKEN }));
        const data = await response.json() as Record<string, unknown>;

        expect(response.status).toBe(500);
        expect(data.error).toBeTruthy();
        expect(mocks.dispatchAmegoJob).not.toHaveBeenCalled();
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        if (originalSellerTaxId === undefined) delete process.env.AmegoSellerTaxId;
        else process.env.AmegoSellerTaxId = originalSellerTaxId;
        if (originalAppKey === undefined) delete process.env.AmegoAppKey;
        else process.env.AmegoAppKey = originalAppKey;
      }
    });
  });
});
