-- Run this migration in the Supabase project used by the app.
-- It completes the mandatory first-login password change without exposing
-- direct UPDATE rights on auth.users to the browser.

CREATE OR REPLACE FUNCTION public.complete_initial_password(p_new_password TEXT)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_status TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to change your password.';
  END IF;

  IF p_new_password IS NULL OR length(p_new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long.';
  END IF;

  SELECT status INTO v_status FROM public.profiles WHERE id = v_user_id;
  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'This password setup link is no longer active.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.profiles
  SET status = 'active'
  WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.complete_initial_password(TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';
