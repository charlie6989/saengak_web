import { createClient } from '@supabase/supabase-js';

export async function handler(req: any, res: any): Promise<Response> {
  const method = req.method || 'GET';
  const urlStr = req?.url || '';
  const parsedUrl = urlStr ? new URL(urlStr, 'http://localhost') : null;

  // 1. Get Authorization Bearer Token
  let headerAuth = '';
  if (req?.headers) {
    if (typeof req.headers.get === 'function') {
      headerAuth = req.headers.get('authorization') || '';
    } else {
      headerAuth = req.headers['authorization'] || req.headers['Authorization'] || '';
    }
  }

  const token = (headerAuth.replace(/^Bearer\s+/i, '') || parsedUrl?.searchParams?.get('token') || '').trim();

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
      return new Response(JSON.stringify({ error: 'Invalid or expired token', details: userError }), {
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
        const { data: updatedUser, error: updateRoleError } = await supabaseAdmin.auth.admin.updateUserById(body.userId, {
          app_metadata: {
            role: body.role,
          },
        });

        if (updateRoleError) {
          return new Response(JSON.stringify({ error: 'Failed to update role', details: updateRoleError }), {
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
      return new Response(JSON.stringify({ error: 'Failed to list auth users', details: listError }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { data: profilesData } = await supabaseAdmin.from('profiles').select('*');
    const profileMap = new Map<string, any>();
    (profilesData || []).forEach((p: any) => {
      profileMap.set(p.id, p);
    });

    const combinedList = (usersData.users || []).map((u: any) => {
      const p = profileMap.get(u.id) || {};
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
    return new Response(JSON.stringify({ error: 'Internal server error', details: err?.message || String(err) }), {
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
