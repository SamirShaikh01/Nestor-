# API Documentation

## There is no REST/GraphQL API in this app

Nestor has **zero** Next.js API routes (`app/api/` does not exist) and no server-side Supabase
client. Every piece of data access is one of two things:

1. **Direct Supabase table operations** from the browser via `@supabase/supabase-js`
   ([../src/shared/lib/supabase.ts](../src/shared/lib/supabase.ts)), gated entirely by
   Row Level Security (see [auth.md](auth.md), [database.md](database.md)).
2. **RPC calls** to a small number of `SECURITY DEFINER` Postgres functions, for the handful of
   operations that need to touch `auth.users` (which RLS can't protect, since it's not one of
   *our* tables).

This document is the contract for both. If a future architecture introduces real API routes, this
file's structure (Purpose / Input / Output / Auth / Validation / Error Handling) should carry over
directly.

---

## Part 1 — RPCs (`SECURITY DEFINER` functions)

All defined in [../supabase_schema.sql](../supabase_schema.sql), called via
`supabase.rpc(name, params)`.

### `admin_create_user`
- **Purpose**: create a new team member (auth user + profile).
- **Input**: `p_email: text, p_password: text, p_username: text, p_role: text ('admin'|'member')`
- **Output**: `uuid` (the new user's id)
- **Auth**: caller must have `profiles.role = 'admin'` (checked inside the function itself, not
  by RLS — RLS doesn't apply to `auth.users`).
- **Validation**: email/password/username required and non-empty; role must be `admin` or
  `member`; email must not already exist in `auth.users`.
- **Error handling**: `RAISE EXCEPTION` on any validation failure — surfaces as a Postgrest error
  to the caller (`user-management-module.tsx` catches and displays it).
- **Side effects**: inserts into `auth.users`, `auth.identities`, and `profiles` (status starts
  as `'pending'`, forcing the mandatory first-login password change).

### `complete_initial_password`
- **Purpose**: let a signed-in `'pending'` user set their own password on first login, without
  ever granting the browser direct `UPDATE` rights on `auth.users`.
- **Input**: `p_new_password: text`
- **Output**: `void`
- **Auth**: caller must be signed in (`auth.uid()` not null); their own `profiles.status` must be
  `'pending'`.
- **Validation**: password minimum 6 characters.
- **Error handling**: `RAISE EXCEPTION` (not signed in / password too short / status not pending).
- **Side effects**: updates `auth.users.encrypted_password`; flips `profiles.status` to `'active'`.

### `admin_update_user_employee_id`
- **Purpose**: let an admin set/change a user's employee ID without granting broad `profiles`
  `UPDATE` access to every authenticated user (which the general "manage own profile" RLS policy
  would otherwise require for a *different* user's row).
- **Input**: `p_user_id: uuid, p_employee_id: text`
- **Output**: `void`
- **Auth**: caller must be `admin`.
- **Validation**: target user must exist (`NOT FOUND` check).
- **Error handling**: `RAISE EXCEPTION`.

### `admin_reset_password`
- **Purpose**: admin-triggered password reset for another user.
- **Input**: `p_user_id: uuid, p_new_password: text`
- **Output**: `void`
- **Auth**: caller must be `admin`.
- **Validation**: new password required/non-empty; target user must exist.
- **Error handling**: `RAISE EXCEPTION`.
- **Side effects**: updates `auth.users.encrypted_password`; forces `profiles.status` back to
  `'pending'` so the target user must set a new password on next login.

### `admin_delete_user`
- **Purpose**: admin-triggered user deletion.
- **Input**: `p_user_id: uuid`
- **Output**: `void`
- **Auth**: caller must be `admin`.
- **Validation**: **self-delete guard** — `p_user_id = auth.uid()` raises an exception; target
  user must exist.
- **Error handling**: `RAISE EXCEPTION`.
- **Side effects**: deletes from `profiles` then `auth.users`.

---

## Part 2 — Table operations (the real "API surface")

Every one of these goes through `src/shared/context/nestor-context.tsx` (the single global state
provider — see [brain.md](brain.md) section 3). None of them have their own file/route; they're
functions on the `useNestor()` context. Full table schemas are in [database.md](database.md).

| Context function(s) | Table(s) | Auth boundary | Failure behavior |
|---|---|---|---|
| `addTask`/`updateTask`/`deleteTask` | `tasks` | Owner-only RLS | Falls back to local-only state + toast |
| `addTicket`/`updateTicket`/`deleteTicket`/`addTicketWorkLog` | `tickets`, `ticket_work_logs` | Owner-only (tickets); read-all/write-own (work logs) | Falls back to local-only state + toast |
| `addOemCase`/`updateOemCase`/`deleteOemCase` | `oem_cases` | Any authenticated (shared log) | Local optimistic update always applied + toast on failure |
| `assignRosterShift`/`bulkAssignRosterShifts`/`saveRosterChanges`/`clearRosterMonth` | `roster_assignments` | Any authenticated (shared roster) | No local fallback — failure skips the optimistic update + toast |
| `submitShiftRequest`/`reviewShiftRequest` | `shift_requests`, `roster_assignments` | Any authenticated | `submitShiftRequest` returns `boolean`; the calling UI only shows success on `true` |
| `addVaultProductGroup`/`removeVaultProductGroup`/`addVaultClientSection`/`removeVaultClientSection`/`addVaultEntry`/`updateVaultEntry`/`removeVaultEntry` | `vault_products`, `vault_clients`, `vault_entries` | **Admin-only** (`requireAdminForVault` guard + RLS) | No-op + toast for non-admins; local optimistic update + toast on Supabase failure |
| `addPersonalVaultEntry`/`updatePersonalVaultEntry`/`removePersonalVaultEntry` | `personal_vault` | Owner-only RLS | Local optimistic update + toast on failure |
| `updateMasterPassword`/`updatePersonalVaultPin`/`setupTeamVaultRecoveryKit`/`setupPersonalVaultRecoveryKit`/`recoverTeamVaultWithCode`/`recoverPersonalVaultWithCode`/`resetTeamVault`/`resetPersonalVault` | `vault_entries`, `personal_vault`, `vault_key_wraps` | Team-scope functions admin-only; personal-scope functions owner-only | Fails closed — passphrase/PIN state is only updated in memory after every DB write succeeds |
| User Management module (create/reset/delete/update employee ID) | via RPCs only, see Part 1 | Admin-only (enforced server-side in the RPC) | Postgrest error surfaced directly in the UI |

### General patterns across all of the above
- **Optimistic UI**: most writes update local React state immediately, then sync to Supabase in
  the background. A small number of paths that have no sensible "local-only" fallback (roster
  assignments, shift requests) instead skip the optimistic update entirely on failure, so the UI
  never shows something as saved when it wasn't.
- **Error surfacing**: a lightweight toast system
  ([../src/shared/components/ui/toast.tsx](../src/shared/components/ui/toast.tsx)) shows a
  human-readable message on every write failure, with the underlying Postgrest
  `message`/`code`/`hint`/`details` both logged to console and interpolated into the toast text
  (via the `describeSupabaseError` helper) — this was added specifically because raw error
  objects don't always render usefully through generic `console.error(label, errorObject)` calls.
- **Validation**: happens client-side via `zod` schemas in form components (`task-form.tsx`,
  `ticket-form.tsx`) before a write is attempted; there is no server-side validation layer beyond
  Postgres column constraints (`NOT NULL`, `CHECK`, foreign keys) and the RPCs' own checks.
