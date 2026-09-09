import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: mocks.createClient,
}));

import { GET, POST } from '../api/admin-users.js';

interface FakeAuthUser {
  id: string;
  email?: string;
  app_metadata?: { role?: string };
  user_metadata?: Record<string, unknown>;
  identities?: unknown[];
  created_at?: string;
  last_sign_in_at?: string;
  phone?: string;
}

/**
 * 組出符合 admin-users.ts 呼叫鏈的 supabaseAdmin mock：
 * .auth.getUser(token)
 * .auth.admin.listUsers()
 * .auth.admin.updateUserById(userId, attrs)
 * .from('profiles').select('*') / .from('user_social_accounts').select('*')
 */
function createSupabaseAdminMock(options: {
  requestingUser?: FakeAuthUser | null;
  getUserError?: any;
  listUsersResult?: { data: { users: FakeAuthUser[] } | null; error: any };
  profilesResult?: { data: any[] | null; error: any };
  socialAccountsResult?: { data: any[] | null; error: any };
  updateUserByIdImpl?: (userId: string, attrs: any) => Promise<{ data: any; error: any }>;
}) {
  const getUser = vi.fn().mockResolvedValue(
    options.getUserError
      ? { data: { user: null }, error: options.getUserError }
      : { data: { user: options.requestingUser ?? null }, error: null },
  );

  const listUsers = vi.fn().mockResolvedValue(
    options.listUsersResult ?? { data: { users: [] }, error: null },
  );

  const updateUserById = options.updateUserByIdImpl
    ? vi.fn(options.updateUserByIdImpl)
    : vi.fn().mockResolvedValue({ data: { user: {} }, error: null });

  const from = vi.fn((table: string) => {
    if (table === 'profiles') {
      return { select: vi.fn().mockResolvedValue(options.profilesResult ?? { data: [], error: null }) };
    }
    if (table === 'user_social_accounts') {
      return { select: vi.fn().mockResolvedValue(options.socialAccountsResult ?? { data: [], error: null }) };
    }
    throw new Error(`Unexpected table in test mock: ${table}`);
  });

  return {
    auth: {
      getUser,
      admin: {
        listUsers,
        updateUserById,
      },
    },
    from,
    __mocks: { getUser, listUsers, updateUserById },
  };
}

const ADMIN_ORIGIN = 'https://saengak.com.tw';

function buildRequest(init: {
  method?: string;
  origin?: string | null;
  authorization?: string | null;
  body?: unknown;
}) {
  const headers: Record<string, string> = {};
  if (init.origin !== null) headers.Origin = init.origin ?? ADMIN_ORIGIN;
  if (init.authorization !== null && init.authorization !== undefined) {
    headers.Authorization = init.authorization;
  }
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';

  return new Request('http://localhost/api/admin-users', {
    method: init.method || 'GET',
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
}

describe('LUCISSI CARE 後台管理員名冊查詢與角色指派 API 測試 (api/admin-users.ts)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SECRET_KEY = 'test-service-role-key';
    mocks.createClient.mockReset();
  });

  describe('1. Origin 防護', () => {
    it('拒絕非白名單 Origin 之跨域請求 (403)，且不觸及 Supabase', async () => {
      const request = buildRequest({ origin: 'https://malicious-phishing.com' });
      const response = await GET(request);

      expect(response.status).toBe(403);
      expect(mocks.createClient).not.toHaveBeenCalled();
    });
  });

  describe('2. 授權驗證', () => {
    it('缺少 Authorization header 時回傳 401', async () => {
      const request = buildRequest({ origin: ADMIN_ORIGIN, authorization: null });
      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('已登入但非 admin 角色時回傳 403', async () => {
      mocks.createClient.mockReturnValue(createSupabaseAdminMock({
        requestingUser: { id: 'member-1', email: 'member@example.com', app_metadata: { role: 'member' } },
      }));

      const request = buildRequest({ origin: ADMIN_ORIGIN, authorization: 'Bearer member-token' });
      const response = await GET(request);

      expect(response.status).toBe(403);
    });
  });

  describe('3. set_role 角色白名單驗證', () => {
    it('帶入不在白名單的角色字串（例如 superadmin）時回傳 400，且不呼叫 updateUserById', async () => {
      const adminMock = createSupabaseAdminMock({
        requestingUser: { id: 'admin-1', email: 'admin@example.com', app_metadata: { role: 'admin' } },
      });
      mocks.createClient.mockReturnValue(adminMock);

      const request = buildRequest({
        method: 'POST',
        origin: ADMIN_ORIGIN,
        authorization: 'Bearer admin-token',
        body: { action: 'set_role', userId: 'target-1', role: 'superadmin' },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(adminMock.__mocks.updateUserById).not.toHaveBeenCalled();
    });
  });

  describe('4. 禁止移除最後一位管理員', () => {
    it('嘗試將系統中唯一一位 admin 改為 member 時被擋下，且不呼叫 updateUserById', async () => {
      const adminMock = createSupabaseAdminMock({
        requestingUser: { id: 'admin-1', email: 'admin@example.com', app_metadata: { role: 'admin' } },
        listUsersResult: {
          data: {
            users: [
              { id: 'admin-1', email: 'admin@example.com', app_metadata: { role: 'admin' } },
              { id: 'member-1', email: 'member@example.com', app_metadata: { role: 'member' } },
            ],
          },
          error: null,
        },
      });
      mocks.createClient.mockReturnValue(adminMock);

      const request = buildRequest({
        method: 'POST',
        origin: ADMIN_ORIGIN,
        authorization: 'Bearer admin-token',
        body: { action: 'set_role', userId: 'admin-1', role: 'member' },
      });
      const response = await POST(request);
      const data = (await response.json()) as any;

      expect([400, 409]).toContain(response.status);
      expect(typeof data.error).toBe('string');
      expect(adminMock.__mocks.updateUserById).not.toHaveBeenCalled();
    });

    it('當系統中還有其他 admin 時，允許將某位 admin 改為 member（不誤擋合法操作）', async () => {
      const adminMock = createSupabaseAdminMock({
        requestingUser: { id: 'admin-1', email: 'admin@example.com', app_metadata: { role: 'admin' } },
        listUsersResult: {
          data: {
            users: [
              { id: 'admin-1', email: 'admin@example.com', app_metadata: { role: 'admin' } },
              { id: 'admin-2', email: 'admin2@example.com', app_metadata: { role: 'admin' } },
            ],
          },
          error: null,
        },
        updateUserByIdImpl: async (userId, attrs) => ({
          data: { user: { id: userId, app_metadata: attrs.app_metadata } },
          error: null,
        }),
      });
      mocks.createClient.mockReturnValue(adminMock);

      const request = buildRequest({
        method: 'POST',
        origin: ADMIN_ORIGIN,
        authorization: 'Bearer admin-token',
        body: { action: 'set_role', userId: 'admin-2', role: 'member' },
      });
      const response = await POST(request);
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(adminMock.__mocks.updateUserById).toHaveBeenCalledWith('admin-2', { app_metadata: { role: 'member' } });
    });
  });

  describe('5. GET 使用者名冊查詢', () => {
    it('正常情境回傳整合後的使用者清單 (success, users, admins, members)', async () => {
      const adminMock = createSupabaseAdminMock({
        requestingUser: { id: 'admin-1', email: 'admin@example.com', app_metadata: { role: 'admin' } },
        listUsersResult: {
          data: {
            users: [
              {
                id: 'admin-1',
                email: 'admin@example.com',
                app_metadata: { role: 'admin' },
                created_at: '2026-01-01T00:00:00Z',
              },
              {
                id: 'member-1',
                email: 'member@example.com',
                app_metadata: { role: 'member' },
                created_at: '2026-02-01T00:00:00Z',
              },
            ],
          },
          error: null,
        },
        profilesResult: {
          data: [
            { id: 'admin-1', name: '系統管理員 Alice', email: 'admin@example.com' },
            { id: 'member-1', name: '會員 Bob', email: 'member@example.com' },
          ],
          error: null,
        },
        socialAccountsResult: { data: [], error: null },
      });
      mocks.createClient.mockReturnValue(adminMock);

      const request = buildRequest({ origin: ADMIN_ORIGIN, authorization: 'Bearer admin-token' });
      const response = await GET(request);
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.users).toHaveLength(2);
      expect(data.admins).toHaveLength(1);
      expect(data.admins[0].id).toBe('admin-1');
      expect(data.members).toHaveLength(1);
      expect(data.members[0].id).toBe('member-1');
    });
  });

  describe('6. 錯誤回應不洩漏內部細節', () => {
    it('listUsers 失敗時回傳通用 500 錯誤，且不包含 Supabase 原始錯誤物件內容（但仍於伺服器端 log）', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const secretDetail = 'SUPABASE_INTERNAL_DETAIL_should_not_leak_12345';

      const adminMock = createSupabaseAdminMock({
        requestingUser: { id: 'admin-1', email: 'admin@example.com', app_metadata: { role: 'admin' } },
        listUsersResult: {
          data: null,
          error: { message: secretDetail, code: 'PGRST999', hint: secretDetail },
        },
      });
      mocks.createClient.mockReturnValue(adminMock);

      const request = buildRequest({ origin: ADMIN_ORIGIN, authorization: 'Bearer admin-token' });
      const response = await GET(request);
      const rawText = await response.text();

      expect(response.status).toBe(500);
      expect(rawText).not.toContain(secretDetail);
      expect(rawText).not.toContain('PGRST999');

      const data = JSON.parse(rawText);
      expect(typeof data.error).toBe('string');
      expect(data.details).toBeUndefined();

      // 內部細節仍應於伺服器端 log 以利除錯，只是不得回傳給客戶端
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('Token 驗證失敗時回傳通用 401 錯誤，且不包含 Supabase 原始錯誤物件內容', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const secretDetail = 'SUPABASE_TOKEN_ERROR_DETAIL_should_not_leak_67890';

      mocks.createClient.mockReturnValue(createSupabaseAdminMock({
        getUserError: { message: secretDetail, code: 'invalid_token' },
      }));

      const request = buildRequest({ origin: ADMIN_ORIGIN, authorization: 'Bearer bad-token' });
      const response = await GET(request);
      const rawText = await response.text();

      expect(response.status).toBe(401);
      expect(rawText).not.toContain(secretDetail);

      const data = JSON.parse(rawText);
      expect(data.details).toBeUndefined();
    });
  });
});
