# Next Transaction — Render deploy (for Michael)

This is the path that matches the **current codebase**. Not Vercel. Not a rewrite.

## What you are deploying

- **App:** Next.js 16 (Node) + Prisma
- **Database:** PostgreSQL (required — SQLite is no longer the production path)
- **Blueprint file in the repo:** `render.yaml`
- **Start command:** `bash scripts/start-production.sh`  
  (runs `prisma migrate deploy`, then `next start` on `0.0.0.0:$PORT`)
- **Build command:** `npm ci && npx prisma generate && npm run build`

## Before Render (one-time)

Render needs a **Git repo it can see** (GitHub, GitLab, or Bitbucket).

1. Create a private repo (name suggestion: `next-transaction`).
2. Push this project into it (use the downloadable archive if you do not already have the code locally):
   - Archive: `/cursor/stores/bc-56916d1f-e7c6-4f3a-8891-ad19625e4698/media/next-transaction-source.zip`
3. In Render, connect that Git provider under **Account Settings → Git**.

## Exact clicks on Render

1. Open [https://dashboard.render.com](https://dashboard.render.com) (log in if needed).
2. **New → Blueprint**.
3. Select the `next-transaction` repo (the one that contains `render.yaml`).
4. Confirm the Blueprint creates:
   - Web service `next-transaction` (Free)
   - Postgres `next-transaction-db` (Free)
5. When Render asks for env vars marked “sync: false”, set at least:
   - `AUTH_EMAIL` — your login email
   - `AUTH_PASSWORD` — a strong password
6. Leave `AUTH_SECRET` and `CRON_SECRET` to auto-generate (Blueprint does this).
7. Apply / create. Wait for the first deploy to go green.
8. Open the service URL (`https://next-transaction-….onrender.com`), log in with the email/password you set.
9. In the app: switch to **Live pilot** → **Sources** → **Run all** (first live ingest). Optional: `npm run db:seed` from Render **Shell** if you want Demo/Trial seed data on the hosted DB.

### If Blueprint is awkward

Manual equivalent:

1. **New → PostgreSQL** → Free → create `next-transaction-db`.
2. **New → Web Service** → connect the same repo → runtime **Node**.
3. Build: `npm ci && npx prisma generate && npm run build`
4. Start: `bash scripts/start-production.sh`
5. Add env vars below; link `DATABASE_URL` from the Postgres **Internal Database URL**.

## Exact env vars

| Name | Required | Notes |
|------|----------|--------|
| `DATABASE_URL` | Yes | From Render Postgres → **Internal Database URL** (Blueprint wires this). |
| `AUTH_EMAIL` | Yes (hosted) | Bootstrap login email. |
| `AUTH_PASSWORD` | Yes (hosted) | Bootstrap login password. |
| `AUTH_NAME` | No | Display name (default `Pilot Agent`). |
| `AUTH_SECRET` | Yes | Session signing; Blueprint can generate. |
| `CRON_SECRET` | Yes for cron | Bearer token for `/api/cron/ingest`. Blueprint can generate. |
| `OPENAI_API_KEY` | No | Optional AI assist only. |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini`. |
| `PORT` | No | Render injects this. Do not hardcode. |
| `NODE_VERSION` | No | Blueprint sets `20`. |

Do **not** commit `.env` or paste production passwords into the repo.

## Scheduled ingest (every 6 hours)

The app endpoint is already there:

```http
GET /api/cron/ingest
Authorization: Bearer <CRON_SECRET>
```

Options:

1. **Free:** Use an external ping service (e.g. cron-job.org) against that URL every 6 hours with the Bearer header. Manual **Sources → Run all** also works.
2. **Paid (~$1+/mo):** Render **Cron Job** calling the same URL (Starter compute, billed mostly by run time).

`vercel.json` in the repo is leftover from an earlier host idea — Render ignores it.

## Cost (obvious tiers)

| Piece | Free | Paid if you outgrow free |
|-------|------|---------------------------|
| Web service | Yes (spins down after idle; cold start) | Starter ~USD $7/mo keeps it warm |
| Postgres | Yes, **30-day** free DB then must upgrade or lose data | Cheapest ongoing ~USD $6/mo (Basic-256mb) + storage |
| Cron Job | Not free | From ~USD $1/mo minimum |

For a short pilot: Free web + Free Postgres is enough. Set a calendar reminder before the 30-day DB expiry.

## What already works offline / in this codebase

- Login gate when `AUTH_*` set
- Demo / trial / my / live workspaces
- CSV import, rules, feedback, export
- Live connectors: Planning Alerts (Western Sydney) + ASX Markit feed
- Match review queue for uncertain ASX items
- Production migrate-on-start for Render

## Single next action

**In Render: New → Blueprint → select your `next-transaction` repo → set `AUTH_EMAIL` + `AUTH_PASSWORD` → create.**
