# v2 Feasibility Analysis — VirusTotal, Email Reframer, Helpdesk360, AI Integration

**Date**: 2026-08-09
**Purpose**: Planning/feasibility only — nothing in this document has been built yet. Written before
any v2 implementation starts, per the user's request.

---

## 1. The one decision that gates all four features

Nestor has been deliberately **client-only** since v1: no server-side code, no API routes, no
Service Role key — every privileged operation goes through Supabase RLS + `SECURITY DEFINER` RPCs
(see `docs/decisions.md` ADR-008). That constraint is why v1 could ship without ever holding a
secret capable of touching every user's data.

**All four v2 features need a secret API key that must never reach the browser**: a VirusTotal key,
an AI provider key, and (assuming Helpdesk360 has one) a Helpdesk360 credential. There is no way to
call any of them directly from client-side code without shipping that key to every visitor's
browser bundle, where anyone can extract it from devtools in about ten seconds. This isn't a
Nestor-specific limitation — it's true of every third-party API with a secret key, and it's why
literally every real product with these integrations puts a thin server between the browser and
the third party.

**Recommendation: add Next.js API routes (`app/api/*/route.ts`).** Nestor already deploys to Vercel
as a Next.js app; API routes run as serverless functions on the exact same platform with zero new
infrastructure to provision. Secrets live in Vercel's environment variables (never prefixed
`NEXT_PUBLIC_`, so they're never bundled to the client), and each route does one thing: take a
request from the authenticated app, call the third party server-to-server, return a trimmed
response. This is a different concern from ADR-008 (which was specifically about *not* needing a
Service Role key for user-management, because Postgres RPCs already solved that) — it doesn't
reopen that decision, it adds a second, narrower kind of server-side code alongside it.

*Alternative considered*: Supabase Edge Functions (Deno-based). Viable, and keeps secrets inside
Supabase's own boundary rather than Vercel's — but it's a second deployment pipeline and a second
runtime to learn, for no real benefit here since Vercel already hosts the app. Not recommended
unless there's a reason to prefer it I'm not aware of.

**This is genuinely the one architectural decision to make before touching any of the four
features below** — once it's made, each feature is "add one API route," not a new pattern each time.

---

## 2. Feature-by-feature

### 2a. Email Reframer — AI rewrite/polish tool
**What it is** (per your answer): paste or draft an email, AI rewrites it clearer/more professional.
Standalone — no mailbox connection, no OAuth, no webhook.

**Feasibility: High. Simplest of the four.**
- One new API route (`app/api/ai/reframe-email/route.ts`) that takes the draft text + optional tone
  ("more formal," "more concise") and calls the AI provider with a prompt, returns the rewritten
  text.
- One UI surface — could live as a small tool inside the Ticket Log / OEM Case Log modules (reframe
  a reply before sending) or as its own lightweight utility panel.
- No new database tables needed unless you want to keep a history of reframed drafts (optional,
  not required for v1 of this feature).
- No compliance/ToS concerns — this is exactly what LLM APIs are built for.
- **Effort estimate: small** (1–2 days including UI, assuming the server-side layer above already
  exists).

### 2b. VirusTotal integration
**What it is**: look up file hashes / URLs / IPs / domains against VirusTotal's aggregated
70+ antivirus engine analysis — natural fit for an MSS/security-ops tool investigating an incident
(OEM Case Log, Ticket Log).

**Feasibility: Medium — technically simple, but there's a real compliance blocker to resolve first.**

- **Technical shape**: REST/JSON API, API-key header auth, lookup-by-hash/URL/IP/domain. Straightforward
  to wrap in one API route (`app/api/virustotal/lookup/route.ts`).
- **No CORS support** — confirmed via VirusTotal's own docs: direct browser calls will fail
  regardless of key validity. Must go through the server-side layer (§1). This isn't optional.
- **⚠️ Compliance blocker**: VirusTotal's **Public API's own terms explicitly prohibit commercial/
  business-workflow use** — "must not be used in business workflows that do not contribute new
  files." An internal company ops tool doing threat lookups during real incident work is exactly
  the kind of use this excludes. Using the free Public API key here would put the company in breach
  of VirusTotal's ToS, not just risk a rate-limit block.
  - **Rate limits are also severe for a team tool regardless**: 4 requests/minute, 500/day on the
    free tier — one analyst doing active incident triage could burn through the daily cap alone.
  - **What this means**: this feature needs a **VirusTotal Premium/commercial license** before it's
    built, not after. That's a procurement/budget conversation with VirusTotal's sales team, not an
    engineering task. I'd treat this as a hard prerequisite, not a "nice to have later."
- **Effort estimate once licensed**: small-medium (2–3 days) — one API route, a simple lookup UI
  (probably a small "Check Indicator" widget in OEM Case Log/Ticket Log), and a result-caching layer
  (store recent lookups in Supabase so repeat checks of the same hash don't burn quota).

### 2c. Helpdesk360 integration
**What it is** (per your answer): ESDS's internal helpdesk portal. Enter a ticket ID in Nestor's
Ticket Log → auto-fill the form fields by pulling that ticket's data from Helpdesk360.

**Feasibility: Unknown — blocked on information only you have access to.** This is an internal,
non-public system, so I can't look up its API the way I could VirusTotal's. Before this can be
scoped at all, I need:

1. **Does Helpdesk360 expose an API at all** (REST, SOAP, GraphQL — anything), or is the only
   existing access the web portal UI itself? If there's no API, "auto-fill by ticket ID" would mean
   either requesting one be built on their side, or (much worse, and not recommended) scraping their
   web UI server-side, which is fragile and breaks on their next UI change.
2. **If an API exists**: what does authentication look like (API key, OAuth, session cookie, IP
   allowlist)? Is there a "get ticket by ID" endpoint, and what fields does it return — do they map
   cleanly onto Nestor's Ticket Log fields (subject, priority, customer, product, etc.), or would
   some translation/guessing be needed?
3. **Network reachability — this is the one that could kill the whole feature outright**: is
   Helpdesk360 reachable over the public internet (even if authenticated), or only from inside
   ESDS's internal network/VPN? Nestor's server-side layer (§1) runs on Vercel's public cloud. If
   Helpdesk360 is intranet-only with no public-facing endpoint, a Vercel serverless function
   **cannot reach it** — full stop — no code fix solves that, it needs either a public API gateway
   opened on ESDS's side, or ESDS standing up a small relay service *inside* the network that Nestor
   calls out to (which is an infra/ops project bigger than anything in this app).

**Recommended next step**: before scoping this further, get whoever administers Helpdesk360 to
answer question 3 first — it's the one that determines whether this is a 3-day feature or requires
a separate infrastructure conversation. If they're not sure, "can you `curl` Helpdesk360's API from
outside the office network" is a fast way to find out.

### 2d. AI integration (broader — beyond the email reframer)
Per VISION.md's existing "AI Layer" section (already written, never built), the intended capability
set is: Weekly/Monthly Reports, Shift Handover, Similar Ticket, Similar OEM Case, RCA, SOP
Generation, Smart Search, Work Summary. You asked me to help decide the provider and backend.

**Provider recommendation: Claude (Anthropic) API.**
- Every capability on that list is a text-generation/analysis task (summarizing, finding similar
  past records, drafting a document, answering a natural-language query over your own data) —
  exactly what Claude is strong at, no image/audio/video generation needed here.
- Long context window matters for several of these (RCA and "similar ticket/case" both benefit from
  feeding in a large batch of historical records at once rather than heavy pre-processing).
- You're already working inside Claude day-to-day on this project — one mental model for "how do I
  prompt this thing" across both contexts, not a strong technical reason but a real practical one.
- OpenAI is a perfectly viable alternative with a comparable capability set and larger third-party
  tooling ecosystem — flagging it as the honest alternative, not a lesser choice, in case you have
  existing OpenAI billing/relationships that make it more convenient.
- Either way, this needs its own Anthropic (or OpenAI) API account with billing set up — separate
  from whatever grants you access to Claude Code itself.

**Feasibility & sequencing per capability** (roughly cheapest/lowest-risk to most involved):

| Capability | Feasibility | Why |
|---|---|---|
| Email Reframer | High | Already covered above — build first, proves the whole pipeline (server route → AI call → UI) works end to end. |
| Work Summary | High | Summarize a user's own tasks/tickets/time logs for a period — data already lives in existing tables, no new schema. |
| Smart Search | Medium | Natural-language search over tasks/tickets/OEM cases. Doable today against existing tables; gets meaningfully better once/if the v2 unified "Activity" model (VISION.md) exists, since right now it'd need to query 3+ differently-shaped tables per search. |
| Weekly/Monthly Report | Medium | Similar to Work Summary but aggregated — mostly a prompt-engineering + data-aggregation task, no blockers. |
| Similar Ticket / Similar OEM Case | Medium | Needs either embedding-based search (a vector index — new infra, e.g. `pgvector` in Supabase) or a simpler "feed recent N records to the model and ask" approach (cheaper to build, weaker at scale, but fine to start with sequencing). |
| Shift Handover | Medium | Summarize what happened on the outgoing shift for the incoming one — mostly Work Summary applied to the whole team's Shift Roster window instead of one user. |
| RCA (Root Cause Analysis) | Medium-High | Higher-stakes output (people may act on this directly) — needs careful prompting, probably a "draft for a human to review and edit" framing rather than "trust the AI's RCA outright." |
| SOP Generation | Medium-High | Same caution as RCA — useful as a drafting aid, needs human review built into the UI (not an auto-publish flow). |

**Recommended sequencing**: Email Reframer → Work Summary → Weekly/Monthly Report → Smart Search →
Similar Ticket/Case → Shift Handover → RCA/SOP Generation. Each step reuses the previous step's
server-route pattern and gets progressively more ambitious; RCA/SOP land last because they're the
ones where a wrong AI output has the highest real-world cost if someone trusts it uncritically.

---

## 3. Cross-cutting things a real v2 plan needs to account for

- **Cost**: unlike everything built in v1 (Supabase's free/low tier), AI API calls and VirusTotal
  Premium have real per-request dollar cost. Needs basic usage guardrails from day one — e.g. rate-
  limiting per user, a rough monthly budget alarm — so a bug or a curious user can't run up a
  surprise bill by looping a request.
- **Secrets management**: `VIRUSTOTAL_API_KEY`, `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`), and
  whatever Helpdesk360 needs, set as Vercel environment variables, referenced only inside API
  routes. Never `NEXT_PUBLIC_`-prefixed. Worth a line in `docs/security-audit.md`'s follow-up list
  once these exist, so the next audit pass checks them too.
- **This is the first server-side code this app will ever have.** Small operationally (a few
  routes), but worth calling out explicitly since every architectural doc up to this point
  (ADR-008, `docs/architecture.md`) describes a client-only app. Those docs will need a short update
  once this actually gets built, not a rewrite.
- **VISION.md's Connector Pattern** (`sync()`/`push()`/`validate()`/`health()` per integration) is a
  reasonable shape to actually use once there's more than one external integration — worth adopting
  from the start for Helpdesk360/VirusTotal rather than writing each as a one-off, so the second and
  third integrations don't each reinvent error-handling/health-check conventions.

---

## 4. What I need from you before any of this gets scoped into real tickets

1. **Helpdesk360**: confirm whether an API exists at all, get its auth model + a sample "get ticket
   by ID" response, and — most importantly — confirm whether it's reachable from outside ESDS's
   network. This one blocks scoping entirely until answered.
2. **VirusTotal**: confirm whether pursuing a Premium/commercial license is something you want to
   take to procurement, since the free tier isn't usable here per their own terms.
3. **AI provider**: pick Claude or OpenAI (or tell me to just proceed with Claude per the
   recommendation above) so I can scope the actual account/billing setup step.

Nothing above commits you to anything — happy to go deeper on any one of these four before we touch
code, or start with the Email Reframer (the one feature with zero open questions) while the other
three get sorted out in parallel.
