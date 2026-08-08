---
allowed-tools: Read, Grep, Glob, Bash, Edit, Write
argument-hint: [optional notes about what changed]
description: Full Nestor VA — scans current working tree, updates SECURITY_DASHBOARD.html with sourced findings, compliance status, and methodology per module
---

## Context

You are running a Vulnerability Assessment on Nestor (Next.js 16 App Router +
Supabase, RLS-only architecture — no custom backend, no Service Role key
by design per ADR-008) against the code CURRENTLY on disk — do not assume
anything from a prior run is still true; re-verify everything against this
commit. Infra/hosting is out of scope. $ARGUMENTS

## Rule: every claim must be traceable

Nothing in the dashboard may be asserted without evidence. For every module
below, record: technique used, exact tool/command run, scope covered, and
result (pass/skip/fail with reason). If a tool isn't installed or isn't
authenticated, SKIP it, log it as "skipped — not configured" in the
methodology table, and continue — do not fail the whole run over one tool.

## Rule: no fabricated or unrealistic scores

Every percentage, status, or score shown anywhere in the dashboard
(compliance %, OWASP category status, dependency severity, composite
Security Score) must resolve to one of exactly three things:

- a specific tool output (name the tool + command in the methodology table),
- a specific code citation (`file:line`), or
- the literal status **"Not yet verified"** — never a guessed or
  estimated number presented as fact.

Concretely:

- **Never invent a number to fill a gap.** If a control/category has no
  evidence either way, its status is "Not yet verified," not a guessed
  midpoint like 50%.
- **"Not yet verified" is excluded from every average**, not counted for or
  against — averaging it in either direction fabricates confidence that
  doesn't exist.
- **Never round up.** When evidence is ambiguous or partial, round down or
  mark "Partial" rather than "Mitigated."
- **Every formula must be shown, not just the result.** Any composite score
  (e.g. the Security Score) must display its inputs and weights inline
  (as `#scoreFormulaNote` does) so a reader can recompute it by hand from
  the same run's data — a bare number with no visible formula is not
  acceptable.
- **Scores must be computed live from this run's data arrays**, never
  hand-typed constants left over from a previous run or copy-pasted from
  a template.
- **Every score change from the previous run must be explainable** — new
  evidence found, code changed, a tool re-run with different results.
  If a number moves and you can't say why, treat that as a bug in the
  audit, not a fact to report.
- **The `#sec-methodology` table (Module | Technique | Tool/Command |
  Scope | Status) is mandatory on every run**, not optional polish — it is
  the audit trail that lets someone else check every other number on the
  page. A dashboard update without a filled-in methodology table is
  incomplete.

## Tools and technologies used and their installation commands if not installed

```
# npm audit / npm outdated — already available, nothing to install

# OSV-Scanner (free, no account, covers the npm lockfile)
go install github.com/google/osv-scanner/cmd/osv-scanner@latest
# or: brew install osv-scanner

# Semgrep (cross-language static analysis, has a JS/TS/React ruleset)
pip install semgrep --break-system-packages

# ESLint (already a project devDependency — run with the project's own config
# plus security-focused rules if eslint-plugin-security / eslint-plugin-react
# security rules are present)
npm run lint

# Snyk (optional — needs free account + `snyk auth` once)
npm install -g snyk

# Supabase CLI (optional — only needed if live pg_policies export is
# authorized for this run; requires project credentials)
npm install -g supabase
```

## Modules to run

1. **Auth** — manual code review of `src/features/auth/`: password
   hashing/validation, Supabase session creation, logout/session
   invalidation, any route or Server Action that should require an
   authenticated/admin user but doesn't check it

2. **Database Access Control (RLS)** — manual review of every
   `CREATE POLICY` in `supabase_schema.sql` against every `CREATE TABLE`:
   confirm `ENABLE ROW LEVEL SECURITY` on all tables, flag any
   `USING (true)` / `WITH CHECK (true)` policy, check for column-level
   privilege-escalation gaps (a row-scoped policy doesn't restrict which
   *columns* within that row can be written), check that `is_admin()` /
   `is_active_user()` (or equivalent helpers) are defined in this file and
   used consistently. If live database access is explicitly authorized for
   this run, cross-check tracked policies against a live
   `SELECT * FROM pg_policies WHERE schemaname = 'public'` export to catch
   schema drift — otherwise mark that check "skipped — no live DB access
   authorized" and audit the tracked file only

3. **API Security / IDOR** — every Server Action / route handler that takes
   a resource ID; verify it relies on RLS + an authenticated Supabase client
   for ownership/tenant checks rather than trusting client-supplied IDs;
   check for mass-assignment risk in Zod schemas (are `role`/`status`/other
   privileged fields ever accepted from client input on non-admin paths?)

4. **SQL Injection** — `grep -rn "\.rpc(\|supabase\.raw\|\`SELECT\|\`INSERT\|\`UPDATE\|\`DELETE" src/ app/`
   plus manual review of every Postgres function/RPC body in
   `supabase_schema.sql` for string-concatenated dynamic SQL

5. **Rate Limiting / Abuse** — check for any rate-limiting on
   auth-adjacent RPCs (`admin_create_user`, `admin_reset_password`,
   `complete_initial_password`); note that this app has no custom server
   layer, so brute-force protection is whatever Supabase Auth provides by
   default — document that as the actual posture, not a gap to "fix" here

6. **Secrets/Config** — grep for hardcoded keys/credentials outside
   `NEXT_PUBLIC_*` env vars, confirm `.env*` is gitignored, check
   `next.config.ts` for debug flags left on, confirm no Service Role key
   is present anywhere in the codebase (per ADR-008, this app should only
   ever hold the public anon key)

7. **Frontend / XSS** — grep for `dangerouslySetInnerHTML`, `eval(`,
   `new Function(`, `target="_blank"` without `rel="noopener"`; check every
   user-controlled value rendered as an `href`/`src` for scheme validation
   (`javascript:` URI injection); check Supabase session/token storage
   (`localStorage` vs cookie) and note the XSS blast radius that follows
   from that choice

8. **HTTP Security Headers** — review `next.config.ts` `headers()` (or
   absence of one) and confirm/deny presence of CSP, `X-Frame-Options`,
   `X-Content-Type-Options`, `Strict-Transport-Security`,
   `Referrer-Policy`, `Permissions-Policy`; confirm whether `middleware.ts`
   exists at all

9. **Cryptography** — review `src/shared/lib/vault-crypto.ts` (or wherever
   the Password Vault encryption lives): KDF used, iteration/cost
   parameters, compare against current OWASP guidance for that KDF, note
   whether a parameter bump would require a re-encryption migration

10. **Static Analysis** — `npm run lint` (ESLint against the project's own
    config); `semgrep --config=auto . --json` if installed, else skip
    cleanly

11. **Dependency & Version Audit** — run all of the following, note which
    ran vs. skipped:
    - `npm audit --json`
    - `npm outdated`
    - `osv-scanner --recursive .` — only if installed; skip cleanly
      otherwise
    - `snyk test --all-projects` — only if `snyk auth` has been run; skip
      cleanly otherwise
    Cross-reference results across tools; if two tools disagree on a CVE's
    severity, note both and use the higher one. Distinguish dependencies
    that ship to the browser (`dependencies`) from build/lint-only
    `devDependencies` when assessing real-world impact.

12. **Compliance Check** — for each framework in the dashboard's
    `compliance` array (ISO 27001 / DPDP Act / CERT-In / internal
    `PROJECT_CONSTITUTION.md` or `DESIGN.md`/`VISION.md` requirements if
    present), re-verify each control claim against actual code/config
    evidence found in modules 1–11 above — do not assess compliance in
    isolation from the technical findings, derive it from them

## Update SECURITY_DASHBOARD.html

Match existing structure exactly (nav item + `<section id="sec-*">` pattern,
chip/severity CSS classes, score-ring pattern from `#sec-compliance`):

- Refresh `seedActions()` and Dependency Versions with this run's real,
  deduplicated findings (tag each with which tool(s) surfaced it)
- Recompute `#sec-compliance` percentages from module 12 only — mark
  "Not yet verified" wherever evidence is incomplete, never round up
- Recompute `#sec-owasp` per-category status against modules 1–11
- Recompute the composite Security Score from this run's real data
- Update hero-meta with the commit hash + date from the Context block
- Update/add `#sec-methodology`: table of Module | Technique | Tool/Command |
  Scope | Status (ran/skipped) — filled in from what actually executed above

## Output

Give me a short changelog: severity changes, new/resolved findings, any
tools that were skipped and why, and anything marked "Not yet verified"
that needs my manual confirmation before presenting to stakeholders.
