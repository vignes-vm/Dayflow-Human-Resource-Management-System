# CLAUDE.md

Guidance for Claude Code (and any other agent or contributor) working in this repository.

## Product summary

Dayflow is a multi-tenant HR Management System: employee onboarding and profiles,
attendance and presence tracking, time-off requests and approvals with a team
coverage view, and attendance-driven payroll with generated payslips. Every
company that signs up is an isolated tenant — an Admin registers the company,
then Admin/HR create every employee account (there is no public employee
self-registration).

Full spec: `docs/Dayflow-Blueprint-v2.md`. Build sequence: `docs/Dayflow-ClaudeCode-Prompts-v2.md`.
Team ownership and workflow: `docs/Dayflow-Team-Plan.md`.

## Stack

| Layer | Choice |
|---|---|
| Repo | pnpm workspaces: `backend`, `frontend`, `packages/shared` |
| Frontend | React 18 + Vite + TypeScript + Tailwind + shadcn/ui |
| Frontend state | TanStack Query · React Hook Form + Zod · Recharts · Framer Motion |
| Backend | Node + Express + TypeScript + Prisma |
| DB | PostgreSQL |
| Auth | JWT access (15 min) + refresh (7 d), httpOnly cookies, rotation with reuse detection |
| Money | `Decimal @db.Decimal(12,2)` in Prisma, `decimal.js` in services — never floats |
| Mail | Nodemailer (SMTP, Ethereal fallback in dev) |
| PDF | PDFKit |
| Realtime | Server-Sent Events |
| Deploy | Vercel (web) + Render (api) + Neon (db) |

## Folder conventions

```
backend/src/
├─ index.ts       app bootstrap
├─ router.ts       every route mount point, declared once
├─ engines/        pure business-rule functions — no DB, no Express, fully unit-tested
├─ middleware/      auth, rbac, company scope, validation, audit, error handling
├─ lib/            prisma client, mailer, sse, dates, money, logger, pdf
├─ jobs/           scheduled jobs (daily close, presence sweep)
└─ modules/<name>/  routes + controllers + services for one domain, mounted in router.ts

frontend/src/
├─ app/            router, providers, guards, nav config
├─ styles/         design tokens
├─ components/     shared UI primitives and cross-feature components
├─ lib/            api client, query keys, formatting
├─ hooks/          shared hooks
└─ features/<name>/ one folder per domain screen/flow

packages/shared/src/  one Zod schema file per domain + enums.ts + index.ts barrel
```

**Ownership boundary:** each file above belongs to exactly one team member per
`docs/Dayflow-Team-Plan.md` §2. `prisma/schema.prisma`, `router.ts`, `nav.config.ts`,
`app/router.tsx` and the shared barrel/enums files are edited by a single owner only —
everyone else consumes what they export.

## Commit convention

Conventional Commits: `feat(scope): summary`, `fix(scope): summary`, `chore: summary`,
`test: summary`, `docs: summary`. One commit (squashed on merge) per build step.

## Standing rules

1. Never put secrets in code. All secrets come from environment variables documented in `.env.example`.
2. All API input is validated with Zod schemas from `packages/shared`.
3. All multi-write DB operations run inside a Prisma transaction.
4. Every mutating route writes an `AuditLog` entry.
5. Every list/read query is scoped by `companyId`.
6. All money and percentage arithmetic uses `decimal.js`. Never JavaScript floats.
7. Business rules live as pure functions in `backend/src/engines/` with unit tests and no DB access.
8. Every new screen ships with loading, empty and error states.
9. All colours and fonts come from the token file (`frontend/src/styles/tokens.css`) — never a hardcoded hex.

## Commands

```bash
pnpm install        # install all workspace dependencies
pnpm dev             # run api + web together
pnpm build           # build all packages
pnpm typecheck       # typecheck all packages
pnpm lint            # lint all packages
pnpm test            # run all unit/integration tests
pnpm --filter @dayflow/api prisma studio    # inspect the database
pnpm --filter @dayflow/api prisma migrate dev --name <name>
```
