import { createClient } from '@supabase/supabase-js';
import { isOriginAllowed } from './_lib/security.js';

/**
 * app_metadata.role 白名單。
 * 全專案目前僅實際使用 admin（後台管理員）與 member（一般會員）兩種角色值，
 * 嚴禁任意字串被寫入權限欄位，避免後續權限判斷邏輯失準。
 */
function isAllowedRole(value: unknown): value is 'admin' | 'member' {
  return value === 'admin' || value === 'member';
}

/**
 * 將可能的 Node 風格請求物件（例如本機開發伺服器 middleware 相容呼叫慣例）正規化為標準 Fetch Request，
 * 以便統一重複使用 isOriginAllowed() 等共用安全檢查函式，避免另外重寫一套 Origin 比對邏輯。
 * 若傳入本身已是標準 Request（GET/POST 匯出函式與 vite dev middleware 皆屬此類），則直接原樣使用。
 */
function toFetchRequest(req: any): Request {
  if (req instanceof Request) return req;

  const headers = new Headers();
  const sourceHeaders = req?.headers;
  if (sourceHeaders) {
    if (typeof sourceHeaders.forEach === 'function' && typeof sourceHeaders.get === 'function') {
      // 標準 Fetch Headers 型態（或相容介面）
      sourceHeaders.forEach((value: string, key: string) => headers.set(key, value));
    } else {
      // Node 風格純物件標頭
      Object.entries(sourceHeaders as Record<string, unknown>).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((item) => headers.append(key, String(item)));
        } else if (value != null) {
          headers.set(key, String(value));
        }
      });
    }
  }

  const host = headers.get('host') || 'localhost';
  const rawUrl = typeof req?.url === 'string' && req.url ? req.url : '/';
  const absoluteUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `http://${host}${rawUrl}`;

  return new Request(absoluteUrl, {
    method: req?.method || 'GET',
    headers,
  });
}

export async function handler(req: any, res: any): Promise<Response> {
  // 正規化為標準 Fetch Request，統一標頭讀取與 Origin 檢查邏輯，相容 Node 風格請求物件呼叫慣例
  const fetchRequest = toFetchRequest(req);
  const method = fetchRequest.method || 'GET';

  // 0. Origin 檢查（比照 api/promotions/claim.ts 等既有 API 之防護模式，防止惡意跨域網站呼叫本端點）
  const requestOrigin = fetchRequest.headers.get('Origin');
  if (!isOriginAllowed(requestOrigin, fetchRequest)) {
    return new Response('Origin not allowed', { status: 403 });
  }

  // 1. Get Authorization Bearer Token（僅信任標準 Authorization 標頭，不再接受 URL query string 備援，
  //    避免管理員 access token 外洩至 Vercel 存取紀錄、瀏覽器歷史紀錄與外連請求的 Referer 標頭）
  const headerAuth = fetchRequest.headers.get('Authorization') || '';
  const token = headerAuth.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing authorization token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_PUBLIC_SUPABASE_URL || 'https://tmqzkagkrzhioftvwbqo.supabase.co';
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseSecretKey) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_SECRET_KEY' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 2. Validate requesting user JWT
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData?.user) {
      if (userError) {
        console.error('admin-users: 驗證管理員 Token 失敗', userError);
      }
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const requestingUser = userData.user;
    if (requestingUser.app_metadata?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Requires admin role' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Handle POST actions (e.g. promoting a user to admin)
    if (method === 'POST') {
      let body: any = {};
      try {
        if (typeof req.json === 'function') {
          body = await req.json();
        } else if (typeof req.body === 'string') {
          body = JSON.parse(req.body);
        } else if (req.body) {
          body = req.body;
        }
      } catch {
        // empty body
      }

      if (body.action === 'set_role' && body.userId && body.role) {
        // 角色白名單驗證：僅允許指派 admin 或 member，避免任意字串寫入 app_metadata.role
        if (!isAllowedRole(body.role)) {
          return new Response(JSON.stringify({ error: '角色參數不合法，僅允許指派 admin 或 member' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        // 禁止移除最後一位管理員：若目標使用者目前為 admin 且即將被改為非 admin，
        // 須先確認系統中除了該使用者外還有其他 admin，避免後台管理權限被誤操作清空。
        if (body.role !== 'admin') {
          const { data: guardUsersData, error: guardListError } = await supabaseAdmin.auth.admin.listUsers();
          if (guardListError) {
            console.error('admin-users: 檢查最後一位管理員保護時列出使用者失敗', guardListError);
            return new Response(JSON.stringify({ error: '無法驗證管理員名單，請稍後再試' }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            });
          }

          const guardUsers = guardUsersData?.users || [];
          const targetUser = guardUsers.find((u: any) => u.id === body.userId);
          const currentAdminCount = guardUsers.filter((u: any) => u.app_metadata?.role === 'admin').length;

          if (targetUser?.app_metadata?.role === 'admin' && currentAdminCount <= 1) {
            return new Response(JSON.stringify({ error: '無法移除最後一位管理員，系統至少須保留一位管理員帳號' }), {
              status: 409,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }

        const { data: updatedUser, error: updateRoleError } = await supabaseAdmin.auth.admin.updateUserById(body.userId, {
          app_metadata: {
            role: body.role,
          },
        });

        if (updateRoleError) {
          console.error('admin-users: 更新使用者角色失敗', updateRoleError);
          return new Response(JSON.stringify({ error: 'Failed to update role' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({ success: true, user: updatedUser.user }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 4. GET: Return combined user list with profiles & roles
    const { data: usersData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('admin-users: 列出 auth 使用者清單失敗', listError);
      return new Response(JSON.stringify({ error: 'Failed to list auth users' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const [{ data: profilesData }, { data: socialAccountsData }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*'),
      supabaseAdmin.from('user_social_accounts').select('*'),
    ]);

    const profileMap = new Map<string, any>();
    (profilesData || []).forEach((p: any) => {
      profileMap.set(p.id, p);
    });

    const socialMap = new Map<string, any[]>();
    (socialAccountsData || []).forEach((s: any) => {
      const list = socialMap.get(s.user_id) || [];
      list.push(s);
      socialMap.set(s.user_id, list);
    });

    const combinedList = (usersData.users || []).map((u: any) => {
      const p = profileMap.get(u.id) || {};
      const socials = socialMap.get(u.id) || (u.identities || []).map((id: any) => ({
        provider: id.provider,
        provider_user_id: id.id,
        provider_email: id.identity_data?.email || u.email,
        provider_name: id.identity_data?.full_name || id.identity_data?.name || p.name,
        avatar_url: id.identity_data?.avatar_url || id.identity_data?.picture || p.avatar,
        last_sign_in_at: id.last_sign_in_at || u.last_sign_in_at,
        created_at: id.created_at || u.created_at,
      }));

      const role = u.app_metadata?.role || (u.email === 'worktester2019@gmail.com' ? 'admin' : 'member');
      const name = p.name || u.user_metadata?.full_name || u.user_metadata?.name || (role === 'admin' ? '系統管理員' : '一般會員');

      return {
        id: u.id,
        email: u.email || p.email || '',
        name: name,
        phone: p.phone || u.phone || '',
        address: p.address || '',
        birth_date: p.birth_date ? String(p.birth_date) : '',
        gender: p.gender || '',
        instagram: p.instagram || '',
        avatar: p.avatar || u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
        role: role,
        social_accounts: socials,
        created_at: p.created_at || u.created_at,
        updated_at: p.updated_at || u.updated_at,
      };
    });

    return new Response(JSON.stringify({
      success: true,
      users: combinedList,
      admins: combinedList.filter((u: any) => u.role === 'admin'),
      members: combinedList.filter((u: any) => u.role !== 'admin'),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('admin-users: 發生未預期例外', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handler(request, null);
}

export async function POST(request: Request): Promise<Response> {
  return handler(request, null);
}

export default { fetch: handler };
