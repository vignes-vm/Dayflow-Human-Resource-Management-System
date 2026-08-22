# Dayflow — Architecture

System-level flows, reproduced from `docs/Dayflow-Blueprint-v2.md` §5 and §10 so the
mechanics can be read without opening the code. See `docs/ERD.md` for the data model.

## System architecture

```mermaid
flowchart TB
  subgraph Client["Browser"]
    UI["React 18 + Vite + TS<br/>Tailwind + shadcn/ui"]
    Q["TanStack Query"]
    SSE["EventSource — live presence + approvals"]
  end
  subgraph API["Node + Express + TypeScript"]
    MW["helmet · cors · rate-limit · zod · auth · rbac · audit"]
    MOD["Modules<br/>auth · company · employees · attendance<br/>timeoff · payroll · analytics"]
    ENG["Engines<br/>loginId · salaryComponents · attendanceStatus<br/>coverage · payslip"]
    JOB["Jobs — daily close · presence sweep"]
    PDF["PDFKit — payslips"]
    MAIL["Nodemailer — credentials, decisions, payslips"]
  end
  subgraph Data
    PG[("PostgreSQL via Prisma")]
    BLOB["Uploads — logos · avatars · certificates · payslips"]
  end
  UI --> Q -->|"httpOnly cookies"| MW --> MOD --> ENG --> PG
  SSE --> MW
  MOD --> PDF --> BLOB
  MOD --> MAIL
  JOB --> MOD
```

`packages/shared` holds the Zod schemas; the API validates with them and the web app infers
its types from them — one source of truth (`docs/Dayflow-Team-Plan.md` §2.4).

**As of this PR** (Member 1 — Platform & Auth), the modules that exist are `auth`, `company`,
`settings`, `notifications`, `audit` and `health`. `employees`, `profile`, `contracts`,
`payroll`, `attendance`, `time-off` and `analytics` are mounted stub routers awaiting their
owners (M3/M4) — see the gap note in the PR description.

## Company registration and employee onboarding

```mermaid
flowchart TD
  A["Sign Up page"] --> B["Company name + logo upload<br/>Admin name, email, phone,<br/>password, confirm password"]
  B --> C{"Passwords match?<br/>Password meets rules?"}
  C -->|no| B
  C -->|yes| D{"Company name or<br/>email already used?"}
  D -->|yes| E["409 — inline field error"] --> B
  D -->|no| F["Transaction:<br/>create Company (code = first 2 letters)<br/>create ADMIN User<br/>generate admin Login ID<br/>seed default TimeOffTypes,<br/>settings, PF and PT rates"]
  F --> G["Send verification email"]
  G --> H["Verify → status ACTIVE"]
  H --> I["Admin signs in → Employees page"]

  I --> J["Admin clicks NEW"]
  J --> K["Enters name, email, phone,<br/>department, job title, manager,<br/>joining date, role"]
  K --> L["Transaction:<br/>allocate serial for (company, year)<br/>generate Login ID<br/>generate 12-char password<br/>create User + Employee<br/>+ empty Resume + PrivateInfo<br/>+ default allocations"]
  L --> M["Email credentials to employee<br/>Show them once to the admin"]
  M --> N["Employee signs in with Login ID"]
  N --> O{"mustChangePassword?"}
  O -->|yes| P["Forced change-password screen<br/>— every other route 403s"]
  P --> Q["Employees page"]
  O -->|no| Q
```

Implemented in `apps/api/src/modules/auth` (Steps 1–4). The employee-creation half (J–M)
belongs to Step 7 (M3) and is not yet built.

## Sign in

```mermaid
flowchart TD
  A["POST /auth/login { identifier, password }"] --> B["Look up by loginId OR email<br/>(case-insensitive)"]
  B --> C{"Found and bcrypt matches?"}
  C -->|no| D["401 INVALID_CREDENTIALS<br/>— identical message either way"]
  C -->|yes| E{"emailVerifiedAt set?<br/>(admins only)"}
  E -->|no| F["403 EMAIL_NOT_VERIFIED + resend"]
  E -->|yes| G{"status ACTIVE?"}
  G -->|no| H["403 ACCOUNT_SUSPENDED"]
  G -->|yes| I["Issue access + refresh cookies<br/>write lastLoginAt + audit"]
  I --> J{"mustChangePassword?"}
  J -->|yes| K["/change-password"]
  J -->|no| L["/employees — the landing page<br/>for every role"]
```

## Refresh-token rotation and reuse detection

```mermaid
flowchart TD
  A["POST /auth/refresh"] --> B["Hash the cookie, look up RefreshToken"]
  B --> C{"Found?"}
  C -->|no| D["401 — sign in again"]
  C -->|yes| E{"revokedAt set?"}
  E -->|yes| F["Reuse detected —<br/>revoke every token in the family"] --> D
  E -->|no| G{"expiresAt passed?"}
  G -->|yes| D
  G -->|no| H["Issue new access + refresh token<br/>(same familyId)<br/>revoke the old one, chain replacedByTokenHash"]
```

A stolen-and-replayed refresh token is the attack this defends against: the legitimate
client's *next* refresh will present a token that's already been revoked-and-replaced by the
attacker's use, which is treated as reuse and kills every token in that family — both parties
get logged out and must sign in again. See `apps/api/src/modules/auth/auth.service.ts`
(`refreshSession`) and the reuse test in `auth.test.ts`.

## Authorisation

```mermaid
flowchart TD
  A["Request"] --> B["helmet · cors · rate-limit"]
  B --> C{"Valid access cookie?"}
  C -->|no| D{"Valid refresh cookie?"}
  D -->|no| E["401 → redirect to /login"]
  D -->|yes| F["Client retries after POST /auth/refresh"]
  C -->|yes| G["req.user = { sub, role, employeeId, companyId, mustChangePassword }"]
  F --> G
  G --> H{"mustChangePassword and route<br/>not in the allow-list?"}
  H -->|yes| I["403 PASSWORD_CHANGE_REQUIRED"]
  H -->|no| J["Zod validation (validate middleware)"]
  J --> K{"requireRole satisfied?"}
  K -->|no| L["403 FORBIDDEN"]
  K -->|yes| M{"companyId matches req.user.companyId?"}
  M -->|no| L
  M -->|yes| N{"assertSelfOrAdmin for the target employee?"}
  N -->|no| L
  N -->|yes| O["Execute → audit → SSE push"]
```

**Three guards, not one** — role (`requireRole`), company scope (`requireCompanyScope` /
`scopedPrisma`) and resource ownership (`assertSelfOrAdmin`), all in
`apps/api/src/middleware/auth.ts`. `scopedPrisma(companyId)` (`lib/prisma.ts`) is a Prisma
client extension that injects `where.companyId` on `findMany`/`findFirst` for every
tenant-owned model, so a route can't forget the company filter; the raw `prisma` export is a
deliberate, documented bypass for the handful of places that must cross the tenant boundary
before a companyId is known (registration, login lookup).

## Notifications and realtime

```mermaid
flowchart TD
  A["A module calls notify()<br/>(lib/notify.ts)"] --> B["Write a Notification row<br/>per recipient"]
  B --> C["Push over SSE to every open<br/>tab for that user (lib/sse.ts)"]
  B --> D{"email option passed?"}
  D -->|yes| E["Send via lib/mailer.ts<br/>(never throws — logs and continues)"]
  C --> F["GET /stream — one connection<br/>per browser tab, 25s heartbeat"]
```

`notify()` is a reusable primitive; the actual trigger points (employee created, time off
submitted/approved, attendance regularised, payslip published) belong to the modules that
raise them — Steps 7–16 — most of which are not yet built.

## What this PR does not cover

Full write-up in the PR description. In short: everything above is the platform substrate
(auth, schema, notifications, settings/audit, seed skeleton, deploy runbook) that Steps 3, 5–16
and 18–19 build on top of. Those steps belong to M2/M3/M4 and have not started in this repo yet.
