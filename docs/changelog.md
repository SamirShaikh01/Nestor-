# Changelog

Major changes only, chronologically. For the full narrative/reasoning behind each phase (what was
tried, what was found, what was corrected mid-phase), see [../EXECUTION_PLAN.md](../EXECUTION_PLAN.md) —
this file is the condensed, forward-looking summary; that one is the detailed working log.

## Phase 0 — Schema consolidation
- Merged three divergent SQL files (`supabase_schema.sql` + two patch/migration files) into one
  authoritative, idempotent schema file. Deleted the two now-redundant files.
- Fixed: `profiles` missing `email` column (used by `admin_create_user` and User Management UI).
- Fixed: `clearRosterMonth` deleting from a nonexistent `shift_assignments` table (typo — corrected
  to `roster_assignments`).
- Fixed: `shift_requests.status` casing mismatch (DB required capitalized, app used lowercase).
- Added: `ticket_work_logs` table and `tickets.my_note` column, both used by the app but absent
  from schema.

## Phase 1 — Dead code removal
- Deleted the shadowed duplicate `src/app/` route tree (Next.js only recognizes the root `app/`);
  ported its one real feature (OEM case dashboard deep-link) into the live page first.
- Deleted `category-colors.ts` (zero importers, fully dead).

## Phase 2 — Stubbed context functions
- Removed the dead-stub `addRosterMember`/`removeRosterMember` and their UI entirely — roster
  membership is 100% derived from User Management (see `decisions.md` ADR-002).
- Confirmed the shift change-request flow was already fully wired; removed the unused
  `ShiftSwapRequest` type (ADR-003).
- Fixed `updateMasterPassword`'s empty body (wasn't persisting at all).

## Phase 3 — Data-layer correctness
- Found and fixed a significant bug: every vault-entry write only ever set `title` (a deprecated
  column), never `label` (`NOT NULL`) — vault entries had likely never actually persisted to
  Supabase. Also fixed `notes` being silently dropped on every vault write.
- Built a toast-based error-surfacing system; wired it into every write path across the app.
- Fixed `shift-form-modal.tsx` showing a false "Request Submitted" success screen even on silent
  failure (`submitShiftRequest` now returns `boolean`).

## Phase 4 — Password Vault security hardening
- Real client-side encryption: AES-256-GCM + PBKDF2 (210k iterations), via the Web Crypto API.
- Two independent encryption keys/passphrases for Team Vault vs Personal Vault (ADR-004).
- Admin-only writes on the Team Vault enforced at three layers: UI, context guard, and RLS.
- Re-audited later in the engagement after Recovery Kit work landed — reconfirmed fully correct,
  with one real ordering bug found and fixed (see "Password Vault Recovery Kit" below).

## Phase 5 — Documentation alignment
- Split the aspirational "Nestor v2" content out of `ARCHITECTURE.md` into `VISION.md`.
- Rewrote `DATABASE.md` from scratch (was missing most of the real schema).
- Added inline "Not implemented" callouts throughout `AUTH.md` rather than deleting the
  aspirational sections (ADR-011).

## Phase 6 — Reports module
- Corrected: the plan initially assumed Reports had no export at all — it already had CSV/HTML/
  print-to-PDF. Fixed the actual gaps instead: corrected CSV column headers for the Ticket Log
  report, and replaced the print-dialog PDF flow with a true one-click `.pdf` download via
  `jsPDF`/`jspdf-autotable` (ADR-010).

## Password Vault Recovery Kit (major feature, post-Phase-6)
- Added a full forgotten-password/PIN recovery system: vault entries encrypt under a random Data
  Encryption Key (DEK), wrapped under both the current passphrase and a one-time recovery code
  (ADR-006).
- Added a destructive Reset & Wipe last resort for both vaults (ADR-007).
- Declined a suggestion to hardcode the encryption key in `.env` — would have made it public in
  the client JS bundle, defeating the encryption entirely (ADR-008).
- Fixed a real ordering bug found during live testing: setup functions re-encrypted entries
  *before* writing the wrap row, so an interruption could strand entries under an unrecoverable
  key. Reordered (wrap row commits first) and added a decrypt fallback for entries caught by an
  already-existing partial migration.
- Fixed a related false alarm: an already-gracefully-handled "entry undecryptable with any known
  key" case was logging at `console.error` (flagged by dev tooling as a hard error) instead of
  `console.warn` — downgraded, and added a proper summary toast instead.

## Ongoing: schema drift incidents (see `decisions.md` ADR-012)
Multiple real bugs traced back to the connected Supabase project's actual table structure not
matching what `supabase_schema.sql`'s `CREATE TABLE` statements assumed:
- `vault_entries` missing a `title` column (`PGRST204`) — app no longer writes to `title` at all.
- Several tables missing `updated_at` despite a generic "set updated_at" trigger attached
  project-wide, causing `record "new" has no field "updated_at"` (42703) on UPDATE — found and
  fixed incrementally across `oem_cases`, then `tasks`/`tickets`/`ticket_work_logs`/
  `roster_assignments`/`shift_requests`/`vault_products`/`vault_clients`/`profiles`, then finally
  `vault_entries`/`personal_vault`/`vault_key_wraps` (the last two discovered last).
- Missing base table GRANTs (`permission denied for table ...`, 42501) despite correct RLS —
  added an explicit blanket `GRANT`+`ALTER DEFAULT PRIVILEGES` at the end of the schema file.

## Ad-hoc fixes (not tied to a specific phase)
- Task Log: removed the redundant manual "Work Sessions" builder field (timer-based tracking
  covers this already).
- Ticket Log: `deleteTicket` now explicitly deletes matching `ticket_work_logs` rows first
  (belt-and-suspenders alongside the `ON DELETE CASCADE` FK).
- Schema file: fixed two `ticket_work_logs` RLS policies missing their `DROP POLICY IF EXISTS`
  guard, which broke re-running the script.
- Password/PIN change forms (Team Master Password, Personal PIN) now require Current + New +
  Confirm New (3 fields), with client-side match validation.

## Documentation restructuring
- Moved `ARCHITECTURE.md`/`DATABASE.md`/`AUTH.md` into a new `/docs` directory as the canonical
  location; added `docs/brain.md` (permanent project memory/architecture reference),
  `docs/api.md`, `docs/decisions.md`, `docs/roadmap.md`, `docs/changelog.md` (this file), and
  `docs/setup.md`.
