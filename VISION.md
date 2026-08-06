# Nestor v2 — Future Vision (Not Implemented)

> **This document describes an aspirational future direction, not the current application.**
> None of the concepts below (Activity normalization, Universal Timeline, Universal Search, the
> AI Layer, external Integrations, etc.) exist in the codebase today. For what Nestor actually is
> right now, see [docs/brain.md](docs/brain.md) (start here), [docs/architecture.md](docs/architecture.md),
> [docs/database.md](docs/database.md), and [docs/auth.md](docs/auth.md). For a prioritized,
> concrete take on what to build next (distinct from this aspirational list), see
> [docs/roadmap.md](docs/roadmap.md).
>
> This content used to live at the bottom of `ARCHITECTURE.md`, appended directly after the real
> v1 architecture with no separation — which read as if it were already-decided, in-progress
> spec. It's moved here specifically so it stops being confused with the current system.

## Vision

Nestor is an AI-powered Operations Workspace for Security, Cloud and IT Operations teams.

Instead of managing information across Excel sheets, ticket portals, notes and AI tools
separately, Nestor provides one centralized workspace where every work item becomes a normalized
Activity.

---

# Core Architecture

Presentation Layer

- Dashboard
- Activity Center
- Calendar
- Password Vault
- Reports
- Knowledge Base
- User Profile
- AI Assistant
- Settings

↓

Business Layer

- Activity Service
- Reporting Engine
- AI Engine
- Search Engine
- Notification Engine
- User Service
- Vault Service
- Integration Service

↓

Database Layer

- activities
- users
- credentials
- files
- comments
- notifications
- audit_logs
- tags

↓

Integration Layer

- Darwinbox
- Helpdesk
- Outlook
- Teams
- OpenAI

---

# Activity Normalization

Every work item is stored as Activity.

Activity Types

- Ticket
- Task
- OEM Case
- Meeting
- Learning
- Report
- Shift
- Password Request
- Knowledge Article

Every activity contains

- id
- type
- owner
- title
- description
- status
- priority
- tags
- attachments
- comments
- metadata
- timestamps

Module-specific fields are stored inside metadata.

Example

Ticket

metadata

{
 ticket_number,
 client,
 severity
}

OEM

metadata

{
 vendor,
 case_id
}

Task

metadata

{
 estimated_hours,
 due_date
}

---

# Universal Timeline

Instead of

Task Timeline

Ticket Timeline

OEM Timeline

Everything appears inside one Activity Timeline.

09:30

Resolved Ticket

↓

10:20

OEM Case Updated

↓

11:05

Meeting Started

↓

12:15

Password Request Approved

↓

16:00

Generated Weekly Report

---

# Universal Search

Ctrl + K

Searches

- Tasks
- Tickets
- OEM
- Meetings
- Passwords
- Reports
- Users
- Knowledge
- Files

---

# Reporting Engine

Reports are generated from Activities.

Examples

Daily Report

Weekly Report

Monthly Report

Shift Report

Team Report

Customer Report

No module-specific report logic.

---

# AI Layer

AI learns only from Activities.

Capabilities

- Weekly Report
- Monthly Report
- Shift Handover
- Similar Ticket
- Similar OEM Case
- RCA
- SOP Generation
- Smart Search
- Work Summary

---

# Dashboard

The dashboard answers

What needs attention?

What happened today?

What should I work on?

Instead of simply showing statistics.

---

# Password Vault

Two independent vaults

Personal Vault

Organization Vault

Organization Vault

Only Admin can edit.

Members submit requests.

Requests become Activities.

Admin approves or rejects.

Everything is audited.

> **Note**: as of Phase 4 of the v1 stabilization plan (see `EXECUTION_PLAN.md`), the real Password
> Vault already has two independent vaults (Team/Organization + Personal) with admin-only writes
> on the Team Vault, real client-side encryption, and a Recovery Kit — but there is no "member
> submits a request, admin approves" workflow, and nothing is "audited" (no audit log exists). If
> that request/approval/audit model is still wanted, it's a deliberate future feature, not a bug.

---

# Integrations

Connector Pattern

Darwinbox Connector

Helpdesk Connector

Outlook Connector

OpenAI Connector

Every connector implements

sync()

push()

validate()

health()

No UI component directly calls external APIs.

> **Note**: a related, smaller-scoped idea — connecting the Ticket module directly to the
> Helpdesk360 portal for auto-import/sync instead of manual entry — was raised during v1
> stabilization and deferred; see `EXECUTION_PLAN.md`. It would fit under this same Connector
> Pattern if built.

---

# Long-term Vision

One engineer should be able to complete an entire workday inside Nestor without opening Excel,
Notepad, multiple ticket portals or separate AI tools.
