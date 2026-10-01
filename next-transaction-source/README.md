# Next Transaction

Western Sydney industrial prospecting pilot. Transparent rule-based research leads. **Live pilot** is real public sources only. **Demo** is a separate fictional seed (`npm run db:seed`) and is not loaded in production unless you run that command yourself.

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

- On a hosted start, if `CRON_SECRET` is set and Live has no opportunities, the server calls `GET /api/cron/ingest?mode=if-empty` after boot.
- The first signed-in page also starts that same empty-feed collect once.
- UI: **Sources** → **Run sources** (keeps running after the click; refresh to see counts). The empty Live feed has the same button.
- HTTP cron: `GET /api/cron/ingest` with `Authorization: Bearer $CRON_SECRET`

### Working sources (access checked before they were wired in)

1. **Planning Alerts** — public HTML for Blacktown, Penrith, Liverpool, Fairfield, Campbelltown, Cumberland, Parramatta, Camden, Hawkesbury, The Hills and Bankstown. Several pages each. Industrial wording only. Stores URL, publisher, date, excerpt. Deduped.
2. **NSW major projects** — public Planning Portal HTML, filtered to warehouse/distribution (and data storage in the main industrial LGAs). Street is stored only when the page publishes one; otherwise the project name plus the named LGA.
3. **ASX announcements** — Markit Digital JSON (market feed plus Goodman, Centuria Industrial, Charter Hall Long WALE, GPT, Dexus, Charter Hall, Growthpoint, Stockland, Mirvac, Centuria Capital, Aspen, HomeCo). No warehouse is created from a company-wide headline.
4. **Western Sydney industrial media** — Google News RSS. Headlines without a street stay in **Review**.

Planning and major-project pages become Live research leads. They are not sale instructions. Owner, tenant and lease stay Unknown unless the source states them.

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
4. After deploy, open the site and sign in. Live should start collecting on its own. If the feed is still empty, click **Run sources** and refresh after a minute. Do not run `npm run db:seed` on the production database unless you want the fictional demo as well.

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
