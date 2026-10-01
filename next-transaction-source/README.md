# Next Transaction

Western Sydney industrial prospecting pilot. Transparent rule-based research leads from **manual evidence** and **working ingestion** (Planning Alerts + ASX company announcements).

## Prerequisites

- Node.js 20+
- npm
- PostgreSQL (local via Docker Compose, or hosted)

## Setup

```bash
npm install
cp .env.example .env
# start local Postgres, then set DATABASE_URL in .env, e.g.:
docker compose up -d
# DATABASE_URL="postgresql://nt:nt@localhost:5432/next_transaction?schema=public"
npx prisma migrate deploy
npm run db:seed
npm run ingest          # retrieve live planning + ASX records into Live pilot
npm run dev
```

Open [http://127.0.0.1:43123](http://127.0.0.1:43123).

## Auth (hosted)

Set server-side env vars before exposing agency data:

```bash
AUTH_EMAIL=agent@example.com
AUTH_PASSWORD=choose-a-strong-password
AUTH_SECRET=long-random-string
CRON_SECRET=long-random-string
```

When `AUTH_EMAIL` + `AUTH_PASSWORD` are set, the app requires login. Without them, local/temporary previews stay open for development.

## Scheduled ingestion

- UI: **Sources** → Run all / Refresh
- HTTP cron: `GET /api/cron/ingest` with `Authorization: Bearer $CRON_SECRET`

### Working sources

1. **Planning Alerts (Western Sydney LGAs)** — public HTML listings for Blacktown, Penrith, Liverpool, Campbelltown (Fairfield when available). Stores URL, publisher, event date, retrieval time, excerpt. Industrial-keyword filtered.
2. **ASX company announcements** — public Markit Digital JSON feed used by asx.com.au. Keeps property/industrial-relevant headlines. Without an explicit address, records go to the **match review queue** (never auto-attached to a warehouse).

## Workspaces

| Workspace | Contents |
|-----------|----------|
| **Live pilot** | Genuinely retrieved records only — never padded with fiction |
| **Demo** | Fictional seed data only |
| **Public trial** | Manually curated public pages |
| **My workspace** | Your CSV / manual evidence |

## Hosting on Render

This repo includes `render.yaml` (Web Service + Postgres). Production start runs migrations then `next start` on `0.0.0.0:$PORT`.

**Plain-English steps for Michael:** see the Project Agent Store file  
`docs/render-deploy.md` (or the copy shipped with the source archive).

Summary:

1. Put this code in a Git repo Render can access (GitHub / GitLab / Bitbucket).
2. In Render: **New → Blueprint** → select the repo → apply.
3. When prompted, set `AUTH_EMAIL` and `AUTH_PASSWORD` (and optionally `OPENAI_API_KEY`).
4. After deploy, open the `.onrender.com` URL, log in, run **Sources → Run all**, or hit `/api/cron/ingest` with `CRON_SECRET`.

## Tests

```bash
npm run test:core
npm run test:e2e
npm run test:pilot
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Dev server on `0.0.0.0:43123` |
| `npm start` | Production: migrate deploy + Next on `$PORT` |
| `npm run ingest` | Run both source connectors |
| `npm run db:seed` | Demo + trial seeds |
| `npm run db:deploy` | Apply Prisma migrations |
| `npm run build` | Production build |
