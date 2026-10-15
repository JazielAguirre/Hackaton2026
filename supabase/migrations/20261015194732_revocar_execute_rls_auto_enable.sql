-- rls_auto_enable es la función de Supabase que activa RLS en cada tabla nueva de public.
-- Solo la usa el event trigger ensure_rls; nadie debe poder llamarla por /rest/v1/rpc.
-- anon y authenticated también la heredaban de PUBLIC, así que se revoca de los tres.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
