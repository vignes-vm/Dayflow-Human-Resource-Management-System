# Dayflow — Deployment Guide

Target stack: **Neon** (Postgres) + **Render** (`backend`) + **Vercel** (`frontend`), both
auto-deploying on push to `main`. This doc is the runbook — it has not been run against live
accounts in this session (no hosting credentials were available), so **live URLs and the
"deployed" acceptance checks in Step 20 still need to be completed by whoever holds those
accounts.** Everything below is ready to execute as-is.

---

## 1. Provision Neon (Postgres)

1. Create a project at [neon.tech](https://neon.tech) → note the pooled connection string
   (`...?sslmode=require`).
2. Run the migration against it once, from a machine with the real `DATABASE_URL`:
   ```bash
   DATABASE_URL="<neon-connection-string>" pnpm --filter @dayflow/api prisma migrate deploy
   ```
3. Keep a second Neon branch (or a local Postgres) for CI/dev — never point CI at the
   production database.

## 2. Deploy `backend` on Render

Create a **Web Service** pointing at this repo.

| Setting | Value |
|---|---|
| Root directory | `backend` |
| Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm --filter @dayflow/api prisma generate && pnpm --filter @dayflow/api build` |
| Start command | `node dist/index.js` |
| Health check path | `/api/v1/health` |
| Auto-deploy | On push to `main` |

Run the migration as part of the release, either as a Render **pre-deploy command**
(`pnpm --filter @dayflow/api prisma migrate deploy`) or manually before the first deploy.

### Environment variables (Render)

All variables documented in `backend/.env.example`:

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Long random strings (`openssl rand -hex 32`), distinct per secret, never reused from dev |
| `ACCESS_TTL` / `REFRESH_TTL` | `15m` / `7d` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | Real SMTP provider (e.g. Resend SMTP). Leave unset only in dev — production must not silently fall back to Ethereal |
| `MAIL_FROM` | `Dayflow <no-reply@yourdomain>` |
| `APP_URL` | The Vercel URL, e.g. `https://dayflow.vercel.app` |
| `API_URL` | The Render URL, e.g. `https://dayflow-api.onrender.com` |
| `UPLOAD_DIR` | `./uploads` (or point at a persistent disk / object storage — Render's filesystem is ephemeral on redeploy, so uploaded avatars/certificates/payslips will not survive a redeploy unless a Render Disk is attached) |
| `NODE_ENV` | `production` |
| `PORT` | Render sets this automatically |

## 3. Deploy `frontend` on Vercel

| Setting | Value |
|---|---|
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `pnpm --filter @dayflow/web build` |
| Output directory | `dist` |
| Install command | `corepack enable && pnpm install --frozen-lockfile` |

Add a SPA rewrite so client-side routes don't 404 on refresh — `frontend/vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Environment variables (Vercel)

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://<render-service>.onrender.com/api/v1` |

## 4. Cross-origin cookies

Auth uses httpOnly cookies across two different domains (Vercel ↔ Render), so in production:

- `backend/src/modules/auth/auth.cookies.ts` already sets `Secure` + `SameSite=None` whenever
  `NODE_ENV=production` — confirm that env var is actually set on Render.
- Add the Vercel domain (and any preview-deployment wildcard you use) to the CORS allow-list —
  `backend/src/index.ts` reads `APP_URL`, which currently supports a comma-separated list:
  `APP_URL="https://dayflow.vercel.app,https://dayflow-*.vercel.app"` (adjust for exact preview
  URLs your Vercel project generates, since CORS does not support wildcards natively — list them
  explicitly, or add a small origin-matching function if preview deploys need to work).

## 5. First deploy checklist

1. Neon migrated (`prisma migrate deploy` succeeds, `prisma studio` shows every table).
2. Render service healthy — `GET https://<api>/api/v1/health` returns `{"status":"ok"}`.
3. Vercel deployment loads and can reach the API (check the Network tab for CORS errors).
4. Run the seed once against production (`DATABASE_URL=<neon> pnpm --filter @dayflow/api db:seed`)
   — see `backend/prisma/seed/`. Only `01-company-users.ts` exists as of this commit; the
   full demo dataset (employees, attendance, time off, payroll) lands as the other members
   finish Steps 7–16.
5. Sign in as the seeded admin (`admin@odooindia.example` / `Dayflow@2026`) on the deployed
   site end to end: sign in → change password screen is *not* forced (admin/HR are pre-verified)
   → land on `/employees`.
6. Update this doc's "Live URLs" section below once real URLs exist, and add the same
   credentials to the sign-in page's Demo accounts box (Step 5, M2).

## Live URLs

_Not yet deployed — fill in once Render/Vercel/Neon are provisioned with real accounts._

- API: `TBD`
- Web: `TBD`
