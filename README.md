# Dayflow — HR Management System

The system aims to digitize and streamline core HR operations such as employee onboarding, profile management, attendance tracking, leave management, payroll visibility, and approval workflows for admins and HR officers.

> Full spec: [`docs/Dayflow-Blueprint-v2.md`](docs/Dayflow-Blueprint-v2.md) · Build sequence: [`docs/Dayflow-ClaudeCode-Prompts-v2.md`](docs/Dayflow-ClaudeCode-Prompts-v2.md) · Team workflow: [`docs/Dayflow-Team-Plan.md`](docs/Dayflow-Team-Plan.md)

## Stack

pnpm workspaces — `backend` (Express + TypeScript + Prisma), `frontend` (Vite + React + TypeScript + Tailwind), `packages/shared` (Zod schemas shared by both).

## Local setup

```bash
pnpm install
cp backend/.env.example backend/.env      
cp frontend/.env.example frontend/.env
pnpm --filter @dayflow/api prisma migrate dev
pnpm dev                                     
```

```bash
pnpm typecheck   
pnpm lint        
pnpm test        
pnpm build       
```

`GET /api/v1/health` should return `{ "status": "ok" }` once the API is running.

## Screenshots

_Added in the final submission pass — see `docs/screenshots/`._

## Demo credentials

_Added once seed data lands (Step 20) — see `docs/DEMO-SCRIPT.md`._

## Live URLs

_Added once deployment is configured — see `docs/DEPLOY.md`._

