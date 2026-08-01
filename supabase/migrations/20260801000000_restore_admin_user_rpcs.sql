-- Restores the admin user-management RPCs in projects where the initial schema
-- was created before these functions were added. Run with `supabase db push`,
-- or paste this migration into the Supabase SQL Editor for the connected project.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_email TEXT,
  p_password TEXT,
  p_username TEXT,
  p_role TEXT
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can create users.';
  END IF;

  IF p_email IS NULL OR btrim(p_email) = ''
     OR p_password IS NULL OR p_password = ''
     OR p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION 'Email, password, and username are required.';
  END IF;

  IF p_role NOT IN ('admin', 'member') THEN
    RAISE EXCEPTION 'Invalid user role.';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = lower(btrim(p_email))) THEN
    RAISE EXCEPTION 'A user with this email already exists.';
  END IF;

  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, aud, role, created_at, updated_at,
    confirmation_token, email_change_token_new, email_change, recovery_token, phone
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    lower(btrim(p_email)),
    crypt(p_password, gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', lower(btrim(p_email)),
      'username', btrim(p_username),
      'email_verified', true,
      'phone_verified', false
    ),
    'authenticated', 'authenticated', now(), now(), '', '', '', '', NULL
  );

  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    v_user_id, v_user_id,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', lower(btrim(p_email)),
      'username', btrim(p_username),
      'email_verified', true,
      'phone_verified', false
    ),
    'email', v_user_id::text, now(), now(), now()
  );

  INSERT INTO public.profiles (
    id, employee_id, email, username, role, status, last_seen_at
  ) VALUES (
    v_user_id,
    'EMP-' || substring(v_user_id::text FROM 1 FOR 4),
    lower(btrim(p_email)), btrim(p_username), p_role, 'pending', now()
  )
  -- Some Supabase projects have an auth.users trigger that creates this row.
  -- Update that row with the admin-selected values instead of inserting twice.
  ON CONFLICT (id) DO UPDATE
  SET employee_id = EXCLUDED.employee_id,
      email = EXCLUDED.email,
      username = EXCLUDED.username,
      role = EXCLUDED.role,
      status = EXCLUDED.status,
      last_seen_at = EXCLUDED.last_seen_at;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.admin_create_user(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- The browser must not receive broad UPDATE access to profiles. This RPC lets
-- administrators set the optional employee ID after creating a user.
CREATE OR REPLACE FUNCTION public.admin_update_user_employee_id(
  p_user_id UUID,
  p_employee_id TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can update employee IDs.';
  END IF;

  UPDATE public.profiles
  SET employee_id = NULLIF(btrim(p_employee_id), '')
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.admin_update_user_employee_id(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_reset_password(
  p_user_id UUID,
  p_new_password TEXT
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_caller_role TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();

  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can reset passwords.';
  END IF;

  IF p_new_password IS NULL OR p_new_password = '' THEN
    RAISE EXCEPTION 'A new password is required.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  UPDATE public.profiles SET status = 'pending' WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_user_id UUID
)
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
