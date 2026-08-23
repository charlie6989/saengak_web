-- ============================================================================
-- Migration: Create get_admin_profiles RPC
-- Description: 建立一個提供給管理員的 RPC，允許他們跨過 RLS 並帶出使用者的權限 (role)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_admin_profiles()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  phone text,
  address text,
  birth_date text,
  gender text,
  instagram text,
  created_at timestamptz,
  avatar text,
  role text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 權限檢查：只有 JWT 中的 app_metadata.role = 'admin' 才允許執行
  IF coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') != 'admin' THEN
    RAISE EXCEPTION 'Access denied. Only admins can list profiles.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.name,
    p.phone,
    p.address,
    p.birth_date,
    p.gender,
    p.instagram,
    p.created_at,
    p.avatar,
    (u.raw_app_meta_data ->> 'role')::text AS role
  FROM public.profiles p
  LEFT JOIN auth.users u ON p.id = u.id
  ORDER BY p.created_at DESC;
END;
$$;

-- 設定權限，允許登入的使用者呼叫 (但內部會檢查 JWT)
GRANT EXECUTE ON FUNCTION public.get_admin_profiles() TO authenticated;
