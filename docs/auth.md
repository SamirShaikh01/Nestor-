# Authentication & Authorization Architecture

> **Reading guide**: this file mixes what's actually implemented with future-direction sections
> written before v1 stabilization. The "Password Vault Encryption (Implemented)" section below is
> real, current, shipped code. Several other sections (granular RBAC with `roles`/`permissions`/
> `role_permissions` tables, Super Admin/Manager/View Only roles, Next.js API Routes + Service
> Role for privileged operations, Audit Logs) describe a **not-yet-built** future direction — each
> is marked inline below with what actually exists today instead. Actual v1 authorization is
> simpler: two roles (`admin`/`member`) on `profiles.role`, enforced primarily through Supabase
> Row Level Security — see [database.md](database.md). For the engineering-reference summary of
> all of this, see [brain.md](brain.md) sections 7–9.

## Authentication

Authentication identifies WHO the user is.

Provider

Supabase Auth

Supported

- Email & Password
- Password Reset
- Session Management
- JWT
- MFA (Future)

Passwords are NEVER stored inside application tables.

Authentication remains inside Supabase.

---

# Authorization

Authorization decides WHAT a user can do.

Use RBAC.

Never hardcode permissions.

Tables

roles

permissions

role_permissions

users

> **Not implemented.** There are no `roles`/`permissions`/`role_permissions` tables. Authorization
> is a single `role` column (`'admin' | 'member'`) on `profiles`, checked directly in application
> code and Supabase RLS policies — see [database.md](database.md). Fine-grained, per-action
> permissions (the `vault.create`, `user.delete`-style list under "Permissions" below) aren't
> implemented as a data-driven system; each admin-only action independently checks
> `role === 'admin'`.

---

# Default Roles

Super Admin

Admin

Manager

Member

View Only

> **Not implemented.** Only two roles actually exist: `admin` and `member`.

---

# Permissions

Examples

user.create

user.update

user.delete

user.reset_password

vault.view

vault.create

vault.update

vault.delete

vault.approve

activity.create

activity.update

activity.delete

report.generate

shift.manage

dashboard.view

knowledge.manage

---

# User Management

Accessible only by

Admin

Features

Create User

Edit User

Deactivate User

Reset Password

Assign Role

Assign Department

Assign Manager

Search Users

Filters

Role

Department

Status

---

# Create User Flow

Admin

↓

User Management

↓

Fill Form

Username

Employee ID

Email

Password

Role

Department

↓

Next.js API

↓

Supabase Admin SDK

↓

Auth User Created

↓

Insert profile

↓

Success

Never use PostgreSQL RPC for creating users.

---

# User Profile

Every user owns one profile.

Contains

Profile Picture

Username

Email

Employee ID

Department

Designation

Current Role

Preferences

Change Password

Active Sessions

Recent Login

Future

Enable MFA

---

# Password Reset

User

↓

Forgot Password

↓

Email

↓

Reset Link

↓

Supabase

Admin can also trigger password reset from User Management.

---

# Password Vault Permissions

Personal Vault

Owner

Create

Read

Update

Delete

Organization Vault

Admin

Create

Read

Update

Delete

Member

Read

Copy

> **Note on current (v1) behavior**: the sections above describe the target model.
> As actually implemented today, there is no member "request add/edit/delete +
> admin approval" workflow for the Organization (Team) Vault — members have
> straightforward read/copy access, and only admins can create, edit, or delete
> team credentials, enforced at the UI, context, and database (RLS) layers. See
> the "Password Vault Encryption" section below for exactly how this is enforced.

---

# Password Vault Encryption (Implemented)

This section documents the actual, currently-implemented encryption layer for
the Password Vault — both the Team (Organization) Vault and the Personal Vault
sub-module. Unlike several other sections of this file, this describes real,
shipped code, not a future design target.

## Design goal

Credential values (usernames, passwords, server IPs, VPN configs, etc.) must
never be stored in Supabase as plaintext, and the encryption must be strong
enough to actually matter for critical client/server/VPN credentials — not a
cosmetic obfuscation layer.

## Model: client-side, zero-knowledge encryption

All encryption and decryption happens in the browser via the Web Crypto API
(`crypto.subtle`). Supabase only ever stores ciphertext. The passphrase that
protects a vault is never transmitted to or stored on the server in any form —
only its derived key material lives in memory for the duration of a session.

## Algorithm

- **AES-256-GCM** for symmetric encryption of credential data.
- **PBKDF2-SHA256, 210,000 iterations** (OWASP's current baseline recommendation)
  to derive the AES key from a user-supplied passphrase.
- A random 12-byte IV is generated per encryption operation and stored
  alongside the ciphertext (IVs are not secret, but must never repeat under
  the same key).

Implementation: [`../src/shared/lib/vault-crypto.ts`](../src/shared/lib/vault-crypto.ts)
(`deriveVaultKey`, `encryptVaultPayload`, `decryptVaultPayload`).

## Two independent passphrases, two independent keys

| Scope | Passphrase | Who controls it | Where it's changed |
|---|---|---|---|
| Team Vault | Master Password | Admins only | Settings → Password Vault Security |
| Personal Vault | Personal PIN | Each user, for their own entries | Password Vault module → "My Personal PIN" |

These are deliberately **decoupled**. If Personal Vault reused the Team
Vault's master password, every user's personal vault would become
undecryptable the instant an admin rotated the team password. Key derivation
also mixes in a scope label (`"team"` vs. `"personal:<employeeId>"`) as
additional domain separation, so the two derived keys differ even if a user
happened to reuse the same digits for both.

Key derivation is cached in memory per-session (`teamKeyCacheRef` /
`personalKeyCacheRef` in `nestor-context.tsx`) so the deliberately-expensive
PBKDF2 step only reruns when the underlying passphrase actually changes, not
on every field encrypt/decrypt.

## Envelope format (what actually lands in the database)

Each credential set's field list (`VaultField[]`, e.g. Username/Password/IP)
and its notes are combined into one JSON object and encrypted together as a
single envelope:

```json
{ "__enc": 1, "iv": "<base64>", "data": "<base64 ciphertext>" }
```

This envelope is stored directly in the existing `fields` JSONB column of
`vault_entries` (Team Vault) and `personal_vault` (Personal Vault) — no
separate ciphertext column was needed. `label` (the descriptive entry name,
e.g. "VPN Creds — SIDBI") stays plaintext, since it's needed for tree
navigation and search and is not itself a secret — the same tradeoff every
credential manager (KeePass, Bitwarden, etc.) makes for entry titles.

Rows written before encryption existed (a plain `VaultField[]` array with no
`__enc` marker) are still read and displayed as legacy data — no forced,
destructive migration.

## Key rotation (changing a passphrase)

Changing either the Master Password or a Personal PIN behaves differently depending on whether a
Recovery Kit (see below) has been set up for that scope:

- **Recovery Kit active**: entries are encrypted under a random Data Encryption Key (DEK) that
  never changes on password rotation — only the *wrapped copy* of the DEK is re-wrapped under the
  new passphrase. A single cheap row update, no entries touched.
- **No Recovery Kit yet** (the original scheme): every existing entry in that scope is decrypted
  with the **old** key and re-encrypted with the **new** key, one at a time. This fails **closed**:
  if re-encryption errors partway through, the passphrase is **not** changed, so nothing is left
  in a half-migrated or permanently-locked state.

## Access control layering (Team Vault admin-only writes)

Enforced at three independent layers, in increasing order of trust:

1. **UI**: Add/Edit/Delete controls for Team Vault products, clients, and
   credential sets only render when `role === "admin"`
   ([../src/features/password-vault/components/password-vault-module.tsx](../src/features/password-vault/components/password-vault-module.tsx)).
2. **Context**: every mutating Team Vault function calls a
   `requireAdminForVault(...)` guard and no-ops with an error toast for
   non-admins, even if called directly and not through the hidden UI
   ([../src/shared/context/nestor-context.tsx](../src/shared/context/nestor-context.tsx)).
3. **Database (the layer that actually matters)**: Row Level Security on
   `vault_products` / `vault_clients` / `vault_entries` requires
   `(SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'` for
   INSERT/UPDATE/DELETE; SELECT stays open to any authenticated user
   ([../supabase_schema.sql](../supabase_schema.sql)). UI and context checks are
   convenience/UX on top of this — this is the real security boundary.

`personal_vault` RLS is intentionally left owner-scoped
(`user_id = auth.uid()`) with no admin override, since it is each user's own
private data, not the centralized Team Vault.

## What this protects against

- A raw database dump or breach: every credential value is ciphertext,
  unrecoverable without the corresponding passphrase.
- Non-admin users editing or deleting shared Team Vault credentials.

## What this does NOT protect against, by design

- Anyone with the correct passphrase (or recovery code — see below) and
  legitimate app access can always read their own decrypted vault — this is
  credential *storage*, not access-logging or DLP.
- **A forgotten passphrase AND a lost/never-set-up recovery code together are
  unrecoverable.** This is the fundamental limit of zero-knowledge,
  client-side encryption — nothing server-side can ever decrypt the data
  without one of these two secrets, by design.
- **A hardcoded/environment-variable encryption key was explicitly considered and rejected** —
  see [decisions.md](decisions.md) for the ADR. This app has no server-side code, so any key a
  client-side script can read is, by definition, public (baked into the JS bundle). There is no
  way to give browser-only code a private key that stays private.

## Recovery Kit (forgotten passphrase recovery)

Since a forgotten Master Password or Personal PIN would otherwise mean
permanent data loss, vault entries are actually encrypted with a random
**Data Encryption Key (DEK)** — not the passphrase directly. The DEK is
"wrapped" (encrypted) twice: once under a key derived from the current
passphrase, once under a key derived from a one-time **recovery code**. This
lets a forgotten passphrase be recovered via the code without ever touching
or re-encrypting a single vault entry, since the DEK itself never changes.

- **Setup** ("Set Up Recovery Kit", Settings → Password Vault Security for
  the Team Vault; Password Vault module → My Personal PIN for the Personal
  Vault): generates a DEK, migrates existing entries from direct-passphrase
  encryption to DEK encryption (one-time, only entries created before Recovery
  Kit setup need this), generates a recovery code (format
  `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX`, shown to the user **exactly once** — they
  must save it themselves), and wraps the DEK under both the passphrase and
  the recovery code. The wrap row is written **before** entries are
  re-encrypted (an ordering fix — see decisions.md), so an interruption
  partway through never strands an entry under an unrecoverable key.
- **Recovering with the code**: the user enters their recovery code and
  chooses a new passphrase. The app unwraps the DEK using a key derived from
  the code, then re-wraps that same DEK under the new passphrase. No vault
  entry is decrypted or re-encrypted — recovery is effectively free and
  instant, and zero data is lost.
- **Passphrase rotation after Recovery Kit setup** also becomes cheap: instead
  of decrypting and re-encrypting every entry (the original, pre-Recovery-Kit
  behavior, still used for scopes that haven't set one up yet), changing the
  passphrase just re-wraps the same DEK under the new passphrase.
- **Reset & Wipe (last resort)**: if both the passphrase and the recovery
  code are lost, the only remaining option is destructive — permanently
  delete every entry in that vault scope (they're unrecoverable ciphertext at
  that point anyway), then generate a fresh DEK, passphrase, and recovery
  code. Requires typing "RESET" to confirm.
- Storage: a `vault_key_wraps` table (`id` = `'team'` for the shared Team
  Vault, or the user's `auth.uid()` for a Personal Vault), holding
  `wrapped_dek_passphrase` and `wrapped_dek_recovery` envelopes. RLS mirrors
  the same admin-only-Team-Vault / owner-only-Personal-Vault split used
  everywhere else in the vault.
- Recovery Kit setup is **optional, not forced** — a scope that hasn't set
  one up keeps working exactly as before (direct passphrase-derived
  encryption, full re-encryption on password change). This avoided a forced
  background migration when the feature shipped.
- On load, if the resolved key (DEK, if a wrap exists) fails to decrypt a specific entry, the app
  falls back to trying the direct passphrase-derived key before giving up — this covers entries
  caught mid-migration by an interrupted Recovery Kit setup. If both fail, that specific entry is
  shown as `"[Unable to decrypt]"` and a summary toast tells the user how many entries are
  affected — this is expected for genuinely orphaned pre-password-change data, not a bug.

Implementation: `generateDataEncryptionKey`, `wrapDataEncryptionKey`,
`unwrapDataEncryptionKey`, `generateRecoveryCode` in
[`../src/shared/lib/vault-crypto.ts`](../src/shared/lib/vault-crypto.ts); `setupTeamVaultRecoveryKit`,
`setupPersonalVaultRecoveryKit`, `recoverTeamVaultWithCode`,
`recoverPersonalVaultWithCode`, `resetTeamVault`, `resetPersonalVault` in
[`../src/shared/context/nestor-context.tsx`](../src/shared/context/nestor-context.tsx).

---

# Row Level Security

Every table should have RLS enabled.

Policy examples

Users can read only their own profile.

Members can access only their own Activities.

Admins can manage all Activities.

Admins can manage Users.

Organization Vault is accessible only according to permissions.

Never disable RLS in production.

---

# API Security

Browser

↓

Next.js API Routes

↓

Supabase Service Role

↓

Database

Privileged operations

- Create User
- Delete User
- Reset Password
- Role Assignment
- Organization Vault Approval

must always execute through server-side API routes.

The Service Role key is never exposed to the frontend.

> **Not implemented as described.** There are no Next.js API Routes and no Supabase Service Role
> key anywhere in this app — there is no server-side code at all. Privileged operations (create
> user, delete user, reset password, employee ID updates) instead go directly from the browser to
> `SECURITY DEFINER` Postgres functions (`admin_create_user`, `admin_delete_user`,
> `admin_reset_password`, `admin_update_user_employee_id` — see [database.md](database.md) and
> [api.md](api.md)), each independently checking `profiles.role = 'admin'` before doing anything.
> This achieves the same "only admins can do this, and the browser never gets elevated raw
> privileges" goal without a server-side API layer — a valid alternative to the pattern described
> above, not a bug, but worth knowing if a real Next.js API layer / Service Role is ever
> introduced later.

---

# Audit Logs

Every sensitive action is logged.

Examples

User Created

User Deleted

Password Changed

Role Changed

Credential Updated

Credential Deleted

Approval Granted

Approval Rejected

Audit Log Fields

id

user

action

resource

timestamp

ip

device

status

> **Not implemented.** No audit log table or logging code exists anywhere in this app — no user
> action (including the ones listed above) is currently recorded for after-the-fact review.
> Interestingly, at least one Supabase project connected to this app during development already
> had a `security_audit_log` table present — but nothing in this codebase writes to it, reads from
> it, or was ever aware of its schema. If audit logging is wanted, that table (if it still exists)
> is worth inspecting first, rather than starting from scratch, since its origin and intended
> shape are currently unknown. See [roadmap.md](roadmap.md).

---

# Future Enhancements

- Multi-Factor Authentication
- SSO (Azure AD / Google Workspace)
- Session Revocation
- Device Management
- Login Alerts
- Password Rotation Policies
- Fine-Grained Permission Builder
