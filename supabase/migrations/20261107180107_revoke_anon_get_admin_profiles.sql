-- 管理員名單只給登入後的管理員使用；函式內已檢查 admin 角色，這裡再收回未登入（anon）與 PUBLIC 的執行權限。
revoke execute on function public.get_admin_profiles() from public;
revoke execute on function public.get_admin_profiles() from anon;
grant execute on function public.get_admin_profiles() to authenticated;
grant execute on function public.get_admin_profiles() to service_role;
