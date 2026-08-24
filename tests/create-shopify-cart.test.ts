import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

vi.mock('../api/_lib/supabase-admin.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/_lib/supabase-admin.js')>();
  return {
    ...actual,
    getSupabaseAdminClient: mocks.getSupabaseAdminClient,
  };
});

import { POST, OPTIONS } from '../api/create-shopify-cart.js';
import {
  setMemorySiteSetting,
  resetMemoryDatabase,
} from '../api/_lib/supabase-admin.js';

describe('SAENGAK Shopify Cart 結帳 API 整合與維護模式測試 (api/create-shopify-cart.ts)', () => {
  beforeEach(() => {
    resetMemoryDatabase();
    delete process.env.MAINTENANCE_MODE;
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-publishable-key';
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'member-123' } },
          error: null,
        }),
      },
    });
    mocks.getSupabaseAdminClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  describe('1. OPTIONS 與 CORS 權限檢查', () => {
    it('允許合規 Origin 之 OPTIONS 預檢請求 (204)', async () => {
      const request = new Request('http://localhost/api/create-shopify-cart', {
        method: 'OPTIONS',
        headers: { Origin: 'https://saengak.com.tw' },
      });
      const response = await OPTIONS(request);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://saengak.com.tw');
    });

    it('拒絕非法 Origin 跨域請求 (403)', async () => {
      const request = new Request('http://localhost/api/create-shopify-cart', {
        method: 'POST',
        headers: { Origin: 'https://malicious-phishing.com' },
      });
      const response = await POST(request);
      expect(response.status).toBe(403);
    });
  });

  describe('2. 全站維護模式防護 (00_DECISION_LOG §3.3)', () => {
    it('當 site_settings 設定 maintenance_mode = true 時，拒絕結帳並回傳 503 MAINTENANCE_MODE_ACTIVE', async () => {
      setMemorySiteSetting('maintenance_mode', true);

      const request = new Request('http://localhost/api/create-shopify-cart', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-member-token',
        },
        body: JSON.stringify({
          lines: [
            {
              merchandiseId: 'gid://shopify/ProductVariant/1234567890',
              quantity: 1,
            },
          ],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.code).toBe('MAINTENANCE_MODE_ACTIVE');
      expect(data.error).toContain('全站維護中');
    });
  });

  describe('3. 購物車輸入校驗與發票偏好驗證', () => {
    it('購物車品項為空陣列時回傳 400', async () => {
      const request = new Request('http://localhost/api/create-shopify-cart', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-member-token',
        },
        body: JSON.stringify({
          lines: [],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Invalid checkout input');
    });

    it('未登入用戶無論發票偏好為何皆回傳 401 MEMBER_LOGIN_REQUIRED', async () => {
      const request = new Request('http://localhost/api/create-shopify-cart', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lines: [
            {
              merchandiseId: 'gid://shopify/ProductVariant/1234567890',
              quantity: 1,
            },
          ],
          invoicePreference: {
            kind: 'company',
            taxId: '24549210',
            buyerName: '聯發科技股份有限公司',
            notificationEmail: 'finance@mediatek.com',
          },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.code).toBe('MEMBER_LOGIN_REQUIRED');
    });
  });

  describe('4. Shopify Storefront GraphQL 互動與錯誤處理', () => {
    it('成功建立 Shopify Cart 並回傳 checkoutUrl 與 cartId (200)', async () => {
      // Mock global fetch
      const mockCheckoutUrl = 'https://gh2xgs-zf.myshopify.com/checkouts/cn/test-checkout-session';
      const mockCartId = 'gid://shopify/Cart/c1-9876543210';

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            cartCreate: {
              cart: {
                id: mockCartId,
                checkoutUrl: mockCheckoutUrl,
                totalQuantity: 2,
              },
              userErrors: [],
              warnings: [],
            },
          },
        }),
      } as any);

      const request = new Request('http://localhost/api/create-shopify-cart', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-member-token',
        },
        body: JSON.stringify({
          lines: [
            {
              merchandiseId: 'gid://shopify/ProductVariant/1234567890',
              quantity: 2,
            },
          ],
          invoicePreference: {
            kind: 'personal',
            carrier: 'none',
            carrierId: '',
          },
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.checkoutUrl).toBe(mockCheckoutUrl);
      expect(data.cartId).toBe(mockCartId);
      expect(data.totalQuantity).toBe(2);
    });

    it('當 Shopify 回報 Online Store Locked 時，轉譯為 503 SHOPIFY_STOREFRONT_LOCKED', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          errors: [
            {
              message: 'Online store channel is locked by password',
            },
          ],
        }),
      } as any);

      const request = new Request('http://localhost/api/create-shopify-cart', {
        method: 'POST',
        headers: {
          Origin: 'https://saengak.com.tw',
          'Content-Type': 'application/json',
          Authorization: 'Bearer valid-member-token',
        },
        body: JSON.stringify({
          lines: [
            {
              merchandiseId: 'gid://shopify/ProductVariant/1234567890',
              quantity: 1,
            },
          ],
        }),
      });

      const response = await POST(request);
      expect(response.status).toBe(503);
      const data = await response.json();
      expect(data.code).toBe('SHOPIFY_STOREFRONT_LOCKED');
    });
  });
});
