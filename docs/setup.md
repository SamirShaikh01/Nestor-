# Local Development Setup

## Prerequisites
- Node.js (a recent LTS version — the project uses Next.js 16 / React 19 / TypeScript 5)
- A Supabase project (free tier is sufficient)

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Create `.env.local` at the repo root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Both variables are `NEXT_PUBLIC_*` because this app has no server-side Supabase client — the
browser talks to Supabase directly, protected by Row Level Security (see
[auth.md](auth.md)/[database.md](database.md)). If these are left unset or contain placeholder
values, the app runs in **local-only mode**: all data lives in React state / `localStorage` for
the current browser session and is never persisted anywhere. This is intentional fallback
behavior (see [../src/shared/lib/supabase.ts](../src/shared/lib/supabase.ts) `isSupabaseConfigured`),
not a bug — useful for quick UI work without a real backend, but not for anything you want to keep.

**v2**: the Email Reframer feature (`app/api/ai/reframe-email`) is this app's first server-side
code and needs its own secret, **not** `NEXT_PUBLIC_*` — it must never reach the browser:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Get a free key from [Google AI Studio](https://aistudio.google.com/apikey) — no credit card
required. Without this set, the Email Reframer page shows a "not configured" error but the rest of
the app is unaffected. See [decisions.md](decisions.md) ADR-025 and
[v2-feasibility.md](v2-feasibility.md) for why this is the first feature to need a real backend.

## 3. Set up the database schema

Run [../supabase_schema.sql](../supabase_schema.sql) in your Supabase project's SQL Editor —
paste the entire file and execute it. It is fully idempotent (safe to re-run against an existing
database) and is the **single source of truth** for tables, RLS policies, admin RPCs, and
privilege grants. Do not edit schema anywhere else.

**Re-run this file after pulling any change that touches `supabase_schema.sql`.** This has been
the single most common source of confusing runtime errors during development — the running app
and the connected database silently drifting out of sync. See [decisions.md](decisions.md)
ADR-012 for the incident history.

## 4. Run the dev server

```bash
npm run dev
```

Opens on `http://localhost:3000` (Turbopack).

## 5. First login

The very first user must be created directly in Supabase (there's no public signup flow — see
[auth.md](auth.md)). Easiest path:
1. In the Supabase Dashboard, manually insert a row into `auth.users` (or use Supabase's own
   "Invite user" flow in the Auth section) and a matching row in `profiles` with `role = 'admin'`,
   `status = 'active'`.
2. Log in with that account. From there, use **User Management** in the app to create every
   subsequent user via `admin_create_user` — new users start in `'pending'` status and must set
   their own password on first login (`complete_initial_password`).

## Other commands

```bash
npm run build   # production build
npm run start   # run the production build
npm run lint    # eslint
npx tsc --noEmit   # type-check without emitting (not in package.json scripts, but the standard
                   # way to verify TypeScript correctness in this project — run this after any
                   # non-trivial change)
```

## Verifying a change actually works

There is no automated test suite in this project (see [brain.md](brain.md) section 14). The
practical verification loop used throughout this project's development:
1. `npx tsc --noEmit` — must be clean.
2. Start the dev server and check for compile/runtime errors in the console.
3. For anything touching Supabase, re-run `supabase_schema.sql` first, then manually exercise the
   affected feature in the browser (a login session is required for most of the app — the vault,
   roster, tickets, etc. all sit behind auth).
