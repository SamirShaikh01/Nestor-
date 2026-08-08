# Security Audit & Vulnerability Assessment — Nestor

**Date**: 2026-08-08 (initial pass), updated same day after a full live RLS policy export
**Scope**: Full application — dependency supply chain, database access control (RLS), application code (auth, crypto, XSS/injection surfaces), and HTTP security posture. Conducted before starting v2 work, at the user's request.
**Result summary**: 1 critical, 2 high, 4 medium, and several low/informational findings. The critical finding was a live, exploitable privilege-escalation bug, confirmed with a working proof-of-concept against the production Supabase project. A follow-up request to run `SELECT * FROM pg_policies` against the live database then revealed the problem was much larger than the schema file showed: **years of ad-hoc migrations had left 20+ live policies never synced back to this file, including several `USING (true) WITH CHECK (true)` blanket policies sitting right next to properly-scoped ones on the same table** — since Postgres OR's permissive RLS policies together, those open policies silently defeated every careful one beside them. That gap is now fully closed (see Finding 2, upgraded from "documented, not applied" to fixed). All fixes below are already applied in code/schema except where explicitly marked **Not applied**.

---

## 1. Tools & techniques used

| Tool / technique | Purpose |
|---|---|
| `npm audit --json` | Dependency vulnerability scan (npm's advisory database) |
| `npm outdated` | Version-drift check against latest published releases |
| Manual static code review | Grep-based sweep for `dangerouslySetInnerHTML`, `eval(`, `new Function(`, `target="_blank"` without `rel="noopener"`, hardcoded secrets/credentials, `minLength`/password-policy checks |
| Manual RLS policy audit | Read every `CREATE POLICY` in `supabase_schema.sql` against every `CREATE TABLE`, checked for missing `ENABLE ROW LEVEL SECURITY`, overly broad `USING (true)` policies, and column-level gaps that row-level policies can't cover |
| **Live proof-of-concept scripting** | Wrote throwaway Node scripts using `@supabase/supabase-js` (the same public anon key already shipped to the browser) to sign in as real test accounts and directly attempt the exact write operations a malicious/curious user could run from their own browser console — not just theorizing from the schema file, but proving what the *deployed* database actually allows today. Scripts were deleted immediately after use; nothing was left in the repo. |
| HTTP header / config review | Checked `next.config.ts`, and confirmed no `middleware.ts` exists, for CSP/HSTS/frame/clickjacking protections |
| Architecture review against prior ADRs | Cross-referenced `docs/decisions.md` (this project keeps a running ADR log) to understand which gaps were already known/deliberate vs. newly discovered |

---

## 2. Findings

### Finding 1 — CRITICAL — Any member could self-elevate to admin
**Category**: Broken Access Control (OWASP A01:2021) / CWE-269 (Improper Privilege Management)
**Status**: ✅ Fixed

`profiles` had exactly two RLS policies: unconditional `SELECT` for any authenticated user, and `FOR ALL USING/WITH CHECK (auth.uid() = id)` — i.e. "you may write to your own row." Row-level security restricts *which row* a policy allows, not *which columns* within that row. Nothing stopped a user from writing new values into their own `role` or `status` columns.

**Proof (live, against the production Supabase project, using only the public anon key already in the shipped bundle):**
```js
await member.auth.signInWithPassword({ email: "m1@gmail.com", password: "123456" });
await member.from("profiles").update({ role: "admin" }).eq("id", memberId));
// -> no error, 1 row returned, role now 'admin'
```
This succeeded with **zero errors** and fully persisted. A plain member account became a full admin — able to see/change every credential in the Team Vault, manage all users, delete accounts, etc. — with one browser devtools call. Reverted immediately after confirming.

**Fix applied** (`supabase_schema.sql`): a `BEFORE UPDATE` trigger (`prevent_self_privilege_escalation`) that rejects any change to `role`, `status`, or `employee_id` when the row being updated belongs to the caller themselves. Legitimate admin-on-another-user changes (role toggle, disable, employee ID mapping) are untouched since they never match `auth.uid() = OLD.id`.

**Action needed from you**: re-run `supabase_schema.sql` in the Supabase SQL Editor. This is the single most important thing to do from this whole report.

**⚠️ Update 2026-08-09**: the first version of this fix's companion policy (`"Admins can manage all profiles"`, Finding 9) had a bug — it caused Postgres error `42P17: infinite recursion detected in policy for relation "profiles"`, which broke every query touching `profiles` (i.e. broke the whole app) the moment the user ran the migration. Root cause and fix in **ADR-024**: the policy used an inline subquery instead of the `is_admin()` helper function, and being self-referential + `FOR ALL` (which includes `SELECT`), it triggered itself recursively. Fixed by switching to `is_admin()` (which is `SECURITY DEFINER` and bypasses RLS internally, so it can't recurse). Verified by re-running the app's exact failing queries directly against the live project. **You'll need to re-run `supabase_schema.sql` one more time** to pick up this fix.

---

### Finding 2 — HIGH — Several tables grant fully open write access, bypassing admin-only UI restrictions
**Category**: Broken Access Control (OWASP A01:2021)
**Status**: ✅ Fixed (upgraded from "documented, not applied" after the live `pg_policies` export in Finding 9 confirmed the actual scope)

Initially found in the tracked schema file: `roster_assignments`, `shift_requests`, and `oem_cases` all had `FOR ALL TO authenticated USING (true) WITH CHECK (true)` — i.e. any signed-in user, member or admin, could write anything to these tables directly, bypassing the "only an admin assigns roster shifts" / "members submit a request, admin approves it" workflow the app's UI implies exists.

The live policy export (Finding 9) showed the real picture was worse *and* better at once: the identical dangerous `USING(true)` policy existed live on all three tables — **but** `oem_cases` and `shift_requests` also already had a second, well-designed, properly-scoped policy set sitting right next to it (e.g. `"Owners or admins can update OEM cases"`, `"Admins can update all shift requests"`) that had been silently neutralized the whole time, since Postgres OR's permissive policies together — the dangerous open one made the careful ones pointless.

**Fix applied** (`supabase_schema.sql` — a new "0. RLS Cleanup" section, run before every table's own section): dropped the dangerous `"Allow write for authenticated"` policy (by exact name) from all three tables, and consolidated each down to one clean policy set:
- `oem_cases`: any active user reads/creates; only the case's own creator or an admin updates it; only an admin deletes. (Required adding a `created_by` column — the live table had no reliable owner-identity column at all; existing rows were best-effort backfilled by matching `raised_by` against `profiles.username`.)
- `roster_assignments`: read stays open (everyone needs to see the full roster); writes are admin-only.
- `shift_requests`: submit-your-own-pending / admin-reviews(UPDATE) / read-own-or-admin-reads-all / withdraw-own-pending-or-admin-deletes — the same shape already used correctly for `vault_change_requests`.

Two new `SECURITY DEFINER` helper functions, `is_admin()` and `is_active_user()`, back these (see Finding 9 — they already existed live, undocumented; now tracked and reused consistently).

---

### Finding 3 — HIGH — Next.js 16.2.10 has multiple known high-severity CVEs
**Category**: Vulnerable and Outdated Components (OWASP A06:2021)
**Status**: ⚠️ Documented, **not applied** — a dependency bump, wanted your OK first

`npm audit` reports 9 advisories against `next@16.2.10`, all fixed in **16.3.0** (a non-major bump — `fixAvailable` reports no breaking change flag):

| Advisory | Severity |
|---|---|
| Middleware/Proxy bypass in App Router (Turbopack + single locale) | High |
| DoS in App Router via Server Actions | High |
| SSRF in Server Actions on custom servers | High |
| SSRF in rewrites via attacker-controlled destination hostname | High |
| Unauthenticated disclosure of internal Server Function endpoints | High |
| DoS in Image Optimization API using SVGs | High |
| Unbounded Server Action payload in Edge runtime | High |
| Cache confusion of response bodies (2 variants) | Moderate |

This also pulls in transitively-vulnerable `postcss` (XSS in CSS stringify output, arbitrary `.map` file disclosure via source-map path traversal — 4 advisories) and `sharp` (libvips CVEs) bundled inside `next`'s own dependency tree; upgrading `next` resolves all of them in one step.

**Recommended fix**: `npm install next@16.3.0` (and re-run `npm audit` to confirm). I did not run this myself — a dependency version bump felt like something to confirm with you first, even though it's a minor version.

---

### Finding 4 — MEDIUM — Weak password policy (client and server)
**Category**: Identification and Authentication Failures (OWASP A07:2021)
**Status**: ✅ Fixed (raised to 8 chars); recommend going further

Every password field enforced only a 6-character minimum, and worse — `admin_create_user` and `admin_reset_password` (the RPCs, callable directly, bypassing any client form) had **no length check at all**, only "not empty." A single-character admin-set password would have been accepted server-side.

**Fix applied**: raised the minimum to 8 characters in all three RPCs (`admin_create_user`, `admin_reset_password`, `complete_initial_password`) and every client-side form (`minLength` + JS validation) to match.

**Still recommended (not applied)**: 8 characters is a floor, not a target. Consider:
- Raising to 10–12 characters minimum.
- Checking Supabase Dashboard → Authentication → Policies for the project's own minimum (it has historically defaulted to 6 and needs to be raised independently of the app's RPC checks, since Supabase Auth's own `signUp`/password-update paths aren't gated by this app's RPCs).
- No MFA/2FA is currently offered (already tracked in `docs/roadmap.md`/`auth.md` as a known future item — re-surfacing it here since it's directly relevant to authentication hardening).

---

### Finding 5 — MEDIUM — No security headers or Content-Security-Policy
**Category**: Security Misconfiguration (OWASP A05:2021)
**Status**: ✅ Fixed

`next.config.ts` set no headers at all, and there is no `middleware.ts`. The app shipped with no `X-Frame-Options` (clickjacking), no `Content-Security-Policy`, no `Strict-Transport-Security`, no `X-Content-Type-Options`.

**Fix applied** (`next.config.ts`): added a global `headers()` hook setting CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (blocks camera/mic/geolocation), and HSTS. The CSP allows `'unsafe-inline'` for scripts/styles because: (a) the theme/accent-color bootstrap script in `app/layout.tsx` must run inline before paint and this app has no custom server to generate a per-request nonce, and (b) Tailwind/Next inject styles at runtime. Verified live (dev server) that the app, login, and a real Supabase-backed session all still work under this policy.

**Recommended follow-up**: tightening `script-src`/`style-src` further would need a nonce-based approach, which requires moving off pure static rendering for at least the root layout — a bigger change, noted for v2 planning rather than done here.

---

### Finding 6 — MEDIUM — Stored XSS via `javascript:` URI in Vault Change Request "Secure Link"
**Category**: Cross-Site Scripting (OWASP A03:2021) / CWE-79
**Status**: ✅ Fixed

The Password Vault Change Request feature (built earlier this engagement) lets a member submit an optional "Secure Link" alongside a proposed credential change, rendered later as a clickable `<a href={...}>` in the admin's review queue. The field had no scheme validation — a member could submit `javascript:alert(document.cookie)` (or worse) as the "link," and it would sit encrypted in the database until an admin opened the Requests tab and clicked it, executing arbitrary script in the admin's authenticated session.

**Fix applied**: rejects any value that isn't `http://`/`https://` at submission time (`password-vault-module.tsx`), and — defense in depth — the render path now also refuses to output an `href` for anything that isn't `http(s)`, showing it as inert text instead, in case any pre-existing record is malformed.

---

### Finding 7 — LOW — PBKDF2 iteration count below current OWASP guidance
**Category**: Cryptographic Failures (OWASP A02:2021)
**Status**: Documented, **not applied**

Password Vault encryption keys are derived via PBKDF2-HMAC-SHA256 at 210,000 iterations (`vault-crypto.ts`). This was OWASP's recommended baseline as of 2023; current OWASP guidance (2024+) recommends 600,000 for PBKDF2-SHA256. This isn't broken — 210k is still a reasonable, non-trivial cost — but it's below current best practice.

**Why not fixed now**: raising the iteration count changes the derived key for every existing encrypted vault entry system-wide. This needs a proper re-encryption migration (bump iterations → re-wrap every DEK under the new derivation → verify), not a drive-by constant change, or it will lock every admin/member out of their own vault. Flagging for a deliberate migration, not doing it inline.

---

### Finding 8 — INFO — `profiles` table fully readable by any authenticated user
**Category**: Sensitive Data Exposure (informational)
**Status**: Informational only — a design decision to confirm, not obviously a bug

`"Allow select for authenticated" ON public.profiles FOR SELECT USING (true)` means any signed-in user — including a low-privilege member — can query every other user's email address, employee ID, role, and account status directly (not just through the app's UI, which only ever *shows* a curated subset of this). For a small internal ops team this is likely an acceptable, even intended, tradeoff (it's how the roster/team-member lists populate), but it's worth an explicit "yes, this is fine" from you rather than leaving it implicit.

---

### Finding 9 — HIGH → ✅ FIXED — Massive schema drift: 20+ live RLS policies never tracked, several dangerously permissive
**Category**: Configuration Management / Broken Access Control (OWASP A01:2021, A05:2021)
**Status**: ✅ Fixed

While investigating Finding 1, testing showed an **admin** could successfully update a different user's `status` column even though the *tracked* `supabase_schema.sql` had no policy that should have permitted that. At the user's request, I ran the following against the live database to get the full, authoritative picture:
```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```
The result showed **far more** than schema drift on one table — this project's live database had accumulated policies from multiple past migration attempts that were never folded back into the tracked file:

- **`profiles` alone had 8 overlapping policies** (several different names all doing "read everything" or "update your own row," plus two different "admin manages everyone" variants) — clutter, not a gap, but exactly the kind of thing that makes an access-control model impossible to audit or reason about.
- **Two helper functions, `is_admin()` and `is_active_user()`, existed live** and were already relied on by several of the better-designed policies — but were never defined anywhere in this tracked file. Anyone reading only the repo would have no idea the actual authorization model depended on them.
- **Real, currently-exploitable gaps** on top of the drift: `tickets` had `"Team: insert/update/delete tickets"` policies (`auth.role() = 'authenticated'`) letting **any signed-in user edit or delete any other user's tickets outright** — a live broken-access-control hole this audit's first pass had missed entirely, because the tracked file only showed the correct, narrow "own tickets only" policy. `oem_cases`, `roster_assignments`, and `shift_requests` each had a real `USING(true) WITH CHECK(true)` policy sitting directly beside a properly-scoped one, silently defeating it (see Finding 2).

**Fix applied**: a new "0. RLS Cleanup" section at the top of `supabase_schema.sql` that explicitly drops every dangerous or redundant policy name discovered (by exact name, so re-running the file is still fully idempotent), defines `is_admin()`/`is_active_user()` so this file is now the actual source of truth, and each table's own section below recreates one clean, minimal, documented policy set. Full before/after policy inventory is in the commit — every table now has exactly the policies it needs and nothing more.

**Why this matters for compliance**: beyond the concrete access-control fixes, an auditor (SOC 2, ISO 27001, or otherwise) reviewing this database before the cleanup would have found an access-control model that couldn't be reconciled with its own source-controlled definition — that's a finding on its own, independent of whether any individual policy was exploitable. A single, minimal, fully-tracked policy set per table is now something that can actually be reviewed and attested to.

---

### Finding 10 — INFO — Session tokens in `localStorage`; no MFA; no brute-force protection beyond Supabase defaults
**Category**: Architecture-level, informational

These are inherent to the "no server-side layer, RLS-only" architecture already documented in ADR-008, not new discoveries:
- Supabase JS stores the session/JWT in `localStorage` by default — standard for a pure-SPA, but means any future XSS (there is currently none known) would also mean session/token theft. Worth keeping in mind as new features are added.
- No MFA/2FA (already tracked in `docs/roadmap.md`).
- Login brute-force protection relies entirely on whatever Supabase Auth provides by default; this app adds none of its own (no attempt counting/lockout/CAPTCHA). Low risk for an internal tool with a handful of accounts, but worth knowing.

---

## 3. Dependency audit detail

`npm audit` (via the npm advisory database): **6 vulnerable packages, 0 critical, 6 high, 0 moderate/low** (see Finding 3 for the Next.js-driven ones; `nanoid`, `js-yaml`, `brace-expansion` are dev-tooling transitive dependencies of ESLint/TypeScript tooling, not shipped to the browser, and will clear once `npm audit fix`/`next` is upgraded).

Outdated packages (`npm outdated`), informational — none of these are vulnerabilities, just version drift:

| Package | Current | Latest |
|---|---|---|
| next | 16.2.10 | 16.3.0 (see Finding 3) |
| eslint-config-next | 16.2.10 | 16.3.0 |
| @supabase/supabase-js | 2.110.2 | 2.112.2 |
| react / react-dom | 19.2.4 | 19.2.8 |
| react-hook-form | 7.81.0 | 7.85.0 |
| recharts | 3.9.2 | 3.10.1 |
| framer-motion | 12.42.2 | 13.0.0 (major) |
| lucide-react | 1.24.0 | 1.30.0 |
| @hookform/resolvers | 5.4.0 | 5.7.1 |
| tailwindcss / @tailwindcss/postcss | 4.3.2 | 4.3.3 |
| eslint | 9.39.5 | 10.8.1 (major) |
| typescript | 5.9.3 | 7.0.2 (major) |

---

## 4. Summary — what to do next

**Must do**:
1. **Re-run the full `supabase_schema.sql` in the Supabase SQL Editor.** This is now a much bigger, more important run than originally reported — it fixes the self-privilege-escalation trigger (Finding 1), removes 10+ dangerous/redundant live policies and rebuilds a clean, minimal set for `profiles`, `tickets`, `oem_cases`, `roster_assignments`, and `shift_requests` (Findings 2 & 9), adds the `is_admin()`/`is_active_user()` helper functions, backfills `oem_cases.created_by`, and raises password-length checks (Finding 4). **Nothing in this report protects you until this runs.**
2. After it runs, re-verify with the same `pg_policies` query from Finding 9 that the live policy count per table matches the clean set documented there, and spot-check that existing OEM cases are still editable by their original creators (the `created_by` backfill is best-effort, matched by username).

**Should do soon**:
3. `npm install next@16.3.0` and re-run `npm audit` (Finding 3).
4. Increase Supabase Auth's own minimum password length in the dashboard to match the app's new 8-character floor (Finding 4).

**Worth planning for v2, not urgent**:
5. PBKDF2 iteration bump + vault re-encryption migration (Finding 7).
6. Nonce-based CSP tightening (Finding 5).
7. MFA support (already on the roadmap).

Everything marked ✅ above is already written into this session's code/schema changes. The application-layer fixes (headers, password length, XSS) were verified working against a real dev server session before this report was finalized. The SQL changes could not be similarly live-verified — I don't have DDL execution rights against your Supabase project (by design, this app has never held a Service Role key — see ADR-008) — so they were instead verified by careful manual trace of every policy against the app's actual query patterns in `nestor-context.tsx`, cross-checked line by line. Please treat step 1 and 2 above as the real verification step.
