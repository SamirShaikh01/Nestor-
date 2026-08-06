# Database Architecture

Nestor is powered by a PostgreSQL database hosted on **Supabase**. The single source of truth for
schema, RLS policies, admin RPCs, and privilege grants is [../supabase_schema.sql](../supabase_schema.sql)
at the repo root — it is fully idempotent (safe to re-run against an existing database) and should
be the only place schema changes are made. This document is a human-readable summary of that file;
if the two ever disagree, the SQL file is authoritative.

## Supabase Client Integration

The application interfaces with the database through the `@supabase/supabase-js` client,
configured in [../src/shared/lib/supabase.ts](../src/shared/lib/supabase.ts). There is no server-side
Supabase client (service role) anywhere in this app — every table access goes through the
browser-side anon-key client, which is why Row Level Security (below) is the real security
boundary, not application code.

## Core Tables

### 1. `profiles`
One row per authenticated user (mirrors `auth.users`).
- `id` (UUID, PK, references `auth.users`)
- `employee_id`, `email`, `username` (Text)
- `role` (`'admin' | 'member'`)
- `status` (`'active' | 'disabled' | 'pending'`) — `'pending'` forces the mandatory first-login
  password change flow
- `last_seen_at`, `created_at`, `updated_at`
- RLS: any authenticated user can `SELECT` all profiles; a user can only write their own row.

### 2. `tasks`
Personal task log entries (Task Log module).
- `id` (BIGINT identity, PK), `user_id` (owner)
- `title`, `description`, `category`, `status`, `duration_minutes`, `tags[]`, `date`, `notes`,
  `sessions[]` (logged Play/Pause time-tracking sessions), `created_at`, `updated_at`
- RLS: owner-only (`user_id = auth.uid()`) for all operations.

### 3. `tickets`
IT/operational support tickets (Ticket Log module).
- `id` (TEXT, e.g. `INC-23911`, PK), `user_id` (owner)
- `customer_id`, `customer_name`, `subject`, `details`, `priority` (`P1`–`P6`), `status`, `product`,
  `raised_by`, `date`, `my_work`, `my_note`, `comments` (JSONB), `created_at`, `updated_at`
- Unique constraint on `(id, user_id)` — required by the app's `upsert(..., { onConflict: "id, user_id" })`.
- RLS: owner-only.

### 3b. `ticket_work_logs`
Per-user work-log history entries attached to a ticket (a ticket can accumulate many, one per
person who worked on it).
- `id` (BIGINT identity, PK), `ticket_id` (FK → `tickets`, `ON DELETE CASCADE`), `user_id`
- `author_name`, `date`, `my_work`, `my_note`, `created_at`, `updated_at`
- RLS: any authenticated user can read (teammates need the full history); only the log's own
  author can insert/update/delete it.
- Deleting a ticket explicitly deletes its work logs first (belt-and-suspenders alongside the
  `ON DELETE CASCADE` FK).

### 4. `oem_cases`
OEM vendor support cases (OEM Case Log module).
- `id` (TEXT, PK), `product_name`, `product_category`, `client_id`, `client_name`, `case_type`,
  `oem_case_id`, `internal_ticket_id`, `title`, `description`, `priority`, `assigned_to`,
  `raised_by`, `created_date`, `updated_date`, `status_update`, `closure_date`, `notes`,
  `created_at`, `updated_at`
- RLS: any authenticated user can read/write (centralized, not owner-scoped — this is a shared
  team log, not personal data).

### 5–7. Team Password Vault: `vault_products`, `vault_clients`, `vault_entries`
A three-level tree: Product Group (e.g. "PAM") → Client Setup (e.g. "4130 — SIDBI") → Credential
Set. See [auth.md](auth.md) for the full encryption architecture.
- `vault_products`: `id`, `category`, `product_name`, timestamps.
- `vault_clients`: `id`, `product_id` (FK), `client_id`, `client_name`, timestamps.
- `vault_entries`: `id`, `product_id` (FK), `client_id` (FK), `label` (plaintext entry name),
  `title` (deprecated, read-only legacy fallback), `added_by`, `notes` (unused by the app now —
  see below), `fields` (JSONB — holds an **encrypted envelope** `{ __enc: 1, iv, data }`, never
  plaintext credential values), timestamps.
- RLS: `SELECT` open to any authenticated user (every user can view/copy team credentials);
  `INSERT`/`UPDATE`/`DELETE` require `profiles.role = 'admin'` on all three tables — the Team
  Vault is centralized and admin-managed by design.

### 8. `personal_vault`
Each user's private credential entries, same shape as `vault_entries` but with `user_id` instead
of product/client foreign keys.
- `id`, `user_id`, `label`, `title` (deprecated), `notes` (unused, see below), `username`,
  `fields` (encrypted envelope), timestamps.
- RLS: strictly owner-scoped (`user_id = auth.uid()`) for all operations — no admin override,
  since this is private per-user data, not the centralized Team Vault.

> **On `notes`**: for both `vault_entries` and `personal_vault`, this column is left `NULL`/unused
> by current app writes — the entry's notes are serialized *inside* the same encrypted `fields`
> envelope alongside the field values, not stored as a separate plaintext column. The column is
> kept only so any legacy pre-encryption rows aren't destructively altered.

### 8b. `vault_key_wraps` (Recovery Kit)
Supports the Password Vault's forgotten-password recovery feature — see [auth.md](auth.md) for
the full design. Each vault scope's entries are encrypted with a random Data Encryption Key (DEK);
this table stores that DEK wrapped (encrypted) once under the current passphrase and once under a
one-time recovery code.
- `id` (TEXT, PK — `'team'` for the shared Team Vault, or a user's `auth.uid()` for their Personal
  Vault), `scope` (`'team' | 'personal'`), `wrapped_dek_passphrase` (JSONB envelope),
  `wrapped_dek_recovery` (JSONB envelope), timestamps.
- RLS: the Team Vault row (`scope='team'`) is readable by any authenticated user (they all need it
  to decrypt Team Vault entries) but only writable by admins; a Personal Vault row is only
  readable/writable by its own owner.
- Setting up a Recovery Kit is **optional** — a scope with no row here still works exactly as
  before (entries encrypted directly under the passphrase-derived key, no DEK).

### 9. `roster_assignments`
The team Shift Roster's actual assigned shifts, and also what the personal Calendar module reads
from/writes to when Supabase is configured (there is no separate `shift_assignments` table — an
earlier version of the app code had a bug referencing one that never existed; it's been corrected
to use this table).
- `id` (BIGINT identity, PK), `employee_id`, `date_str`, `shift_code`, timestamps.
- Unique constraint on `(employee_id, date_str)` — one shift per employee per day.
- RLS: any authenticated user can read/write (shared team roster data).

### 10. `shift_requests`
A non-admin user's requested shift change, submitted from the Calendar module and reviewed from
the Shift Roster's "Change Requests" tab.
- `id` (BIGINT identity, PK), `user_id`, `employee_id`, `employee_name`, `date_str`,
  `requested_shift_code`, `reason`, `status` (`'pending' | 'approved' | 'declined'`, lowercase —
  matches the app code exactly), `created_at`, `updated_at`.
- RLS: any authenticated user can read/write.
- Approving a request writes the resulting shift directly into `roster_assignments`.

## Admin RPCs (`SECURITY DEFINER` functions)

Since there is no server-side Supabase client in this app, privileged operations on `auth.users`
are exposed as `SECURITY DEFINER` Postgres functions instead, each independently checking
`profiles.role = 'admin'` before doing anything. Full input/output contracts for each are in
[api.md](api.md).

- `admin_create_user(email, password, username, role)` — creates the `auth.users` row, `identities`
  row, and `profiles` row; new users start in `'pending'` status.
- `complete_initial_password(new_password)` — lets a signed-in `'pending'` user set their own
  password on first login, without granting broad `auth.users` write access.
- `admin_update_user_employee_id(user_id, employee_id)`
- `admin_reset_password(user_id, new_password)` — also forces the target user back to `'pending'`.
- `admin_delete_user(user_id)` — includes a self-delete guard (an admin cannot delete their own
  account this way).

## Row Level Security (RLS)

Every table has RLS enabled — this is the actual security boundary for this app (there's no
server-side code to enforce anything else). The two ownership patterns used throughout:
- **Owner-scoped** (`tasks`, `tickets`, `personal_vault`, part of `profiles`): a user can only
  touch their own rows.
- **Shared/centralized** (`oem_cases`, `roster_assignments`, `shift_requests`): any authenticated
  user can read and write — these are team-wide operational logs, not personal data.
- **Admin-gated shared** (`vault_products`, `vault_clients`, `vault_entries`): any authenticated
  user can read, but only admins can write — the Team Vault is centralized but member-writable
  data would defeat its "governed by admins" purpose.

## Base table privileges (GRANT)

RLS alone does not grant access — Postgres also requires the underlying table-level GRANT
(`SELECT`/`INSERT`/`UPDATE`/`DELETE`) before RLS is even evaluated. `supabase_schema.sql` ends with
an explicit `GRANT ... ON ALL TABLES IN SCHEMA public TO authenticated` (plus sequence grants, plus
an `ALTER DEFAULT PRIVILEGES` rule so future tables inherit this automatically) — this was added
after a real incident where several tables silently had no grant at all, causing every write to
fail with `permission denied for table ...` (42501) despite correct-looking RLS policies.

## A recurring class of bug: schema drift on this project

Multiple times during development, tables in the connected Supabase project turned out to have a
different real column set than `supabase_schema.sql` assumed (a `title` column missing from
`vault_entries`, `updated_at` missing from several tables despite a generic "set updated_at on row
change" trigger being attached project-wide). See [decisions.md](decisions.md) for the full
incident history. The practical takeaway for any future schema change: **always add new columns
as `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, never assume `CREATE TABLE IF NOT EXISTS` alone
guarantees a column exists on this project.**
