# IAM Digital Covet

[![Node](https://img.shields.io/badge/node-%3E%3D24-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D10-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![AdonisJS](https://img.shields.io/badge/AdonisJS-7-5A45FF?logo=adonisjs&logoColor=white)](https://adonisjs.com)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)](https://supabase.com)
[![License](https://img.shields.io/badge/license-UNLICENSED-red)](#license)

Identity and access management authority for Digital Covet's internal applications — user records, sessions, roles and permissions, OAuth2/OIDC clients, and an admin console to govern them.

---

## Overview

IAM Digital Covet is the single identity authority for Digital Covet's internal apps (Share, Portfolio, Desk). It provides a server-rendered admin console for staff and an OAuth 2.0 / OpenID Connect provider that internal apps use to authenticate users and read their entitlements.

The application is built on **AdonisJS 7** (TypeScript) with **Inertia.js + React 19** on the front end, styled with **Tailwind CSS v4** and **Base UI / shadcn-style** primitives. Data lives in **PostgreSQL** (Supabase shared poolers), profile photos in **Supabase Object Storage**, and transactional email goes through **ZeptoMail**.

## Features

- **Email & password authentication** with Argon-backed hashing, password history enforcement, and reset links.
- **Two-factor authentication (TOTP)** — authenticator enrollment, verification, and one-time backup codes with regeneration.
- **Session management** — active sessions listed for the signed-in user and revocable; admins can revoke sessions for any user.
- **Roles & permissions** — sectioned permission catalogue (`users`, `roles`, `apps`, `sessions`, `entitlements`, `oauth`, `audit`, `settings`), a role/permission matrix UI, and system roles (`superadmin`, `admin`, `employee`).
- **User directory** — searchable, filterable user list with invite flow, role/status updates, per-user app entitlements, and CSV export.
- **Applications & OAuth clients** — register internal apps, issue client credentials, rotate client secrets, and manage per-app entitlements.
- **OAuth 2.0 / OpenID Connect provider** — authorization code grant with PKCE, refresh tokens (sliding + absolute expiry), token introspection/revocation, `userinfo`, JWKS, and OIDC discovery documents signed with RS256.
- **Consent screen** — scope-by-scope grant confirmation (`openid`, `profile`, `offline_access`, `entitlements`, `roles`) with server-side, single-use pending requests.
- **Audit log** — every sensitive action recorded, with filtering and a detail inspector.
- **Auth settings** — configurable password policy and per-method enable/disable toggles (`credential`, `google`, `github`, `oidc`, `totp`, `email_otp`).
- **Account settings** — profile and avatar upload, password change, session list, and connected-app access.
- **Admin console UI** — dashboard KPIs and activity feed, ⌘K command palette, collapsible sidebar, and light/dark theming.

## Requirements

- **Node.js >= 24** (developed against Node 26)
- **pnpm** (workspace + lockfile committed)
- A **PostgreSQL** database. The default config expects Supabase poolers; a local Postgres or the bundled SQLite connection can substitute for development.

## Installation

```bash
git clone <repository-url>
cd iam-digital-covet
pnpm install
```

Create your environment file and application key:

```bash
cp .env.example .env
node ace generate:key      # writes APP_KEY into .env
```

Then set `DATABASE_URL` / `DIRECT_URL` (see [Configuration](#configuration)) and run the migrations and seeders:

```bash
# DDL must run through the direct/session-mode connection
node ace migration:run --connection=postgres_direct
node ace db:seed
```

The seeder creates the permission catalogue, the `superadmin` / `admin` / `employee` roles, the three internal apps, the default password policy, and the auth-method catalogue.

Finally, bootstrap the first superadmin:

```bash
node ace create:superadmin admin@digitalcovet.com --name="Admin"
```

The password is prompted for (hidden) unless you pass `--password`.

## Usage

Start the development server with hot module replacement:

```bash
pnpm dev            # node ace serve --hmr  -> http://localhost:3333
```

Production build and start:

```bash
pnpm build          # compiles to ./build
pnpm start          # node build/bin/server.js
```

The admin console lives at `/dashboard`, `/directory`, `/apps`, `/audit-logs`, `/roles-access`, `/auth-settings`, and `/account-settings`. Authentication screens are at `/login`, `/forgot-password`, and `/reset-password/:token`. Accounts are created by invitation from the directory; there is no public signup.

### OAuth 2.0 / OIDC endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /oauth/authorize` | Authorization code grant (with PKCE); redirects to `/login` when signed out |
| `POST /oauth/token` | Exchange authorization code or refresh token for access/ID tokens |
| `POST /oauth/revoke` | Revoke an access or refresh token |
| `POST /oauth/introspect` | Token introspection (RFC 7662) |
| `GET /oauth/userinfo` | OIDC userinfo (Bearer token) |
| `GET /oauth/logout` | RP-initiated logout |
| `GET /.well-known/jwks.json` | JSON Web Key Set for token verification |
| `GET /.well-known/openid-configuration` | OIDC discovery document |

Scopes: `openid`, `profile`, `offline_access`, `entitlements`, `roles`. The `roles` scope adds a `role` claim (the user's role name, e.g. `admin`) to the ID token and `/oauth/userinfo`; it is not included in access tokens or introspection.

### Pages

All screens are React components under `inertia/pages/`, rendered through Inertia with the `AppLayout`, `AuthLayout`, or `MarketingLayout` shell.

**Authentication (guest only)**

| Route | Page | Description |
| --- | --- | --- |
| `/login` | `auth/login.tsx` | "Welcome back" sign-in with email/password, show-password toggle, and inline/flash error handling. |
| `/forgot-password` | `auth/forgot_password.tsx` | Requests a password-reset email link. |
| `/reset-password/:token` | `auth/reset_password.tsx` | Sets a new password; renders as either an invite acceptance (`kind=invite`) or a reset from email. |
| `/verify-2fa` | `auth/verify_2fa.tsx` | Second-factor challenge — 6-digit TOTP code or a backup code, with attempts remaining. |
| `/setup-2fa` | `auth/setup_2fa.tsx` | Authenticator enrollment: QR code + TOTP secret, confirm, then display one-time backup codes (regenerable). |
| `/oauth/logout` | `auth/logout_confirm.tsx` | RP-initiated sign-out confirmation (when no `id_token_hint` is supplied) and the invalid-request error card. |

**Consent**

| Route | Page | Description |
| --- | --- | --- |
| `/consent` | `consent.tsx` | OAuth grant screen: shows the requesting app, the account, and each requested scope with a plain-language label; approve or deny. Handles already-granted, no-access, and invalid-request states. |

**Admin console (authenticated, permission-gated)**

| Route | Page | Description |
| --- | --- | --- |
| `/dashboard` | `dashboard.tsx` | Ecosystem overview: KPI strip, activity chart, live audit feed, and session distribution. Polls every 30s and surfaces a stale-data indicator. |
| `/` (directory) | `directory.tsx` | User directory with search/role/status/app filters, pagination, CSV export, invite dialog, per-user detail sheet, role & status edits, entitlements, and session revocation. |
| `/apps` | `apps.tsx` | Application and OAuth-client registry shown as credential-ticket cards. Superadmins register apps and rotate secrets; edit/delete gated by permission. |
| `/audit-logs` | `audit_logs.tsx` | Audit trail with actor/type/status/date filters, a cursor-paginated event table, and a detail inspector sheet. |
| `/roles-access` | `roles_access.tsx` | Role cards plus a role × permission matrix with a sticky save bar; sensitive-privilege changes require confirmation and dirty cells are highlighted. |
| `/auth-settings` | `auth_settings.tsx` | Password-policy editor and the sign-in method registry (`credential`, `google`, `github`, `oidc`, `totp`, `email_otp`) with enable/disable toggles. View-only when the user lacks update permission. |
| `/account-settings` | `account_settings.tsx` | Self-service profile (avatar upload), password change, active sessions, two-factor status, and connected-app access. Available to every role. |

**Errors**

| Route | Page | Description |
| --- | --- | --- |
| 404 | `errors/not_found.tsx` | Not-found page rendered with the marketing layout. |
| 500 | `errors/server_error.tsx` | Unexpected-server-error page rendered with the marketing layout. |

## Configuration

Configuration is read from `.env` and validated in `start/env.ts`. See `.env.example` for a template.

| Variable | Required | Description |
| --- | --- | --- |
| `APP_KEY` | Yes | Encryption key; generate with `node ace generate:key` |
| `APP_URL` | Yes | Public base URL; also the OAuth issuer |
| `PORT` / `HOST` | Yes | HTTP bind address (defaults `3333` / `localhost`) |
| `NODE_ENV` | Yes | `development`, `production`, or `test` |
| `LOG_LEVEL` | Yes | Pino log level (e.g. `info`) |
| `SESSION_DRIVER` | Yes | `cookie`, `memory`, or `database` |
| `DATABASE_URL` | Yes | Runtime Postgres (transaction-mode pooler, port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | Yes | Direct/session-mode Postgres (port 5432) for migrations and DDL |
| `SUPABASE_URL` | No | Supabase project URL (avatar storage) |
| `SUPABASE_SECRET_KEY` | No | Server-only Supabase secret key (`sb_secret_…`) for storage |
| `AVATAR_BUCKET` | No | Public storage bucket for avatars (e.g. `avatars`) |
| `OAUTH_PRIVATE_KEY_B64` | No* | Base64-encoded RS256 private key (PEM) used to sign OAuth/OIDC tokens |
| `ZEPTOMAIL_URL` | No | ZeptoMail API endpoint |
| `ZEPTOMAIL_TOKEN` | No | ZeptoMail API token; when empty, emails are logged to the console |
| `ZEPTOMAIL_SENDER_ADDRESS` | No | From address for transactional email |

\* Required for OAuth/OIDC token issuance. Generate a key with:

```bash
node -e "const c=require('crypto');console.log(Buffer.from(c.generateKeyPairSync('rsa',{modulusLength:2048}).privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'))"
```

Avatar uploads and email delivery degrade gracefully when their variables are unset: uploads are skipped and emails are logged instead of sent.

## Development

```bash
pnpm dev          # start with HMR
pnpm lint         # eslint .
pnpm format       # prettier --write .
pnpm typecheck    # tsc --noEmit for app + inertia tsconfigs
pnpm test         # node ace test (Japa)
```

Tests use [Japa](https://japa.dev) with `unit`, `functional`, and `browser` suites configured in `adonisrc.ts` and `tests/bootstrap.ts`. The harness (assert, AdonisJS plugin, DB assertions, browser client) is wired up, but the `tests/` directory currently contains only `bootstrap.ts` — no spec files are committed yet.

Other useful Ace commands:

```bash
node ace             # list all commands
node ace migration:run --connection=postgres_direct
node ace migration:rollback --connection=postgres_direct
node ace db:seed
node ace create:superadmin <email> --name="<Name>"
node ace repl
```

## Project Structure

```
app/
  controllers/    HTTP handlers, grouped by console surface
  middleware/     auth, guest, permission, role, inertia, silent-auth
  models/         Lucid ORM models (user, account, role, app, session, ...)
  services/       domain logic (oauth, credentials, 2FA, access, avatars, mail)
  validators/     VineJS request validation
  transformers/   API serialization
commands/         Ace CLI commands (create:superadmin)
config/           AdonisJS configuration (auth, database, session, inertia, ...)
database/
  migrations/     schema (roles, permissions, users, sessions, oauth, audit, ...)
  seeders/        permission catalogue, roles, apps, policy, auth methods
inertia/          React 19 front end (pages, layouts, components, css)
providers/        api_provider (response serializer)
start/            env, kernel (middleware), routes, validator
tests/            Japa bootstrap and suites
iam-digital-covet-design-system.md   UI/UX design system & implementation plan
```

## UI / Design System

`iam-digital-covet-design-system.md` is the authoritative design reference: brand tokens (Brand Red `#c2202d`, Near Black `#333132`, Soft Gray `#eae8e9`), typography (Jost, Rubik, JetBrains Mono for machine data), the "ledger rule / credential ticket / seal / token strip" decoration kit, and the per-surface experience modes. Front-end work should follow it.

## License

UNLICENSED — private, proprietary software. All rights reserved.
