# Roadmap

This is a prioritized, concrete list of what to actually build next — distinct from
[../VISION.md](../VISION.md), which is a much larger aspirational product direction (Activity
normalization, AI layer, external connectors) that hasn't been scoped into concrete work yet.

## Immediate (verification, not new work)

These aren't new features — they're closing out verification on work already shipped, since the
agent building this has never had login credentials to the running app:

- [ ] Confirm the latest `supabase_schema.sql` has been re-run against the production Supabase
  project (several rounds of `ADD COLUMN IF NOT EXISTS` backfills and GRANT statements have
  accumulated — see [changelog.md](changelog.md)).
- [ ] Run the Phase 3 manual test checklist (task/ticket/OEM CRUD, roster publish, shift request
  approve/decline, vault entry + note persistence, admin user management RPCs, local-mode
  fallback) — see [changelog.md](changelog.md) Phase 3 for the full checklist.
- [ ] Interactively verify the Password Vault end-to-end: unlock, admin-vs-member permission
  boundaries, Recovery Kit setup for both Team and Personal vaults, recovery-by-code, and
  Reset & Wipe.
- [ ] Click each Reports export button (CSV/HTML/PDF) and confirm the downloaded files look right.

## Short term

- **Shift Presets / Roster Members / Calendar as real database tables.** The connected Supabase
  project already has `shift_presets`, `roster_members`, and `calendar_assignments` tables that
  no version of this app's schema created — but the app code currently keeps `shiftPresets`,
  and the calendar's local-mode `shiftAssignments` entirely in-memory/`localStorage`, never
  synced to Supabase. These tables look like they were built for exactly this purpose. Worth
  investigating their actual column shape and wiring the app to use them, so shift presets and
  calendar data survive a page reload / sync across devices like everything else already does.
- **Investigate the `security_audit_log` table.** Present in the connected Supabase project,
  origin unknown, nothing in this codebase reads or writes to it. If audit logging (see
  [auth.md](auth.md) "Audit Logs — Not implemented") is wanted, inspect this table's actual
  columns first rather than designing a new schema from scratch.
- **Password Vault**: a one-time "re-encrypt everything" admin action, independent of Recovery Kit
  setup, for any vault that still has legacy pre-encryption plaintext rows sitting in the
  database (unlikely given the timing of when the vault-write bug was fixed, but not verified).

## Medium term

- **Ticket ↔ Helpdesk360 integration.** Raised directly by the user: instead of manually entering
  ticket data, connect the Ticket Log module to the Helpdesk360 portal for auto-import/sync. No
  connector/integration pattern exists in this app at all today (see
  [VISION.md](../VISION.md) "Integrations" section for the general Connector Pattern shape this
  could follow: `sync()`/`push()`/`validate()`/`health()`). This is the most concretely-requested
  piece of the wider "external integrations" vision — a good candidate to scope and build before
  the rest of that vision.
- **Server-side layer.** This app currently has zero server-side code (no API routes, no service
  role usage) — every privileged operation goes through `SECURITY DEFINER` RPCs instead (see
  [api.md](api.md)). This has worked so far, but a real backend layer would be a prerequisite for:
  a genuine audit log (writing audit events from a trusted layer, not the browser), a true
  server-side escrow/break-glass vault recovery option (see `decisions.md` ADR-006/ADR-008 for why
  this wasn't done client-side), and any real external integrations (Darwinbox, Helpdesk, Outlook,
  OpenAI) that need secrets the browser can never see.
- **Multi-Factor Authentication / SSO.** Listed in `auth.md`'s "Future Enhancements" since before
  v1 stabilization; still not started.

## Long term (from VISION.md — needs real scoping before starting)

Everything in [VISION.md](../VISION.md) is long-term and explicitly not scoped into actionable
work yet: Activity normalization (every work item as one normalized entity), Universal Timeline,
Universal Search (Ctrl+K), a Reporting Engine that generates from Activities instead of
module-specific logic, an AI Layer, a Knowledge Base module, and the full Connector architecture
for Darwinbox/Helpdesk/Outlook/Teams/OpenAI. None of this should be started without first writing
a proper scoping/design pass — the current v1 architecture (per-feature tables, no unified
Activity model) would need a genuine data-model migration, not an additive feature.

## Explicitly out of scope until asked for again

- Fine-grained per-action permission system (`roles`/`permissions`/`role_permissions` tables,
  5-role hierarchy) — see `auth.md`. Two roles (`admin`/`member`) have been sufficient for
  everything built so far; don't add this speculatively.
- Saved Reports history table — explicitly declined by the user (ADR-010 in `decisions.md`).
