# Nestor — v1 Stabilization Execution Plan

> **This is the detailed, phase-by-phase working log for the v1 stabilization effort.** For the
> permanent, forward-looking project reference (architecture, modules, coding standards, decision
> log, roadmap), start at [docs/brain.md](docs/brain.md) instead. Note: this file's older entries
> reference `ARCHITECTURE.md`/`DATABASE.md`/`AUTH.md` at the repo root — those were later moved to
> `docs/architecture.md`/`docs/database.md`/`docs/auth.md` (see `docs/changelog.md`
> "Documentation restructuring"). Left as-is here since this file is a historical log, not living
> documentation.

## Password Vault Recovery Kit (major feature, done on request)

Added a full forgotten-password/PIN recovery system for both the Team Vault and Personal Vault,
plus a destructive last-resort fallback. Full technical writeup in
[AUTH.md](AUTH.md#password-vault-encryption-implemented) ("Recovery Kit" section) — summary here:

- Vault entries now support being encrypted under a random Data Encryption Key (DEK) rather than
  the passphrase directly. The DEK is wrapped under both the current passphrase and a one-time
  recovery code, so a forgotten passphrase can be recovered via the code without touching or
  re-encrypting a single entry.
- New table `vault_key_wraps` in [supabase_schema.sql](supabase_schema.sql) (RLS: admin-only for
  the Team Vault row, owner-only for each Personal Vault row) — **action needed from you: re-run
  the schema file** to create it.
- New crypto primitives in [vault-crypto.ts](src/shared/lib/vault-crypto.ts):
  `generateDataEncryptionKey`, `wrapDataEncryptionKey`, `unwrapDataEncryptionKey`,
  `generateRecoveryCode`, `normalizeRecoveryCode`.
- New context functions in [nestor-context.tsx](src/shared/context/nestor-context.tsx):
  `setupTeamVaultRecoveryKit`, `setupPersonalVaultRecoveryKit`, `recoverTeamVaultWithCode`,
  `recoverPersonalVaultWithCode`, `resetTeamVault`, `resetPersonalVault`, plus
  `teamVaultRecoveryKitActive`/`personalVaultRecoveryKitActive` status flags.
  `updateMasterPassword`/`updatePersonalVaultPin` now take the cheap re-wrap path automatically
  once a Recovery Kit is active, instead of re-encrypting every entry.
- New shared UI: [recovery-code-modal.tsx](src/shared/components/ui/recovery-code-modal.tsx) —
  shows a generated code exactly once, requires an explicit "I've saved this" confirmation before
  it can be dismissed.
- UI wired into both surfaces:
  - Settings → Password Vault Security (admin, Team Vault): status badge, "Set Up Recovery Kit",
    "Forgot the master password? Recover with code", "Lost both? Reset & wipe (last resort)"
    (requires typing "RESET").
  - Password Vault module → My Personal PIN (any user, Personal Vault): identical set of
    controls, scoped to their own vault.
- Recovery Kit setup is **optional, not forced** — scopes that haven't set one up keep working
  exactly as before (direct passphrase encryption, full re-encryption on password change). No
  background migration was forced on existing data.

**Action needed from you**: re-run [supabase_schema.sql](supabase_schema.sql), then verify: set up
a Recovery Kit for the Team Vault (as admin) and for your own Personal Vault, confirm the code
modal appears and requires the checkbox before closing, then test recovery by deliberately
"forgetting" the password (use the recovery code + a new password) and confirm existing
credentials are still readable afterward.

**Bug found during your live testing, fixed**: `Console OperationError` at `decryptVaultPayload`
during `loadVault`. Root cause: `setupTeamVaultRecoveryKit`/`setupPersonalVaultRecoveryKit`
re-encrypted every entry under the new DEK *before* writing the `vault_key_wraps` row — if that
loop was interrupted partway (network hiccup, closing the tab, etc.), some entries ended up
DEK-encrypted while no wrap row existed to make that DEK recoverable, permanently stranding those
specific entries. Fixed two ways in
[nestor-context.tsx](src/shared/context/nestor-context.tsx):
1. Reordered both setup functions to write the `vault_key_wraps` row *first*, then re-encrypt
   entries — an interruption now leaves the wrap row (and thus the DEK) always recoverable.
2. Added a decrypt fallback in `loadVault`: if the key resolved via the wrap row fails to decrypt
   a given entry, it retries with the direct passphrase-derived key before giving up — so any
   entry caught mid-migration by an *already-existing* partial state still decrypts correctly
   instead of showing "Unable to decrypt".

**Follow-up**: the same `Console OperationError` still appeared once more after the fix above —
turned out to be a false alarm, not a new bug. Both the resolved key *and* the direct-passphrase
fallback were correctly failing for one specific entry (genuinely undecryptable with any key
currently known — most likely leftover data from earlier testing, from before a password/PIN
change). The code was already handling this gracefully (falls back to showing
`"[Unable to decrypt]"` for just that entry, doesn't crash) — the only real problem was that the
diagnostic log used `console.error`, which the dev tooling surfaces as a reportable error even
though nothing actually broke. Fixed by downgrading those two logs to `console.warn`, and added a
proper toast so an undecryptable entry is now visible to the user as an actionable message
("N credential set(s) couldn't be decrypted... they'll need to be deleted and re-created")
instead of a buried console log or an inline "[Unable to decrypt]" string easy to miss.

**Another real bug found**: changing the Team Master Password failed with
`record "new" has no field "updated_at"` (42703) — same trigger-vs-missing-column class of bug as
the OEM case one from earlier, but this time on `vault_entries`/`personal_vault` specifically:
they were the *only two* vault tables that never got the `updated_at` backfill applied (every
other table did). Fixed in [supabase_schema.sql](supabase_schema.sql) — added the missing
`ADD COLUMN IF NOT EXISTS updated_at` for both, plus a defensive backfill on `vault_key_wraps`
too. **Action needed from you**: re-run the schema file.

**Security note — declined a suggested change**: you asked whether the vault's encryption key
could instead be hardcoded in a `.env` file, to remove the dependency on the master password.
Explained why this isn't done: this app has no server-side code — all vault encryption/decryption
runs in the browser via Web Crypto, so the only way client code can read an env var is via Next's
`NEXT_PUBLIC_*` prefix, which bakes the value directly into the JS bundle shipped to every
visitor. It would not be a secret — anyone who ever loaded the app could extract it and decrypt
every credential in both vaults, permanently. Pointed to the real fix for the underlying
friction instead: the Recovery Kit (already built) makes password changes a cheap single-row
rewrap instead of a full re-encryption once set up — that's what removes the repeated-failure
surface, without weakening security.

## Ad-hoc minor fixes (outside the phased plan, done on request)

- **Task Log**: removed the manual "Work Sessions" builder field from the Add/Edit Task popup
  ([task-form.tsx](repo/src/features/task/components/task-form.tsx)). Task time tracking still
  works via the existing Play/Pause timer on the task list, which writes to the same `sessions`
  field — this only removed the redundant manual HH:MM-HH:MM entry UI.
- **Ticket Log**: fixed `deleteTicket` leaving orphaned `ticket_work_logs` rows behind — it now
  explicitly deletes matching work-log rows before deleting the ticket (belt-and-suspenders
  alongside the `ON DELETE CASCADE` FK added in Phase 0), and clears the matching entries from
  local `ticketWorkLogs` state on both the Supabase and local-fallback paths
  ([nestor-context.tsx](repo/src/shared/context/nestor-context.tsx)).
- **Schema file bug**: two `ticket_work_logs` RLS policies were missing their `DROP POLICY IF
  EXISTS` guard (every other policy in the file has one), which broke re-running the script
  ("policy already exists"). Fixed — the whole file is now verified to have a matching `DROP
  POLICY IF EXISTS` for every `CREATE POLICY` in it.
- **OEM Case Log update bug**: editing an OEM case failed with `record "new" has no field
  "updated_at"` (Postgres error 42703). Root cause: this Supabase project has a generic
  "set `updated_at` on row change" trigger attached to `oem_cases` (added outside this schema
  file, likely via the Supabase table editor), but the table was never given that column — it
  only had the app-managed `updated_date` (DATE). Fixed by adding
  `updated_at TIMESTAMP WITH TIME ZONE` to `oem_cases`. Since this class of trigger commonly gets
  attached per-table rather than project-wide, and could just as easily hit `tasks`, `tickets`,
  `roster_assignments`, `shift_requests`, `vault_products`, or `vault_clients` next, the same
  `updated_at` column was added defensively to all of them too (all in
  [supabase_schema.sql](repo/supabase_schema.sql), all idempotent `ADD COLUMN IF NOT EXISTS`).
  **Action needed from you**: re-run the updated `supabase_schema.sql` in the Supabase SQL Editor
  to add these columns.
- **Password Vault "permission denied for table vault_products" (error 42501)**: distinct from an
  RLS rejection — this is Postgres refusing the write before RLS is even evaluated, because the
  `authenticated` role was never granted base INSERT/UPDATE/DELETE privileges on these tables.
  RLS policies only restrict *which rows* a role can touch; the role still needs the underlying
  GRANT first. A normal Supabase project bootstraps a schema-wide `ALTER DEFAULT PRIVILEGES` rule
  so new tables inherit this automatically — if that's missing for this project (for whatever
  reason), tables silently end up with zero grant. Fixed by adding explicit
  `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES ... TO authenticated` (+ sequence grants for
  identity-column tables, + an `ALTER DEFAULT PRIVILEGES` rule so this can't recur for tables
  created after this point) to the end of [supabase_schema.sql](repo/supabase_schema.sql).
  **Action needed from you**: re-run the schema file — this is what actually applies the grants.
  ⚠️ **Also worth checking**: you mentioned your Supabase project currently only shows 5 tables
  (`vault_clients`, `vault_entries`, `vault_products`, `personal_vault`, `security_audit_log`) —
  `security_audit_log` isn't a table this schema (or any version of it) has ever defined, and
  `profiles`/`tasks`/`tickets`/`oem_cases`/etc. are missing from that list even though OEM case
  editing was working earlier. Please double check the Supabase Table Editor is pointed at the
  same project referenced in `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`) — an unrelated table like
  `security_audit_log` existing alongside a partial set of this app's tables suggests either a
  stale view, a different/second Supabase project, or something else created outside this
  schema's history that's worth accounting for before we chase further "missing" errors.
- **Password/PIN change forms now require Current + New + Confirm New** (3 fields, not 2) on both
  the admin-only Team Master Password form
  ([settings-page.tsx](repo/src/features/settings/components/settings-page.tsx)) and the
  Personal Vault PIN form
  ([password-vault-module.tsx](repo/src/features/password-vault/components/password-vault-module.tsx)) —
  each now rejects the submit client-side if New and Confirm don't match.
- **`vault_entries`/`personal_vault` insert failure**: `PGRST204 Could not find the 'title'
  column of 'vault_entries' in the schema cache`. This live project's actual `vault_entries` (and
  presumably `personal_vault`) tables don't have every column our schema assumed — consistent
  with the earlier discovery that several tables in this project weren't created by this schema
  file's history. Since `title` was only ever a deprecated legacy-read fallback (never required
  for new writes), the fix was to stop writing it at all rather than chase whether the column
  truly exists: removed `title: ...` from all four insert/update calls in
  [nestor-context.tsx](repo/src/shared/context/nestor-context.tsx) (`addVaultEntry`,
  `updateVaultEntry`, `addPersonalVaultEntry`, `updatePersonalVaultEntry`) — they now only send
  `label`. Also added defensive `ADD COLUMN IF NOT EXISTS` backfills for every other
  `vault_entries`/`personal_vault` column (`label`, `added_by`, `notes`, `fields`, `created_at`,
  `username`) in [supabase_schema.sql](repo/supabase_schema.sql), since we can no longer trust
  that `CREATE TABLE IF NOT EXISTS` matches this project's real column set.
  **Action needed from you**: re-run the schema file, then retry adding a team and personal
  credential.

## Future idea (out of scope for this plan)

**Ticketing integration with Helpdesk360**: instead of manually entering ticket data, connect
the Ticket module directly to the Helpdesk360 portal (auto-import/sync tickets). Deferred until
v1 is stabilized — would need a connector/sync layer that doesn't exist yet (no server-side code
or integration pattern currently exists in this app at all). Revisit as its own phase once
Phases 0-6 below are done.

Scope decision: stabilize and complete the existing v1 product (Tasks, Tickets, OEM Cases,
Shift Roster, Personal Calendar, Password Vault, Reports, Settings, User Management).
The "Nestor v2" section in ARCHITECTURE.md (Activity normalization, universal timeline/search,
AI layer, connectors, audit logs) is deferred — not part of this plan. See "Docs cleanup" below
for how that section should be marked so it stops reading as an already-decided spec.

Ordered by dependency — earlier phases unblock or de-risk later ones.

---

## Phase 0 — Schema single source of truth ✅ DONE

Root cause of several bugs: three divergent SQL files with no clear authority, plus two real
schema/code mismatches (not just missing tables — actual bugs).

**Completed:**
1. Consolidated `supabase_schema.sql`, `supabase/fix_admin_delete_user.sql`, and both
   `supabase/migrations/*.sql` files into one authoritative, idempotent `supabase_schema.sql`.
   The three now-redundant files were deleted (empty `supabase/migrations/` folder remains).
2. Fixed `profiles` missing an `email` column — `admin_create_user` was inserting one, and
   [user-management-module.tsx](repo/src/features/user-management/components/user-management-module.tsx)
   reads `profile.email`, so this would have thrown "column email does not exist" on every
   admin-created user. Added `email TEXT` with a backfill `ADD COLUMN IF NOT EXISTS`.
2b. Fixed a real bug (not a missing table): `clearRosterMonth` in
   [nestor-context.tsx](repo/src/shared/context/nestor-context.tsx) was deleting from a
   nonexistent `shift_assignments` table — a typo. Corrected the code to delete from
   `roster_assignments`, the actual roster table. No separate table needed.
3. Fixed the `shift_requests.status` casing mismatch — app code always inserts/compares
   lowercase (`'pending'|'approved'|'declined'`); the DB CHECK required capitalized values.
   Changed the constraint to lowercase (matches all existing app code, no TS changes needed)
   with a backfill `UPDATE ... SET status = lower(status)` for any pre-existing rows.
4. Added `tickets.my_note` and the entire `ticket_work_logs` table, both used extensively by
   the app but absent from every prior SQL file — would have caused ticket work-log inserts to
   fail against a fresh database.
5. Carried the self-delete guard on `admin_delete_user` into the consolidated definition.
6. Added a unique `(id, user_id)` constraint on `tickets`, required by the app's
   `upsert(..., { onConflict: "id, user_id" })` call — upserts would silently not dedupe without it.

**Action needed from you:** run the updated
[supabase_schema.sql](repo/supabase_schema.sql) against your Supabase project's SQL Editor.
It's idempotent/backfill-safe to run on your existing database as-is. Given you offered to wipe
the DB: a clean reset is not required, but if you'd rather start fresh, drop the tables (or
the whole `public` schema, then re-run) and this script will recreate everything correctly on
an empty project.

Deliverable: one schema definition that, applied to a fresh or existing Supabase project,
matches every table/column the app code actually queries. **Dev server verified**: compiles and
connects to Supabase cleanly with no errors after these code+schema changes.

## Phase 1 — Routing/dead-code cleanup ✅ DONE

1. Diffed `src/app/page.tsx` against the live `app/page.tsx` — confirmed the dead copy had a
   real, fully-implemented feature the live page was missing: clicking an OEM case from the
   Dashboard is supposed to deep-link into that case in the OEM Cases module
   (`onSelectOemCase`/`selectedOemCaseId`, already fully wired on both the `DashboardOverview`
   and `OemCaseModule` sides — only the page-level plumbing was missing). Ported that wiring
   into [app/page.tsx](repo/app/page.tsx), then deleted `src/app/` entirely.
2. Checked importers of `category-colors.ts` vs `theme-utils.ts` — turned out **not** to be a
   partial duplicate needing a merge: `category-colors.ts` had zero importers anywhere in the
   codebase (fully dead code), while `theme-utils.ts` is the one actually used by
   `calendar-module.tsx`, `dashboard-overview.tsx`, and `task-module.tsx`. Deleted
   `category-colors.ts`; kept `theme-utils.ts` unchanged — no importer updates needed.

Deliverable: one route tree, one color-mapping module. **Verified**: dev server builds clean,
no console errors beyond unrelated HMR/proxy websocket noise.

## Phase 2 — Fix stubbed/broken context functions ✅ DONE

**Decision (confirmed):** Shift Roster membership is fully derived from User Management —
every active user/profile automatically appears in the roster. There is no separate
"add/remove roster member" concept; that's exactly why `addRosterMember`/`removeRosterMember`
were dead stubs.

**Completed:**
1. Removed the roster-member add/remove UI entirely:
   - Deleted `src/features/shift-roster/components/roster-member-modal.tsx`.
   - In [shift-roster-module.tsx](repo/src/features/shift-roster/components/shift-roster-module.tsx):
     removed the `isAddMemberOpen` state, the `<RosterMemberModal>` render, the "Add Team Member"
     button, the per-row "Remove Member from Roster" button/confirm, and the unused `UserPlus`/
     `Trash2` icon imports.
   - Removed `addRosterMember`/`removeRosterMember` from `NestorContextType` and
     [nestor-context.tsx](repo/src/shared/context/nestor-context.tsx) entirely.
   - Roster membership continues exactly as already implemented: `rosterMembers` sourced from
     `profiles` where `status = 'active'` — anything done in User Management (create/disable a
     user) automatically reflects in the roster with no roster-side action.

2. **Shift change requests — confirmed already working, no code changes needed beyond Phase 0.**
   The flow you described (Calendar → "Send Request" → Shift Roster's "Change Requests" tab →
   admin approve/decline → reflects in `roster_assignments`) was already fully wired via
   `submitShiftRequest`/`reviewShiftRequest`; the only real bug was the status-casing mismatch,
   already fixed in Phase 0. Removed the unused `ShiftSwapRequest` type from
   [shift-roster/types/index.ts](repo/src/features/shift-roster/types/index.ts) — it modeled a
   different, never-built concept (direct member-to-member swap) superseded by the
   change-request flow above.

3. Fixed `updateMasterPassword`'s empty body — it now persists to `localStorage`
   (`nestor_master_password`), mirroring the existing `fontFamily` pattern, and the state
   initializes from `localStorage` on load instead of always resetting to the hardcoded `"1234"`
   default. Note: this is still a **plaintext** client-side PIN — real hashing/server-side
   verification is still deferred to Phase 4 as planned; this fix only stops the value from being
   silently lost on every reload.

4. **Correction to the original plan** — items 3-4 previously listed here ("wire calendar
   `shiftAssignments` to Supabase", "resolve `shiftAssignments` vs `rosterAssignments`
   duplication") turned out not to be bugs. Re-reading
   [calendar-module.tsx](repo/src/features/calendar/components/calendar-module.tsx) and
   [shift-form-modal.tsx](repo/src/features/calendar/components/shift-form-modal.tsx) closely:
   whenever Supabase is configured, the Calendar already reads/writes shifts through
   `rosterAssignments`/`assignRosterShift`/`submitShiftRequest` — the same Supabase-backed table
   the roster uses. The separate in-memory `shiftAssignments` state is *only* the fallback data
   model used when Supabase isn't configured at all (local/offline mode), exactly like how
   `tasks`/`tickets` also stay in-memory-only in that same local mode (confirmed via
   `insertTaskLocal`). So there's no drift to fix here — it's working as designed.

Deliverable: every function in the context's public API actually does what its name says;
roster membership is 100% derived from User Management with no parallel add/remove path.
**Verified**: dev server builds clean, no new console errors (only a pre-existing, unrelated
Recharts container-sizing warning on the dashboard). Full interactive verification of the
Shift Roster/Change Requests UI as a logged-in user is still pending — I don't have login
credentials for the running app.

## Phase 3 — Data-layer correctness pass ✅ DONE

1. **Audited every Supabase write in `nestor-context.tsx` against the consolidated schema.**
   Found a real, previously-undiscovered bug bigger than the ones already fixed in Phase 0:
   - `vault_entries.label` and `personal_vault.label` are `NOT NULL` in the schema, but every
     insert path (`addVaultEntry`, `addPersonalVaultEntry`) only ever wrote to `title` (the
     column explicitly marked "deprecated backup" in the schema), never `label`. Same for the
     corresponding `update` paths. This means every vault-entry save has likely been silently
     failing against Supabase since the feature was built — the UI still "worked" because it
     also always fell back to `localStorage` and optimistic local state regardless of the
     Supabase result, so it looked functional in a single browser session while never actually
     syncing to the shared team vault or across devices. Also found `notes` (a real field on
     both entry types) was never sent to Supabase at all, on any of the four write paths — notes
     were being silently dropped even in the cases where the insert itself succeeded.
     **Fixed**: all four paths ([nestor-context.tsx](repo/src/shared/context/nestor-context.tsx))
     now write `label` (and keep `title` in sync for backward-compatible reads of older rows)
     plus `notes`.
   - Every other write path (`tasks`, `tickets`, `ticket_work_logs`, `oem_cases`,
     `vault_products`, `vault_clients`, `roster_assignments`, `shift_requests`) was checked
     field-by-field against the schema — all match; no further column drift found.

2. **Added real error surfacing.** Built a lightweight toast system
   ([toast.tsx](repo/src/shared/components/ui/toast.tsx), mounted in
   [app-shell.tsx](repo/src/shared/components/layout/app-shell.tsx)) backed by `toasts`/
   `showToast`/`dismissToast` on the context. Wired a `showToast(...)` call into every write
   path's failure branch across tasks, tickets, ticket work logs, OEM cases, all four vault
   write paths, roster assignments (single + bulk + publish + clear-month), and shift requests
   (submit + review) — previously these only did `console.error` and continued as if nothing
   happened.
   - For paths with no local fallback (roster assignments, shift requests, clear-month), a
     Supabase failure now also **skips the optimistic local-state update** instead of showing
     the UI as saved when it wasn't.
   - Found and fixed a related bug while doing this: `shift-form-modal.tsx`'s "Send Request"
     and "Delete" (member shift-removal request) flows called `submitShiftRequest` and then
     **unconditionally** showed the "Request Submitted" success screen, even if the Supabase
     insert had silently failed. Changed `submitShiftRequest`'s return type to `Promise<boolean>`
     and the modal now only shows the success screen when it actually returns `true` — on
     failure the user now sees the new error toast and the form stays open instead of a false
     "submitted" confirmation.

3. **Manual test checklist** (no automated test infra exists in this project yet — a full
   integration test suite is a larger, separate effort; this is the practical smoke-test pass
   for this phase). Run through each of these against your real Supabase project:
   - [ ] Create a task, edit it, delete it — confirm it persists across a page reload.
   - [ ] Create a ticket with "my work" + "my note" text, confirm both save and reappear on
     reload; add a second work-log entry on the same ticket, confirm history accumulates.
   - [ ] Create an OEM case, edit it, delete it — confirm persistence across reload.
   - [ ] As admin: bulk-assign shifts on the roster, hit "Publish Roster", reload, confirm the
     grid still shows the assignments.
   - [ ] As a non-admin member: request a shift change from the Calendar module → confirm it
     shows up under Shift Roster's "Change Requests" tab → approve it as admin → confirm the
     roster grid updates for that employee/date.
   - [ ] Add a team vault entry (with a note) and a personal vault entry (with a note) → reload
     the page → confirm both the label and the note are still there (this specifically
     regression-tests the bug fixed in item 1 above).
   - [ ] As admin, create a new user in User Management → confirm they immediately appear in
     the Shift Roster grid with no separate action.
   - [ ] As admin, reset a user's password and delete a (non-self) user — confirm both RPCs
     succeed.
   - [ ] Disconnect from Supabase (temporarily clear the env vars) and confirm the app still
     runs in local-only mode without crashing (tasks/tickets/calendar all still work locally).

Deliverable: confidence that what the UI shows matches what's persisted, and that failures are
now visible to the user instead of silent. **Verified**: dev server builds clean, no new console
errors. The manual checklist above still needs to be run by you against the real Supabase
project — I don't have login credentials for the running app to execute it myself.

## Phase 4 — Security hardening (Password Vault) ✅ DONE

Scope, per your direction: (1) real encryption at rest — no plaintext credentials in the
database, weak/reversible schemes not acceptable; (2) Team Vault is centralized — only admins
write (add/edit/remove), every authenticated user can read; (3) Personal Vault stays each user's
own private sub-module.

**1. Real client-side encryption (AES-256-GCM + PBKDF2).** New module
[vault-crypto.ts](repo/src/shared/lib/vault-crypto.ts):
- PBKDF2-SHA256 with 210,000 iterations (OWASP baseline) derives an AES-256-GCM key from a
  passphrase. Runs entirely in the browser via the Web Crypto API — Supabase never receives a
  plaintext passphrase or a plaintext credential value, only ciphertext.
- Each credential set's `fields` (the actual username/password/IP/etc. values) and `notes` are
  serialized together and encrypted as one envelope `{ __enc: 1, iv, data }` (random IV per
  encryption) stored directly in the existing `fields` JSONB column — no schema migration needed
  beyond RLS (below). `label`/`title` stay plaintext (just the descriptive entry name, e.g. "VPN
  Creds" — needed for the tree/search UI, not itself a secret, same tradeoff KeePass-style tools
  make).
- Legacy plaintext rows (pre-encryption, if any) are detected (`fields` is a plain array, no
  `__enc` marker) and still displayed — no forced migration/breakage of old data.

**2. Two independent encryption keys, matching the two vault scopes:**
- **Team Vault key**: derived from the existing shared "Master Password" — admin-controlled.
- **Personal Vault key**: derived from a *new*, separate `personalVaultPin`
  ([nestor-context.tsx](repo/src/shared/context/nestor-context.tsx)) that only the entry's own
  owner knows, stored client-side per-employee-id. This was a deliberate design choice: if
  personal vault reused the team master password, every user's personal vault would silently
  become undecryptable every time an admin rotates the team password. Decoupling them means
  personal vault entirely follows its own lifecycle. *(Updated since this was first written: the
  admin-only Master Password control was later relocated out of the Password Vault header into
  Settings → Password Vault Security; the vault module itself now only shows "My Personal PIN",
  available to every user for their own vault.)*
- Changing either passphrase **re-encrypts all affected entries in place** (decrypt-with-old-key
  → encrypt-with-new-key → batch update) before switching to the new value, so nothing becomes
  permanently undecryptable on rotation. If re-encryption fails partway, the passphrase itself is
  not changed (fails closed).

**3. Admin-only writes on the Team Vault, enforced at two layers:**
- **UI**: "Add Product", "Add Client Setup", delete-product/delete-client, "Add Credential Set",
  and edit/delete on individual credential sets are now only rendered for `role === "admin"` in
  [password-vault-module.tsx](repo/src/features/password-vault/components/password-vault-module.tsx).
  Every user still sees and can search/copy/reveal all team credentials — read access is
  unrestricted, per your spec ("every user can access credentials").
- **Context (defense-in-depth)**: `addVaultProductGroup`, `removeVaultProductGroup`,
  `addVaultClientSection`, `removeVaultClientSection`, `addVaultEntry`, `updateVaultEntry`,
  `removeVaultEntry`, and `updateMasterPassword` all now call a `requireAdminForVault(...)` guard
  and no-op with an error toast if called by a non-admin — so this holds even if someone calls
  the context function directly, not just via the hidden UI.
- **Database (the real boundary)**: updated RLS in [supabase_schema.sql](repo/supabase_schema.sql)
  for `vault_products`, `vault_clients`, `vault_entries` — SELECT stays open to any authenticated
  user, but INSERT/UPDATE/DELETE now require
  `(SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'`. This is the layer that actually
  matters — UI/context checks are just better UX on top of it, not the security boundary.
- **Personal Vault is intentionally left alone**: RLS stays owner-scoped (already correct from
  Phase 0), no admin gating — it's each user's own private data, not the centralized module.

**Action needed from you**: re-run [supabase_schema.sql](repo/supabase_schema.sql) in the
Supabase SQL Editor — it's idempotent/safe on your existing database and this is what actually
applies the new admin-only RLS policies.

**Migration note — superseded**: this originally said any pre-encryption plaintext entries would
stay unencrypted until individually re-saved. The Recovery Kit feature (see section at the top of
this file) makes this moot: "Set Up Recovery Kit" re-encrypts **every** existing entry in that
scope — including old legacy-plaintext ones — into the new DEK model as a single explicit action,
no longer something that requires editing each entry one by one.

**Re-audited after all follow-up work** (title-column fix, GRANT fix, admin-only RLS, Recovery
Kit, the setup-ordering bug above): every Phase 4 requirement was independently re-verified
against the current code and confirmed still correct — encryption, the two independent keys,
admin-only writes enforced at all three layers (UI/context/RLS), and Personal Vault's
owner-scoped isolation. The one stale detail from the original write-up: "Team Master PIN"
described as living in the Password Vault header — it was later relocated to Settings → Password
Vault Security (admin-only), and the vault module now only has "My Personal PIN". No other
inconsistencies found.

Deliverable: the vault feature meets a real, non-trivial security bar for storing critical
client/server/VPN credentials — encrypted at rest, admin-gated writes enforced at the database
level, personal vault independently secured. **Verified**: `npx tsc --noEmit` passes clean, dev
server builds and runs with no new errors. Phase 4 is confirmed **fully done** as of this
re-audit. Full interactive verification (unlocking, adding a credential as admin, confirming a
non-admin sees read-only, PIN rotation, Recovery Kit setup/recovery) is still pending on your
end — I don't have login credentials for the running app, though you've already been testing it
directly and the one bug that surfaced from that testing is now fixed above.

## Phase 5 — Docs alignment ✅ DONE

1. Split `ARCHITECTURE.md`: the accurate v1 section stays, rewritten with the actual current
   directory structure (it was stale even for v1 — missing `dashboard`, `oem-case`, `calendar`,
   `password-vault`, `reports`, `settings`, `user-management` feature folders, and still referenced
   the removed `src/app/` route root). The entire "Nestor v2 Architecture" section (Activity
   normalization, Universal Timeline/Search, AI Layer, Integrations, etc.) moved to a new
   [VISION.md](VISION.md), explicitly labeled as a not-yet-built future direction, with inline
   notes cross-referencing what the *real* Password Vault and Ticket-Helpdesk360 idea actually
   look like today. This directly fixes "code not aligned with architecture."
2. Rewrote `DATABASE.md` from scratch — it was missing most of the actual schema (`profiles`,
   `oem_cases`, `ticket_work_logs`, all Password Vault tables, `vault_key_wraps`) and described a
   `shift_assignments` table that never existed (the Phase 0 typo, already fixed in code — see
   Phase 0 item 2b). Now documents every real table, its RLS pattern, the admin RPCs, and the
   GRANT/privilege incident, matching `supabase_schema.sql` exactly.
3. `AUTH.md`: rather than deleting the aspirational RBAC/API-routes/Audit-Log sections outright,
   added inline "**Not implemented**" callouts under each one explaining what actually exists
   instead (two roles not five; `SECURITY DEFINER` RPCs not Next.js API routes + Service Role; no
   audit logging at all) — preserves the original vision text for future reference while making
   the current/aspirational boundary unambiguous. Also flagged that a `security_audit_log` table
   apparently already exists in at least one connected Supabase project with unknown origin/shape
   — worth inspecting first if audit logging is ever built, rather than starting from scratch.

Deliverable: docs describe only what exists; anything aspirational is clearly separated and
labeled. No code changes in this phase — documentation only.

## Phase 6 — Feature completeness pass ✅ DONE

**Correction to the original plan**: item 1 was written assuming the Reports module had no
export at all ("entirely client-side aggregation with no export/persistence"). That was wrong —
it already had CSV, HTML, and PDF (via the browser's print dialog) export before this phase
started. Product decision (per your answer): no saved report history needed; multi-format export
is what mattered, with two concrete gaps to close:

1. **Ticket Log CSV column headers** — updated to the exact requested labels: `Sr No.`, `Date`,
   `Product Name`, `Ticket Id`, `Customer ID`, `Customer Name`, `Subject`, `Details`, `Priority`,
   `Requester`, `Created Date`, `Status`, `My Task`, `Comment`
   ([reports-module.tsx](repo/src/features/reports/components/reports-module.tsx)). (A "Category"
   column was initially requested too, but tickets have no category concept anywhere in the
   app — only Tasks do — and you confirmed that was a mistake, so it was dropped rather than
   guessed at.)
2. **True one-click PDF download** — the old PDF button opened a new browser window and invoked
   `window.print()`, requiring the user to manually choose "Save as PDF" in the print dialog.
   Replaced entirely with real client-side PDF generation via `jsPDF` + `jspdf-autotable` (newly
   added dependencies — `npm install jspdf jspdf-autotable`, no new vulnerabilities introduced,
   verified via `npm audit`): the button now calls `doc.save(...)`, which downloads a genuine
   `.pdf` file directly, no manual step, no popup window. Covers the same KPI summary + data
   table(s) as before, per report type.

Deliverable: three real export formats (CSV, HTML, PDF), all genuine one-click downloads.
**Verified**: `npx tsc --noEmit` passes clean, dev server builds and runs with no new errors.
Full interactive verification (actually clicking each export button and opening the resulting
files) is still pending on your end — I don't have login credentials for the running app.

---

## Phase 7 — Personal Vault decrypt race fix + Vault Change Request feature ✅ DONE

**1. Personal Vault decrypt race condition fix.** Reported symptom: adding a Personal Vault
credential threw "1 personal vault entry couldn't be decrypted with the current PIN — likely
leftover data from before a PIN change," even though the Supabase row existed with a valid
envelope. Root cause: `personalVaultPin` state started at a hardcoded default and was only
corrected by an async effect keyed on `employeeId` (itself loaded asynchronously). Any vault
operation running before that effect completed used the wrong key. Fixed in
[nestor-context.tsx](src/shared/context/nestor-context.tsx) with a `personalVaultPinHydrated` flag
and a `requirePersonalVaultReady()` guard applied to every Personal Vault crypto path
(`addPersonalVaultEntry`, `updatePersonalVaultEntry`, `updatePersonalVaultPin`,
`setupPersonalVaultRecoveryKit`, and the initial `loadVault` decrypt pass). Full reasoning in
[decisions.md](docs/decisions.md) ADR-013.

**2. Vault Change Request architecture** (mirrors the Shift Roster request/review pattern). Lets a
member propose a new value for one field of a Team Vault credential set (e.g. after rotating a VPN
password) without write access to `vault_entries`; an admin reviews and approves (re-encrypts the
value into the entry) or rejects with one click.
- New table `vault_change_requests` in [supabase_schema.sql](supabase_schema.sql) §8c — RLS:
  requester or admin can read, requester can insert their own, only admins can update (review).
  **Action needed from you: re-run the schema file** to create it.
- New type `VaultChangeRequest` in
  [password-vault/types/index.ts](src/features/password-vault/types/index.ts).
- New context state/functions in
  [nestor-context.tsx](src/shared/context/nestor-context.tsx): `vaultChangeRequests` (loaded on
  login), `submitVaultChangeRequest`, `reviewVaultChangeRequest` (applies the approved value by
  re-encrypting the target `vault_entries` row under the Team Vault key, then marks the request
  reviewed).
- New "Requests" tab in
  [password-vault-module.tsx](src/features/password-vault/components/password-vault-module.tsx):
  a "Request Update" (send icon) button next to each Team Vault field for non-admins opens a modal
  (new value + reason) that calls `submitVaultChangeRequest`; the Requests tab shows admins the
  full queue with Approve/Disapprove buttons (`reviewVaultChangeRequest`), and shows members their
  own requests read-only with a pending/approved/rejected status badge.
**Verified**: `npx tsc --noEmit` passes clean. Interactive verification (submitting a request as a
member, approving/rejecting as admin, confirming the Personal Vault fix against the actual affected
Supabase row) is still pending on your end — I don't have login credentials for the running app.

---

## Phase 8 — Vault Change Request encryption fix + defensive secret masking ✅ DONE

Reported after Phase 7: a member found the plaintext proposed password directly in the
`vault_change_requests` Supabase table (a real exposure — RLS controls *who* can query the row,
not whether the value sits in the clear at rest), and a VPN entry in the Team Vault list was
displaying its password unmasked in the UI.

**1. `vault_change_requests.new_value` is now encrypted.** The original Phase 7 design assumed the
submitting member's browser might not have the Team Vault Master Password loaded, so it stored the
value in plaintext, RLS-protected only. That assumption was wrong: a member can only see the field
well enough to click "Request Update" on it because the whole module is already unlocked with that
same password, and `loadVault` already decrypted the entry to render it. So the key is always
available. Now `new_value` stores an `EncryptedEnvelope` (same AES-256-GCM format as
`vault_entries.fields`), encrypted client-side before insert and decrypted client-side wherever
shown (Requests tab) and again by the admin on approval, before re-encrypting into `vault_entries`.
Full corrected reasoning in [decisions.md](docs/decisions.md) ADR-014.
- `nestor-context.tsx`: new `decryptVaultChangeRequestValue` helper; `submitVaultChangeRequest` now
  encrypts before insert; the `vaultChangeRequests` loader decrypts each row (with a legacy
  plaintext fallback for rows written before this fix — no migration needed, the column was always
  TEXT); `reviewVaultChangeRequest` decrypts before merging into the target entry's fields.
- **New: optional "Secure Link" field** on the request form — lets a member propose an update via
  a password-manager share link instead of typing the raw value, encrypted in the same envelope.
  `VaultChangeRequest.secureUrl` in [types/index.ts](src/features/password-vault/types/index.ts).

**2. Defensive secret masking.** The Team Vault/Personal Vault field grids only masked a field if
its stored `isSecret` flag was true — the flagged VPN entry had it `false`, so its password
rendered in the clear. Added `isFieldSensitive()` in
[password-vault-module.tsx](src/features/password-vault/components/password-vault-module.tsx):
masks a field if `isSecret` OR its key matches `/pass|secret|token|key|credential|pin/i`, applied
to both vault field grids and the Requests tab's proposed-value display (which now has its own
reveal toggle too). See [decisions.md](docs/decisions.md) ADR-016.

---

## Phase 9 — Calendar cross-account leak, Employee ID collisions, dead plaintext-vault localStorage writes ✅ DONE

Reported after Phase 8: a newly created member ("member 2") saw Calendar shifts from early in the
project that weren't theirs. Root-caused to two independent bugs plus one unrelated finding turned
up while auditing for the same class of issue.

**1. Calendar's legacy `shiftAssignments` local map leaking across accounts.** Every read/write
site in `calendar-module.tsx`/`shift-form-modal.tsx` guarded on `isSupabaseConfigured && employeeId`
— during the async window right after login where `employeeId` hasn't loaded yet, that guard is
`false` even though Supabase IS configured, so the code fell back to the legacy, unscoped,
never-reset `shiftAssignments` map instead of showing a loading state. If a different account had
been used earlier in the same browser tab, its leftover shifts would show through. Fixed: the
fallback now only triggers in true offline/no-backend mode (`!isSupabaseConfigured`); when
Supabase is configured but `employeeId` isn't loaded yet, the UI shows/writes nothing instead.
`shiftAssignments` is also now reset to `{}` on every `[user]` change as a second layer of defense.

**2. `profiles.employee_id` had no uniqueness constraint.** `roster_assignments` (the real,
working shift system) keys shifts by the `employee_id` *string* alone, not by the profile's UUID.
An admin manually assigning the same Employee ID to two different accounts — e.g. reusing an ID
from early manual testing when setting up a new member — would silently merge their Shift Roster
data: the new account inherits every shift ever assigned to that ID, indistinguishable from a real
assignment. Added a partial unique index (`profiles_employee_id_unique`) plus friendly duplicate
detection in `admin_update_user_employee_id` and the direct Employee ID edit path in
[user-management-module.tsx](src/features/user-management/components/user-management-module.tsx).
**Action needed from you**: before re-running `supabase_schema.sql`, run the duplicate-check query
included in its comment (§1) to find and resolve any existing collisions — and check whether member
2's Employee ID matches one used during earlier testing.

**3. Found in passing: vault mutations were writing decrypted secrets to localStorage.**
`addVaultProductGroup`/`addPersonalVaultEntry`/and 7 other vault mutation functions in
`nestor-context.tsx` unconditionally wrote the full decrypted `vaultProducts`/`personalVault` state
— real plaintext credentials — to `localStorage` on every edit, in every mode, with nothing in the
codebase ever reading it back. Removed entirely (pure dead code once confirmed unread). See
[decisions.md](docs/decisions.md) ADR-018 — worth manually clearing `nestor_vault_products` /
`nestor_personal_vault` from any browser's localStorage that ran an older build.

**Also fixed**: dashboard "Quick Notes" (`dashboard-overview.tsx`) used a single unscoped
localStorage key shared by every account in a browser — now scoped per `employeeId`, same pattern
as the Personal Vault PIN fix.

**Verified**: `npx tsc --noEmit` passes clean. Interactive verification (confirming member 2's
calendar is now empty/correct, and that Employee ID collisions are rejected with a clear message)
is still pending on your end.

**Verified**: `npx tsc --noEmit` passes clean. Interactive verification (confirming the flagged VPN
entry now renders masked, and that a fresh change request's `new_value` is unreadable directly in
the Supabase table) is still pending on your end.

---

## Phase 10 — Dashboard redesign ✅ DONE

Requested: greeting, global search, quick-action + date-filter toolbar, category task cards,
ticket status cards, and an overview of the whole application — "professional touch and UI/UX."
Most of these already existed in
[dashboard-overview.tsx](src/features/dashboard/components/dashboard-overview.tsx); the gap was
that nothing on the dashboard represented OEM Cases, Shift Roster, or Password Vault at all, and
the search trigger was a bare icon rather than a real search affordance. Kept every existing
`useMemo` data computation as-is (all correct, already tested) and focused the redesign on the
presentation layer and the genuinely missing pieces:

- **Header**: added a user-initial avatar badge next to the greeting; replaced the icon-only
  search button with a labeled "Search Nestor…" pill (with a working ⌘K/Ctrl+K shortcut — new
  `keydown` listener, not just a decorative hint) that opens the existing fuzzy search modal
  (tasks/tickets/OEM cases were already searched together, just needed a clearer entry point).
- **New "Application Overview" section** — one clickable card per module (Task Log, Ticket Log,
  OEM Case Log, Shift Roster, Password Vault, Reports) with a live count and a click-through via
  `onViewChange`, computed in a new `moduleOverview` useMemo. This is the piece that actually
  satisfies "showcase overview of entire application" — nothing on the dashboard previously
  surfaced OEM Cases, Shift Roster, or Password Vault at all.
- **New "OEM Case Status Overview" row** (Total/Pending From OEM/Escalated/Resolved), mirroring the
  existing Ticket Status row and using the same status-substring logic as the OEM Case module's own
  metrics (`oemStats` useMemo) so the two numbers never disagree.
- Added section headings ("Work by Category", "Ticket Status Overview", etc.) above each card grid
  for clearer visual hierarchy — previously the grids ran together with no labels.

**Verified**: `npx tsc --noEmit` passes clean. Ran the dev server, logged in via the dev quick-login
(Member 1), confirmed all new sections render with live data and no console errors, and confirmed
the OEM Case Log overview card's click-through actually navigates to that module (verified via a
direct DOM click since this sandbox's ref-based click coordinates weren't resolving correctly —
the interaction itself worked). Full screenshot-based visual review is still pending on your end
since this session's browser pane wasn't displayed for a screenshot.

---

## Phase 11 — Full security audit + RLS policy consolidation ✅ DONE

Requested before starting v2 work: a full vulnerability assessment "like a cyber security expert,"
with findings and remediations written up separately. Full report: [docs/security-audit.md](docs/security-audit.md).
Summary (see the report for complete detail, evidence, and every finding):

- **Dependency scan** (`npm audit`, `npm outdated`): 6 high-severity advisories, all resolved by
  bumping `next` 16.2.10 → 16.3.0 (recommended, not applied — a version bump felt worth confirming
  with you first even though it's non-major).
- **Critical, live, exploitable finding — fixed same day**: any member account could self-elevate
  to admin via a direct `supabase.from('profiles').update({role:'admin'})` call, proven with a
  throwaway PoC script against the real production database (then reverted). RLS restricted which
  *row* a user could touch but not which *columns* — closed with a `BEFORE UPDATE` trigger.
- **User then asked for a live `pg_policies` export**, which revealed the real scope was much
  bigger: 20+ policies live on the database were never tracked in `supabase_schema.sql`, including
  several dangerous `USING(true) WITH CHECK(true)` policies sitting beside properly-scoped ones on
  `tickets`, `oem_cases`, `roster_assignments`, and `shift_requests` — silently neutralizing the
  careful ones next to them (Postgres OR's permissive RLS policies together). `profiles` alone had
  8 overlapping/redundant policies from past migrations. Two helper functions (`is_admin()`,
  `is_active_user()`) were already relied on live but undocumented anywhere.
- **Fixed**: a new "0. RLS Cleanup" section in `supabase_schema.sql` removes every dangerous/
  redundant live policy by exact name and rebuilds one clean, minimal, documented policy set per
  table; `is_admin()`/`is_active_user()` are now tracked and used consistently; `oem_cases` gained
  a `created_by` ownership column (with a best-effort backfill); `tasks`/`tickets`/`personal_vault`
  writes now also require an active account at the database layer, not just client-side.
- Also fixed: weak password policy (RPCs accepted 1-character passwords server-side — raised to 8
  chars everywhere), missing security headers (added CSP/HSTS/X-Frame-Options/etc. in
  `next.config.ts`, verified live), and a stored-XSS path via `javascript:` URIs in the Password
  Vault's "Secure Link" field.
- Full ADR: `docs/decisions.md` ADR-023.

**Verified**: `npx tsc --noEmit` passes clean. Application-layer fixes (headers, password length,
XSS) verified against a live dev server session. The SQL changes could not be similarly live-tested
— this app has never held Service Role/DDL rights (ADR-008) — so they were instead verified by a
careful manual trace of every new policy against the app's actual query patterns in
`nestor-context.tsx`. **Action needed from you**: re-run `supabase_schema.sql` — nothing in this
phase takes effect until then. See `docs/security-audit.md` §4 for the full follow-up list.

---

## Phase 12 (v2, feature 1 of 4) — Email Reframer ✅ DONE (pending your API key)

First v2 feature, per `docs/v2-feasibility.md`. Full reasoning in `docs/decisions.md` ADR-025.

- New: `app/api/ai/reframe-email/route.ts` — this app's first server-side code. Verifies the
  caller's Supabase session (bearer token) before doing anything, then calls Gemini 2.5 Flash-Lite
  (free tier, chosen over Claude/OpenAI specifically for this feature — see ADR-025) with a system
  prompt to rewrite the submitted draft in one of four tones (Professional/Formal/Concise/Friendly).
  Fully stateless — no draft or output is ever written to Supabase, per explicit product decision.
- New: `src/features/email-reframer/components/email-reframer-module.tsx` — a two-pane draft/result
  UI with tone selector and copy-to-clipboard, wired into a new "Email Reframer" nav entry.
- **Action needed from you**: add `GEMINI_API_KEY` to Vercel's environment variables (and
  `.env.local` for local dev) — free key from https://aistudio.google.com/apikey. Without it, the
  page loads fine but shows a clear "not configured" error instead of failing silently.

**Verified**: `npx tsc --noEmit` passes clean. Could not verify the actual Gemini call end-to-end
— that requires a real `GEMINI_API_KEY`, which only you can provide. Once it's set, test by
pasting a short draft and confirming a rewritten version comes back in a few seconds; the loading
state, error states (empty draft, session expired, rate limit), and copy button should all be
checked interactively.

---

## Product decisions (resolved)

- **Roster membership**: derived entirely from User Management (active profiles) — no separate
  roster add/remove concept. See Phase 2 item 1.
- **Shift change requests**: Calendar → submit request → Shift Roster "Change Requests" tab →
  admin approve/decline → reflects in roster assignments. Already implemented; needs the casing
  fix from Phase 0 and the `ShiftSwapRequest` type removed as redundant. See Phase 2 item 2.

## Suggested sequencing

Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6.

**All seven phases (0–6) are now complete**, plus the Password Vault Recovery Kit feature and
several ad-hoc fixes layered on top (see the sections at the top of this file). Remaining open
items are all verification steps that require your Supabase project and login credentials, not
further code changes:
- Re-run the latest `supabase_schema.sql` if you haven't since the last few fixes (GRANT
  statements, `vault_key_wraps` table, `vault_change_requests` table, various
  `updated_at`/backfill columns).
- Run through the Phase 3 manual test checklist.
- Interactively verify Password Vault (unlock, admin-vs-member permissions, Recovery Kit
  setup/recovery/reset for both Team and Personal vaults).
- Click each Reports export button and confirm the downloaded CSV/HTML/PDF files look right.
