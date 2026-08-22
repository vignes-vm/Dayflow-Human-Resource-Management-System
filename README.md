# Dayflow — HR Management System

The system aims to digitize and streamline core HR operations such as employee onboarding, profile management, attendance tracking, leave management, payroll visibility, and approval workflows for admins and HR officers.

> Full spec: [`docs/Dayflow-Blueprint-v2.md`](docs/Dayflow-Blueprint-v2.md) · Build sequence: [`docs/Dayflow-ClaudeCode-Prompts-v2.md`](docs/Dayflow-ClaudeCode-Prompts-v2.md) · Team workflow: [`docs/Dayflow-Team-Plan.md`](docs/Dayflow-Team-Plan.md)

## Stack

pnpm workspaces — `apps/api` (Express + TypeScript + Prisma), `apps/web` (Vite + React + TypeScript + Tailwind), `packages/shared` (Zod schemas shared by both).

## Local setup

```bash
pnpm install
cp apps/api/.env.example apps/api/.env      # then point DATABASE_URL at a local Postgres
cp apps/web/.env.example apps/web/.env
pnpm --filter @dayflow/api prisma migrate dev
pnpm dev                                     # runs api (:4000) + web (:5173) together
```

```bash
pnpm typecheck   # all packages
pnpm lint        # all packages
pnpm test        # all packages
pnpm build       # all packages
```

`GET /api/v1/health` should return `{ "status": "ok" }` once the API is running.

## Screenshots

_Added in the final submission pass — see `docs/screenshots/`._

## Demo credentials

_Added once seed data lands (Step 20) — see `docs/DEMO-SCRIPT.md`._

## Live URLs

_Added once deployment is configured — see `docs/DEPLOY.md`._

