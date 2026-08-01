-- Paste this entire file into Supabase Dashboard -> SQL Editor and click Run.
-- This must be run against the same project configured in .env.local.

CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can delete users.';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Administrators cannot delete their own account.';
  END IF;

  DELETE FROM public.profiles WHERE id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found.';
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.admin_delete_user(UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';

-- Verification: this must return one row before trying deletion in the app.
SELECT routine_name
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'admin_delete_user';
