-- ============================================================================
-- Nestor — Consolidated Database Schema (single source of truth)
-- ============================================================================
-- Run this entire file in the Supabase SQL Editor for the project referenced
-- in .env.local. It is fully idempotent — safe to re-run on an existing
-- database (uses CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
-- CREATE OR REPLACE FUNCTION / DROP POLICY IF EXISTS throughout).
--
-- This file supersedes and replaces:
--   - supabase/fix_admin_delete_user.sql
--   - supabase/migrations/20260801000000_restore_admin_user_rpcs.sql
--   - supabase/migrations/20260803000000_complete_initial_password.sql
-- Those three files should be deleted once this has been applied — every
-- fix they contained (self-delete guard, pgcrypto extension, validation) is
-- folded in below. Do not maintain schema in more than one file going forward.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ============================================================================
-- 0. RLS Cleanup — remove drifted/duplicate/dangerous policies
-- ============================================================================
-- A live audit (docs/security-audit.md, run 2026-08-08) pulled every policy
-- actually in effect on the production database via:
--   SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies
--   WHERE schemaname = 'public' ORDER BY tablename, policyname;
-- It found FAR more policies than this file ever tracked — years of ad-hoc
-- migrations and dashboard edits that were never folded back in here (the
-- exact "schema drift" pattern flagged in ADR-012, now confirmed at scale).
--
-- Two concrete problems this caused:
--  1. Postgres RLS policies are OR'd together (for permissive policies,
--     which is the default and what every policy in this project uses) —
--     so ONE overly-broad policy defeats every careful one sitting next to
--     it. `profiles` alone had 8 overlapping policies; several tables had a
--     blanket `USING (true) WITH CHECK (true)` policy living right next to
--     a properly owner/admin-scoped one, which makes the careful one
--     pointless — any authenticated user could still write anything via the
--     open one.
--  2. Two helper functions, `is_admin()` and `is_active_user()`, already
--     existed live (used by several of the better-scoped policies) but were
--     never defined in this tracked file. They're (re)defined below so this
--     file is now the actual source of truth, not just partially so.
--
-- This section explicitly drops every dangerous or redundant policy name
-- found in that live audit, by its exact name, before each table's own
-- section below (re)creates one clean, minimal, documented policy set.
-- Safe to re-run: DROP POLICY IF EXISTS is a no-op on a policy that was
-- already removed by a previous run of this same file.

-- profiles: 8 overlapping policies -> keep exactly 3 (self-manage, admin-manage-all, public read)
DROP POLICY IF EXISTS "Active users can update their safe profile fields" ON public.profiles;
DROP POLICY IF EXISTS "Allow admins to update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Allow users to update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profile owner or admin can read" ON public.profiles;

-- tickets: "Team: insert/update/delete" let ANY authenticated user write or
-- delete ANY OTHER user's tickets outright, defeating "Users can manage own
-- tickets" right next to it. This was a real, live broken-access-control gap.
DROP POLICY IF EXISTS "Team: insert tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team: update tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team: delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Team: read all tickets" ON public.tickets;
DROP POLICY IF EXISTS "Active users manage own tickets" ON public.tickets;

-- ticket_work_logs: dedupe the two identical unconditional read policies
DROP POLICY IF EXISTS "Team: read all work logs" ON public.ticket_work_logs;

-- oem_cases: "Allow write for authenticated" (true/true) let anyone edit or
-- delete ANY case, defeating the careful owner/admin-scoped policies beside
-- it. Keep the well-designed set (create own / read / admin manage+delete /
-- owner-or-admin update), drop the dangerous open one and its read/write dupes.
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.oem_cases;
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.oem_cases;
DROP POLICY IF EXISTS "Everyone can read OEM cases" ON public.oem_cases;

-- roster_assignments: "Allow write for authenticated" (true/true) let any
-- member assign/change anyone's shift directly, bypassing the admin-only
-- UI restriction entirely.
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.roster_assignments;
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.roster_assignments;
DROP POLICY IF EXISTS "Admins manage roster assignments" ON public.roster_assignments;

-- shift_requests: "Allow write for authenticated" (true/true) let any member
-- approve/decline their own or anyone else's shift-change request directly,
-- bypassing the entire admin-review workflow. The rest of the policy set
-- here was already correctly designed (submit own / admin reviews / users
-- read own or admin reads all / withdraw own-pending or admin deletes) —
-- just drop the dangerous open one and its exact duplicates.
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.shift_requests;
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.shift_requests;
DROP POLICY IF EXISTS "Admins can update all shift requests" ON public.shift_requests;
DROP POLICY IF EXISTS "Admins can view all shift requests" ON public.shift_requests;
DROP POLICY IF EXISTS "Users can insert own shift requests" ON public.shift_requests;
DROP POLICY IF EXISTS "Users can view own shift requests" ON public.shift_requests;

-- vault_products / vault_clients / vault_entries: no dangerous open-write
-- policy existed here (good) — just dedupe the redundant read/admin-write
-- policy names left over from an earlier pass.
DROP POLICY IF EXISTS "Admins can manage vault products" ON public.vault_products;
DROP POLICY IF EXISTS "Everyone can read vault products" ON public.vault_products;
DROP POLICY IF EXISTS "Admins can manage vault clients" ON public.vault_clients;
DROP POLICY IF EXISTS "Everyone can read vault clients" ON public.vault_clients;
DROP POLICY IF EXISTS "Admins can manage vault entries" ON public.vault_entries;
DROP POLICY IF EXISTS "Everyone can read vault entries" ON public.vault_entries;

-- personal_vault / tasks: dedupe identical own-row policies left from an
-- earlier pass (both variants were already correctly scoped, no gap here).
DROP POLICY IF EXISTS "Active users manage own personal vault" ON public.personal_vault;
DROP POLICY IF EXISTS "Active users manage own tasks" ON public.tasks;

-- Helper functions used below (and already relied on by several of the
-- policies that were live but untracked). SECURITY DEFINER + a pinned
-- search_path so they can read `profiles` regardless of the caller's own
-- row-level access, without being hijackable via a spoofed search_path.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active'
  );
$$;

-- Every policy below that calls these needs the `authenticated` role to
-- actually be allowed to invoke them (matches this file's convention for
-- every other custom function — see the RPC grants further down).
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;

-- ----------------------------------------------------------------------------
-- 1. Profiles Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_id TEXT,
    email TEXT,
    username TEXT,
    role TEXT CHECK (role IN ('admin', 'member')) DEFAULT 'member',
    status TEXT CHECK (status IN ('active', 'disabled', 'pending')) DEFAULT 'active',
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Backfill columns for pre-existing databases created from an older schema copy
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
-- Some Supabase projects attach a generic "set updated_at on row change"
-- trigger to every public table; without this column, any UPDATE fails with
-- `record "new" has no field "updated_at"` (error 42703). Added defensively
-- to every table below regardless of whether such a trigger exists here.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Two profiles sharing the same Employee ID silently merge their Shift
-- Roster data — roster_assignments/calendar_assignments key on employee_id
-- alone, not on the profile's own UUID, so a duplicate ID makes one user's
-- shifts appear on a completely different account. See docs/decisions.md
-- ADR-017. If this fails with "duplicate key value violates unique
-- constraint", find and resolve the collision first, e.g.:
--   SELECT employee_id, array_agg(username), array_agg(id) FROM public.profiles
--   WHERE employee_id IS NOT NULL GROUP BY employee_id HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_employee_id_unique
    ON public.profiles (employee_id) WHERE employee_id IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow select for authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Users can manage own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;

CREATE POLICY "Allow select for authenticated" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own profile" ON public.profiles
    FOR ALL TO authenticated USING (((select auth.uid()) = id)) WITH CHECK (((select auth.uid()) = id));

-- Explicitly tracks what User Management's role/status toggles and Employee
-- ID mapping need (an admin editing a DIFFERENT user's row) — same pattern
-- already used for vault_products/vault_clients/vault_entries below. Added
-- during the security audit (docs/security-audit.md) after a live PoC showed
-- an admin's cross-user profile update succeeding despite no such policy
-- existing in this tracked file — i.e. the live project already had an
-- equivalent policy that was never synced back here (see ADR-012 on schema
-- drift). Safe to add even if redundant with whatever is live.
--
-- MUST use is_admin(), not an inline `(SELECT role FROM public.profiles ...)`
-- subquery: this policy is FOR ALL (applies to SELECT too), and on THIS
-- SAME TABLE — so an inline subquery re-triggers profiles' own SELECT
-- policies, which re-evaluates this same FOR ALL policy, forever
-- ("infinite recursion detected in policy for relation \"profiles\"",
-- Postgres error 42P17). This broke every query touching profiles at all
-- (direct or, like vault_change_requests, via its own admin-check subquery)
-- the moment this policy first went live. is_admin() is SECURITY DEFINER —
-- its internal read of profiles runs as the function owner and bypasses
-- RLS entirely, so it never re-enters this policy.
CREATE POLICY "Admins can manage all profiles" ON public.profiles
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- SECURITY FIX (see docs/security-audit.md, Finding 1 — CRITICAL): the
-- "own profile" policy above is intentionally permissive on WHICH ROW a user
-- may touch (their own), but Postgres RLS has no concept of column-level
-- restriction — it does not stop a user from writing new *values* into that
-- row. Confirmed by direct PoC against the live project: a plain member
-- account successfully self-updated its own `role` column to 'admin' via
-- `supabase.from('profiles').update({ role: 'admin' }).eq('id', <self>)` —
-- no error, fully persisted. This trigger closes that gap by rejecting any
-- self-initiated change to the three privilege-bearing columns; all
-- legitimate changes to those columns are made by an admin acting on a
-- *different* user's row (via the RPCs below, or the admin-only UI), which
-- this trigger does not affect.
CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() = OLD.id THEN
    -- Role is never self-changeable, full stop — no legitimate self-service
    -- reason to touch it, and it's the actual escalation vector this trigger
    -- exists to close.
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role.';
    END IF;

    -- An already-admin row touching its own status/employee_id isn't an
    -- escalation (they're not gaining any privilege they don't have) and
    -- covers legitimate self-service, e.g. an admin setting their own
    -- Employee ID mapping in User Management. Non-admins are restricted,
    -- with one narrow exception: completing first-login password setup
    -- flips your own status from 'pending' to 'active'
    -- (complete_initial_password RPC) — everything else self-initiated is
    -- blocked, including a disabled user trying to reactivate themselves.
    IF OLD.role IS DISTINCT FROM 'admin' THEN
      IF NEW.status IS DISTINCT FROM OLD.status
         AND NOT (OLD.status = 'pending' AND NEW.status = 'active') THEN
        RAISE EXCEPTION 'You cannot change your own account status.';
      END IF;
      IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
        RAISE EXCEPTION 'You cannot change your own employee ID.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_self_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_privilege_escalation();


-- ----------------------------------------------------------------------------
-- 2. Tasks Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    status TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    tags TEXT[] DEFAULT '{}'::TEXT[],
    date DATE NOT NULL,
    notes TEXT,
    sessions TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow public insert to tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow public update to tasks" ON public.tasks;
DROP POLICY IF EXISTS "Allow public delete to tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;

-- Also requires is_active_user() — a disabled account can no longer write
-- here at the database layer, not just via the app's own client-side check
-- (see docs/security-audit.md Finding 1 / the disabled-account fix).
CREATE POLICY "Users can manage own tasks" ON public.tasks
    FOR ALL TO authenticated
    USING (((select auth.uid()) = user_id) AND is_active_user())
    WITH CHECK (((select auth.uid()) = user_id) AND is_active_user());


-- ----------------------------------------------------------------------------
-- 3. Tickets Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tickets (
    id TEXT PRIMARY KEY, -- Ticket ID like INC-23911
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    customer_id TEXT,
    customer_name TEXT,
    subject TEXT NOT NULL,
    details TEXT,
    priority TEXT NOT NULL, -- P1 to P6
    status TEXT NOT NULL, -- Open, In Progress, Awaiting Information, Closed, On Hold, Resolved
    product TEXT,
    raised_by TEXT,
    date DATE NOT NULL,
    my_work TEXT,
    my_note TEXT,
    comments JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS my_note TEXT;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow public insert to tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow public update to tickets" ON public.tickets;
DROP POLICY IF EXISTS "Allow public delete to tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can manage own tickets" ON public.tickets;

CREATE POLICY "Users can manage own tickets" ON public.tickets
    FOR ALL TO authenticated
    USING (((select auth.uid()) = user_id) AND is_active_user())
    WITH CHECK (((select auth.uid()) = user_id) AND is_active_user());

-- Unique constraint required for the app's upsert(onConflict: "id, user_id")
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_id_user_id_key'
  ) THEN
    ALTER TABLE public.tickets ADD CONSTRAINT tickets_id_user_id_key UNIQUE (id, user_id);
  END IF;
END $$;


-- ----------------------------------------------------------------------------
-- 3b. Ticket Work Logs Table (used by the app, was missing from the schema)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ticket_work_logs (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    author_name TEXT,
    date DATE NOT NULL,
    my_work TEXT,
    my_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.ticket_work_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.ticket_work_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own ticket work logs" ON public.ticket_work_logs;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.ticket_work_logs;
DROP POLICY IF EXISTS "Users can update own ticket work logs" ON public.ticket_work_logs;
DROP POLICY IF EXISTS "Users can delete own ticket work logs" ON public.ticket_work_logs;

-- Work logs are per-author but every teammate on a shared ticket needs to read
-- the full history, so read is open to authenticated users and write is
-- restricted to the log's own author.
CREATE POLICY "Allow read for authenticated" ON public.ticket_work_logs
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage own ticket work logs" ON public.ticket_work_logs
    FOR INSERT TO authenticated WITH CHECK (((select auth.uid()) = user_id));

CREATE POLICY "Users can update own ticket work logs" ON public.ticket_work_logs
    FOR UPDATE TO authenticated USING (((select auth.uid()) = user_id)) WITH CHECK (((select auth.uid()) = user_id));

CREATE POLICY "Users can delete own ticket work logs" ON public.ticket_work_logs
    FOR DELETE TO authenticated USING (((select auth.uid()) = user_id));


-- ----------------------------------------------------------------------------
-- 4. OEM Cases Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.oem_cases (
    id TEXT PRIMARY KEY,
    product_name TEXT NOT NULL,
    product_category TEXT,
    client_id TEXT,
    client_name TEXT,
    case_type TEXT,
    oem_case_id TEXT,
    internal_ticket_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL,
    assigned_to TEXT,
    raised_by TEXT,
    created_date DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_date DATE DEFAULT CURRENT_DATE,
    status_update TEXT,
    closure_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Some Supabase projects attach a generic "set updated_at on row change"
-- trigger to every public table (e.g. via the table editor UI or a
-- moddatetime extension), which fails with `record "new" has no field
-- "updated_at"` on any UPDATE if the table lacks that column. This table
-- only ever had the app-managed `updated_date` (DATE) — add the
-- trigger-compatible column too so updates stop erroring regardless of
-- whether such a trigger exists on this project.
ALTER TABLE public.oem_cases ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Ownership marker for RLS (distinct from `raised_by`/`assigned_to`, which
-- are free-text display names, not auth identities). Defaults to the
-- inserting user automatically, so existing app code needs no changes.
ALTER TABLE public.oem_cases ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();

-- Backfill for cases that already existed before this column was added.
-- `DEFAULT auth.uid()` only applies to new rows going forward, and running
-- this migration from the SQL Editor has no authenticated-user context, so
-- every pre-existing row would otherwise get `created_by = NULL` — silently
-- locking its original creator out of the "owner can update" policy below
-- (only an admin could touch it from then on). Best-effort match by name
-- against `profiles.username`; anything left NULL falls back to admin-only,
-- same as before this migration ran.
UPDATE public.oem_cases oc
SET created_by = p.id
FROM public.profiles p
WHERE oc.created_by IS NULL
  AND oc.raised_by IS NOT NULL
  AND lower(btrim(p.username)) = lower(btrim(oc.raised_by));

ALTER TABLE public.oem_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to oem_cases" ON public.oem_cases;
DROP POLICY IF EXISTS "Allow public insert to oem_cases" ON public.oem_cases;
DROP POLICY IF EXISTS "Allow public update to oem_cases" ON public.oem_cases;
DROP POLICY IF EXISTS "Allow public delete to oem_cases" ON public.oem_cases;
DROP POLICY IF EXISTS "All users can read OEM cases" ON public.oem_cases;
DROP POLICY IF EXISTS "All users can insert OEM cases" ON public.oem_cases;
DROP POLICY IF EXISTS "All users can update OEM cases" ON public.oem_cases;
DROP POLICY IF EXISTS "All users can delete OEM cases" ON public.oem_cases;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.oem_cases;
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.oem_cases;
DROP POLICY IF EXISTS "Active team members can create OEM cases" ON public.oem_cases;
DROP POLICY IF EXISTS "Active team members can read OEM cases" ON public.oem_cases;
DROP POLICY IF EXISTS "Admins can delete OEM cases" ON public.oem_cases;
DROP POLICY IF EXISTS "Admins can manage OEM cases" ON public.oem_cases;
DROP POLICY IF EXISTS "Owners or admins can update OEM cases" ON public.oem_cases;

-- Any active team member can read and create cases (this is a shared,
-- collaborative case log by design); only the case's own creator or an
-- admin may update it; only an admin may delete one.
CREATE POLICY "Active team members can read OEM cases" ON public.oem_cases
    FOR SELECT TO authenticated USING (is_active_user());

CREATE POLICY "Active team members can create OEM cases" ON public.oem_cases
    FOR INSERT TO authenticated WITH CHECK (is_active_user() AND created_by = auth.uid());

CREATE POLICY "Owners or admins can update OEM cases" ON public.oem_cases
    FOR UPDATE TO authenticated
    USING (is_active_user() AND (created_by = auth.uid() OR is_admin()))
    WITH CHECK (is_active_user() AND (created_by = auth.uid() OR is_admin()));

CREATE POLICY "Admins can delete OEM cases" ON public.oem_cases
    FOR DELETE TO authenticated USING (is_admin());


-- ----------------------------------------------------------------------------
-- 5. Vault Products Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vault_products (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    product_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vault_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.vault_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to vault_products" ON public.vault_products;
DROP POLICY IF EXISTS "Allow public insert to vault_products" ON public.vault_products;
DROP POLICY IF EXISTS "Allow public update to vault_products" ON public.vault_products;
DROP POLICY IF EXISTS "Allow public delete to vault_products" ON public.vault_products;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.vault_products;
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.vault_products;

DROP POLICY IF EXISTS "Admins can write vault_products" ON public.vault_products;

-- Team Password Vault is centralized/shared: every authenticated user can
-- read it, but only admins may add/edit/remove products.
CREATE POLICY "Allow read for authenticated" ON public.vault_products
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can write vault_products" ON public.vault_products
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());


-- ----------------------------------------------------------------------------
-- 6. Vault Clients Table
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vault_clients (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES public.vault_products(id) ON DELETE CASCADE,
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vault_clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.vault_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to vault_clients" ON public.vault_clients;
DROP POLICY IF EXISTS "Allow public insert to vault_clients" ON public.vault_clients;
DROP POLICY IF EXISTS "Allow public update to vault_clients" ON public.vault_clients;
DROP POLICY IF EXISTS "Allow public delete to vault_clients" ON public.vault_clients;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.vault_clients;
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.vault_clients;

DROP POLICY IF EXISTS "Admins can write vault_clients" ON public.vault_clients;

CREATE POLICY "Allow read for authenticated" ON public.vault_clients
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can write vault_clients" ON public.vault_clients
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());


-- ----------------------------------------------------------------------------
-- 7. Vault Entries Table
--    `fields` holds an AES-256-GCM encrypted envelope
--    ({ __enc: 1, iv, data }) produced client-side — the app never sends
--    plaintext credential values to Supabase. `notes` is left unused/NULL by
--    the app going forward (notes are now stored inside the same encrypted
--    envelope as `fields`); the column is kept only so any pre-encryption
--    legacy rows aren't destructively altered.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vault_entries (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES public.vault_products(id) ON DELETE CASCADE,
    client_id TEXT REFERENCES public.vault_clients(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    title TEXT, -- deprecated backup
    added_by TEXT DEFAULT 'Admin',
    notes TEXT,
    fields JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- This table was found to already exist in at least one project with a
-- different real column set than assumed above (missing `title` caused
-- `PGRST204: Could not find the 'title' column` on every insert, even though
-- CREATE TABLE IF NOT EXISTS looked correct). Backfill every column
-- defensively rather than trust IF NOT EXISTS matches this shape everywhere.
-- The app itself no longer writes to `title` at all (see nestor-context.tsx)
-- specifically because it can't be relied on to exist; it's read-only now,
-- purely for any legacy pre-encryption rows that might still have it set.
ALTER TABLE public.vault_entries ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE public.vault_entries ADD COLUMN IF NOT EXISTS added_by TEXT DEFAULT 'Admin';
ALTER TABLE public.vault_entries ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.vault_entries ADD COLUMN IF NOT EXISTS fields JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.vault_entries ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.vault_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.vault_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to vault_entries" ON public.vault_entries;
DROP POLICY IF EXISTS "Allow public insert to vault_entries" ON public.vault_entries;
DROP POLICY IF EXISTS "Allow public update to vault_entries" ON public.vault_entries;
DROP POLICY IF EXISTS "Allow public delete to vault_entries" ON public.vault_entries;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.vault_entries;
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.vault_entries;

DROP POLICY IF EXISTS "Admins can write vault_entries" ON public.vault_entries;

CREATE POLICY "Allow read for authenticated" ON public.vault_entries
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can write vault_entries" ON public.vault_entries
    FOR ALL TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());


-- ----------------------------------------------------------------------------
-- 8. Personal Vault Table
--    Same encrypted-envelope `fields` shape as vault_entries, but keyed by
--    each user's own personal vault PIN (never the team master password),
--    so rotating one has no effect on the other. Already owner-scoped RLS
--    below — no admin-only restriction here, since it's each user's own data.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.personal_vault (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    label TEXT NOT NULL,
    title TEXT, -- deprecated backup
    notes TEXT,
    username TEXT DEFAULT 'Me',
    fields JSONB DEFAULT '[]'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Same defensive backfill as vault_entries above, and the same reasoning:
-- the app no longer writes to `title`, only `label`.
ALTER TABLE public.personal_vault ADD COLUMN IF NOT EXISTS label TEXT;
ALTER TABLE public.personal_vault ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.personal_vault ADD COLUMN IF NOT EXISTS username TEXT DEFAULT 'Me';
ALTER TABLE public.personal_vault ADD COLUMN IF NOT EXISTS fields JSONB DEFAULT '[]'::JSONB;
ALTER TABLE public.personal_vault ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.personal_vault ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.personal_vault ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage personal vault" ON public.personal_vault;
DROP POLICY IF EXISTS "Users can manage own personal vault" ON public.personal_vault;

CREATE POLICY "Users can manage own personal vault" ON public.personal_vault
    FOR ALL TO authenticated
    USING (((select auth.uid()) = user_id) AND is_active_user())
    WITH CHECK (((select auth.uid()) = user_id) AND is_active_user());


-- ----------------------------------------------------------------------------
-- 8b. Vault Key Wraps Table (Recovery Kit support)
--    Vault entries are encrypted with a random Data Encryption Key (DEK),
--    not the passphrase directly. This table stores that DEK, itself
--    encrypted ("wrapped") twice: once under a key derived from the current
--    passphrase, once under a key derived from a one-time recovery code. A
--    forgotten passphrase can then be recovered via the code by unwrapping
--    the DEK and re-wrapping it under a new passphrase — the DEK itself
--    never changes, so no vault entry needs to be touched or re-encrypted.
--    `id` is 'team' for the single shared Team Vault row, or the owning
--    user's auth.uid() (as text) for a Personal Vault row.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vault_key_wraps (
    id TEXT PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('team', 'personal')),
    wrapped_dek_passphrase JSONB,
    wrapped_dek_recovery JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Defensive backfill in case this table already exists with a different
-- column set on this project, same reasoning as every other table above.
ALTER TABLE public.vault_key_wraps ADD COLUMN IF NOT EXISTS wrapped_dek_passphrase JSONB;
ALTER TABLE public.vault_key_wraps ADD COLUMN IF NOT EXISTS wrapped_dek_recovery JSONB;
ALTER TABLE public.vault_key_wraps ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE public.vault_key_wraps ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.vault_key_wraps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read team wrap or own personal wrap" ON public.vault_key_wraps;
DROP POLICY IF EXISTS "Write team wrap as admin or own personal wrap" ON public.vault_key_wraps;

-- Every authenticated user can read the shared Team Vault wrap (they all
-- need it to decrypt Team Vault entries); a Personal Vault wrap is only
-- readable by its own owner.
CREATE POLICY "Read team wrap or own personal wrap" ON public.vault_key_wraps
    FOR SELECT TO authenticated
    USING (scope = 'team' OR id = (auth.uid())::text);

-- Only admins may create/update/delete the Team Vault wrap; a Personal
-- Vault wrap may only be written by its own owner.
CREATE POLICY "Write team wrap as admin or own personal wrap" ON public.vault_key_wraps
    FOR ALL TO authenticated
    USING (
      (scope = 'team' AND is_admin())
      OR (scope = 'personal' AND id = (auth.uid())::text)
    )
    WITH CHECK (
      (scope = 'team' AND is_admin())
      OR (scope = 'personal' AND id = (auth.uid())::text)
    );


-- ----------------------------------------------------------------------------
-- 8c. Vault Change Requests Table
--    Lets a non-admin member propose a new value for one field of a Team
--    Vault credential set (e.g. "I changed the VPN password, here's the new
--    one") without being able to write to vault_entries directly. An admin
--    reviews the request and either applies it (re-encrypting the target
--    entry under the team key) or rejects it.
--
--    `new_value` holds `JSON.stringify(EncryptedEnvelope)` — the proposed
--    value (and optional secure-link URL) encrypted client-side under the
--    Team Vault key before insert, the same AES-256-GCM envelope format used
--    by vault_entries.fields (see vault-crypto.ts). The submitting member's
--    browser already has the Team Vault unlocked at that point (that's how
--    they saw the field to propose a change to it), so this never touches
--    the network or the database in plain text. RLS additionally restricts
--    read access to the requester and admins. Once approved, the admin
--    decrypts it with the same Team Vault key and re-encrypts the value into
--    vault_entries.fields. Rows written before this fix may still hold a
--    plain string (read as a legacy fallback — see decryptVaultChangeRequestValue
--    in nestor-context.tsx).
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vault_change_requests (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    requester_name TEXT,
    entry_id TEXT NOT NULL REFERENCES public.vault_entries(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL,
    new_value TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.vault_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read own or admin read all vault change requests" ON public.vault_change_requests;
DROP POLICY IF EXISTS "Submit own vault change request" ON public.vault_change_requests;
DROP POLICY IF EXISTS "Admins review vault change requests" ON public.vault_change_requests;

-- A member can see their own submitted requests; admins can see every
-- request. Unlike shift_requests (openly readable by anyone), this contains
-- a proposed credential value, so read access is intentionally restricted.
CREATE POLICY "Read own or admin read all vault change requests" ON public.vault_change_requests
    FOR SELECT TO authenticated
    USING (
      user_id = (select auth.uid())
      OR is_admin()
    );

-- Any authenticated user can submit a request, only as themselves.
CREATE POLICY "Submit own vault change request" ON public.vault_change_requests
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (select auth.uid()));

-- Only admins may update (approve/reject) a request. Nobody deletes these —
-- resolved requests stay in the table as a record, same as shift_requests.
CREATE POLICY "Admins review vault change requests" ON public.vault_change_requests
    FOR UPDATE TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());


-- ----------------------------------------------------------------------------
-- 9. Roster Assignments Table
--    NOTE: this is the ONLY shift-assignment table. There is no separate
--    "shift_assignments" table — earlier app code had a typo referencing one
--    (see nestor-context.tsx clearRosterMonth) which has been corrected to
--    point here instead.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roster_assignments (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    employee_id TEXT NOT NULL,
    date_str DATE NOT NULL,
    shift_code TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (employee_id, date_str)
);

ALTER TABLE public.roster_assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.roster_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read roster assignments" ON public.roster_assignments;
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.roster_assignments;
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.roster_assignments;
DROP POLICY IF EXISTS "Admins can manage roster assignments" ON public.roster_assignments;

-- Read stays open — every member needs to see the full roster to know who's
-- on shift. Direct writes are admin-only; members go through shift_requests
-- (below) instead, matching the app's own "submit request, admin approves"
-- UI flow — the previous "Allow write for authenticated" policy let any
-- member bypass that flow entirely via a direct API call.
CREATE POLICY "Allow read for authenticated" ON public.roster_assignments
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage roster assignments" ON public.roster_assignments
    FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());


-- ----------------------------------------------------------------------------
-- 10. Shift Requests Table
--     Status values are lowercase to match the app code, which always
--     inserts/compares 'pending' | 'approved' | 'declined'.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shift_requests (
    id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
    employee_id TEXT NOT NULL,
    employee_name TEXT,
    date_str DATE NOT NULL,
    requested_shift_code TEXT NOT NULL,
    reason TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Backfill for databases created from the old (capitalized) schema copy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'shift_requests' AND column_name = 'status'
  ) THEN
    UPDATE public.shift_requests SET status = lower(status) WHERE status <> lower(status);
    ALTER TABLE public.shift_requests DROP CONSTRAINT IF EXISTS shift_requests_status_check;
    ALTER TABLE public.shift_requests ALTER COLUMN status SET DEFAULT 'pending';
    ALTER TABLE public.shift_requests ADD CONSTRAINT shift_requests_status_check
      CHECK (status IN ('pending', 'approved', 'declined'));
  END IF;
END $$;

ALTER TABLE public.shift_requests ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

ALTER TABLE public.shift_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read for authenticated" ON public.shift_requests;
DROP POLICY IF EXISTS "Allow write for authenticated" ON public.shift_requests;
DROP POLICY IF EXISTS "Active users submit own requests" ON public.shift_requests;
DROP POLICY IF EXISTS "Users read own requests or admins read all" ON public.shift_requests;
DROP POLICY IF EXISTS "Users withdraw own pending requests or admins delete" ON public.shift_requests;
DROP POLICY IF EXISTS "Admins review shift requests" ON public.shift_requests;

-- The previous "Allow write for authenticated" policy let any member
-- approve/decline their own (or anyone else's) shift-change request
-- directly, bypassing the entire admin-review workflow the app's UI
-- implies exists. Replaced with the same request/approve shape already used
-- correctly for vault_change_requests: submit your own (pending only),
-- read your own or all if admin, withdraw your own pending one (or admin
-- deletes any), and only an admin may change `status` (approve/decline).
CREATE POLICY "Active users submit own requests" ON public.shift_requests
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() AND is_active_user() AND status = 'pending');

CREATE POLICY "Users read own requests or admins read all" ON public.shift_requests
    FOR SELECT TO authenticated
    USING (is_admin() OR (user_id = auth.uid() AND is_active_user()));

CREATE POLICY "Admins review shift requests" ON public.shift_requests
    FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE POLICY "Users withdraw own pending requests or admins delete" ON public.shift_requests
    FOR DELETE TO authenticated
    USING (is_admin() OR (user_id = auth.uid() AND status = 'pending' AND is_active_user()));


-- ============================================================================
-- 11. Admin User-Management RPCs
--     (SECURITY DEFINER functions gating writes to auth.users / profiles)
-- ============================================================================

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
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can create users.';
  END IF;

  IF p_email IS NULL OR btrim(p_email) = ''
     OR p_password IS NULL OR p_password = ''
     OR p_username IS NULL OR btrim(p_username) = '' THEN
    RAISE EXCEPTION 'Email, password, and username are required.';
  END IF;

  -- See docs/security-audit.md Finding 6: this RPC previously accepted any
  -- non-empty password (e.g. "a"). Client-side forms already enforce a
  -- minimum, but that's trivially bypassed by calling this RPC directly.
  IF length(p_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long.';
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
  )
  VALUES (
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
  )
  VALUES (
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

  -- Some Supabase projects have an auth.users trigger that also creates this
  -- row; update it with the admin-selected values instead of inserting twice.
  INSERT INTO public.profiles (id, employee_id, email, username, role, status, last_seen_at)
  VALUES (
    v_user_id,
    'EMP-' || substring(v_user_id::text FROM 1 FOR 4),
    lower(btrim(p_email)),
    btrim(p_username),
    p_role,
    'pending',
    now()
  )
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


-- Lets a signed-in pending user complete their mandatory first-login password
-- change without exposing direct write access to auth.users.
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
  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long.';
  END IF;

  SELECT status INTO v_status FROM public.profiles WHERE id = v_user_id;
  IF v_status IS DISTINCT FROM 'pending' THEN
    RAISE EXCEPTION 'This password setup link is no longer active.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = v_user_id;

  UPDATE public.profiles SET status = 'active' WHERE id = v_user_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.complete_initial_password(TEXT) TO authenticated;


-- Lets admins update a user's employee ID without granting broad profile
-- update permission to every authenticated user.
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
  v_new_id TEXT := NULLIF(btrim(p_employee_id), '');
  v_conflict_username TEXT;
BEGIN
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Only administrators can update employee IDs.';
  END IF;

  -- Two profiles sharing one Employee ID silently merge their Shift Roster
  -- data (roster_assignments/calendar_assignments are keyed by employee_id,
  -- not by auth user id) — one user's shifts would appear on the other
  -- account. Check explicitly for a friendlier error than the raw unique
  -- constraint violation (see profiles_employee_id_unique, decisions.md ADR-017).
  IF v_new_id IS NOT NULL THEN
    SELECT username INTO v_conflict_username
    FROM public.profiles
    WHERE employee_id = v_new_id AND id != p_user_id
    LIMIT 1;

    IF v_conflict_username IS NOT NULL THEN
      RAISE EXCEPTION 'Employee ID "%" is already assigned to user "%". Each user must have a unique Employee ID.', v_new_id, v_conflict_username;
    END IF;
  END IF;

  UPDATE public.profiles
  SET employee_id = v_new_id
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.admin_update_user_employee_id(UUID, TEXT) TO authenticated;


-- Lets admins reset any user's password securely.
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

  IF p_new_password IS NULL OR length(p_new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters long.';
  END IF;

  UPDATE auth.users
  SET encrypted_password = crypt(p_new_password, gen_salt('bf', 10)),
      updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found.';
  END IF;

  -- Force user status back to pending so they must change it upon next login
  UPDATE public.profiles SET status = 'pending' WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.admin_reset_password(UUID, TEXT) TO authenticated;


-- Lets admins delete any user securely (with a self-delete guard).
CREATE OR REPLACE FUNCTION public.admin_delete_user(
  p_user_id UUID
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


-- ============================================================================
-- 12. Base table privileges
-- ============================================================================
-- RLS policies only restrict WHICH ROWS a role can touch — they do nothing
-- until the role also has the underlying table-level GRANT (INSERT/SELECT/
-- UPDATE/DELETE), which Postgres checks first. A normal Supabase project
-- bootstraps a schema-wide `ALTER DEFAULT PRIVILEGES` rule so every new
-- table automatically gets these grants — but if that default ever isn't in
-- place for this project (e.g. tables created through a different path, or a
-- REVOKE was run at some point), newly created tables silently end up with
-- no grant at all and every write fails with
-- `permission denied for table ...` (error 42501), even though the RLS
-- policies above look completely correct. Setting these explicitly here
-- removes the dependency on that default being configured correctly.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Make sure any table created after this script runs still gets the same
-- grants automatically, so this class of bug can't resurface silently.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO authenticated;

NOTIFY pgrst, 'reload schema';
