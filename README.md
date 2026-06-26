# DataHarvest Pipeline

A production-grade data pipeline that scrapes, transforms, and persists publicly available data from Books to Scrape and Hacker News, exposing results through a REST API.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DataHarvest Pipeline                      │
│                                                                  │
│  ┌───────────┐    scrape:pending    ┌───────────────────────┐   │
│  │ Scheduler │ ──────────────────► │   Scraper Workers (3) │   │
│  │ (node-cron│                      │   booksScraper.ts     │   │
│  │  Books:   │                      │   hnScraper.ts        │   │
│  │  02:00UTC │                      └──────────┬────────────┘   │
│  │  HN:*/15m │                                 │                │
│  └───────────┘                      scrape:raw │                │
│                                                ▼                │
│  ┌──────────────┐               ┌──────────────────────────┐   │
│  │  REST API    │               │  Transformer Workers (5) │   │
│  │  Express.js  │               │  bookTransformer.ts      │   │
│  │  /api/v1     │               │  hnTransformer.ts        │   │
│  └──────────────┘               └──────────────┬───────────┘   │
│         │                                       │               │
│         │                        scrape:processed               │
│         │                                       ▼               │
│         │                       ┌───────────────────────────┐  │
│         │                       │  Persister Workers (2)    │  │
│         │                       │  upsert.ts (ON CONFLICT)  │  │
│         │                       └──────────────┬────────────┘  │
│         │                                       │               │
│         ▼                                       ▼               │
│  ┌─────────────┐                    ┌──────────────────┐       │
│  │  PostgreSQL │◄───────────────────│   scrape:dlq     │       │
│  │  - books    │                    │  (failed jobs)   │       │
│  │  - hn_stories                    └──────────────────┘       │
│  │  - scrape_jobs                                               │
│  └─────────────┘                                               │
│                                                                  │
│  Infrastructure: PostgreSQL 16 + Redis 7                        │
└─────────────────────────────────────────────────────────────────┘
```

**Queue flow:** Scheduler → `scrape:pending` → Scraper → `scrape:raw` → Transformer → `scrape:processed` → Persister → PostgreSQL

Failed jobs exceeding retry budget move to `scrape:dlq`.

---

## Tech Stack

- **Runtime:** Node.js v22 + TypeScript (strict)
- **Queue:** BullMQ + Redis
- **Database:** PostgreSQL + Knex.js migrations
- **API:** Express.js
- **Scraping:** Axios + Cheerio
- **Logging:** Pino (structured JSON)
- **Scheduling:** node-cron
- **Validation:** Zod

---

## Local Setup (without Docker)

### Prerequisites

- Node.js v22+
- PostgreSQL 16 running on port 5432
- Redis 7 running on port 6379

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd dataharvest-pipeline

# 2. Install dependencies
npm install

# 3. Copy and configure environment variables
cp .env.example .env
# Edit .env with your DB and Redis credentials

# 4. Run database migrations
npx knex migrate:latest --knexfile knexfile.ts

# 5. Start the application
npx tsx src/index.ts
```

The server will be available at `http://localhost:3000`.

---

## Local Setup (with Docker)

### Prerequisites

- Docker Desktop running

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd dataharvest-pipeline

# 2. Copy environment file
cp .env.example .env

# 3. Build and start all services
docker compose up --build

# 4. Run migrations (first time only)
docker compose exec app npx knex migrate:latest --knexfile knexfile.ts
```

The server will be available at `http://localhost:3000`.

To stop:

```bash
docker compose down
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP server port |
| `NODE_ENV` | `development` | Environment (`development` / `production`) |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string |
| `SCRAPER_CONCURRENCY` | `3` | Max concurrent scraper workers |
| `TRANSFORMER_CONCURRENCY` | `5` | Max concurrent transformer workers |
| `PERSISTER_CONCURRENCY` | `2` | Max concurrent persister workers |
| `RATE_LIMIT_DELAY_MS` | `3000` | Minimum delay between HTTP requests to the same host (ms) |
| `REQUEST_TIMEOUT_MS` | `10000` | HTTP request timeout (ms) |
| `BOOKS_CRON` | `0 2 * * *` | Cron schedule for Books scrape (default: 02:00 UTC daily) |
| `HN_CRON` | `*/15 * * * *` | Cron schedule for HN scrape (default: every 15 minutes) |

---

## API Reference

Base path: `/api/v1`

### Jobs

```bash
# Manually trigger a scrape job
curl -X POST http://localhost:3000/api/v1/jobs/trigger \
  -H "Content-Type: application/json" \
  -d "{\"source\":\"books\"}"

curl -X POST http://localhost:3000/api/v1/jobs/trigger \
  -H "Content-Type: application/json" \
  -d "{\"source\":\"hackernews\"}"

# List all jobs
curl http://localhost:3000/api/v1/jobs

# Filter jobs by status and source
curl "http://localhost:3000/api/v1/jobs?status=done&source=books"

# Get single job
curl http://localhost:3000/api/v1/jobs/<jobId>

# Inspect dead-letter queue
curl http://localhost:3000/api/v1/jobs/dlq

# Retry a DLQ job
curl -X POST http://localhost:3000/api/v1/jobs/dlq/<jobId>/retry

# Delete a DLQ job
curl -X DELETE http://localhost:3000/api/v1/jobs/dlq/<jobId>
```

### Books

```bash
# List all books
curl http://localhost:3000/api/v1/books

# Filter by category
curl "http://localhost:3000/api/v1/books?category=Mystery"

# Filter by minimum rating
curl "http://localhost:3000/api/v1/books?minRating=4"

# Combined filters with pagination
curl "http://localhost:3000/api/v1/books?category=Mystery&minRating=3&page=1&limit=10"

# Get single book by UPC
curl http://localhost:3000/api/v1/books/<upc>
```

### Stories

```bash
# List all stories
curl http://localhost:3000/api/v1/stories

# Filter by type (story | ask | show | job)
curl "http://localhost:3000/api/v1/stories?type=story"
curl "http://localhost:3000/api/v1/stories?type=ask"
curl "http://localhost:3000/api/v1/stories?type=show"

# Filter by minimum score
curl "http://localhost:3000/api/v1/stories?minScore=5"

# Combined filters with pagination
curl "http://localhost:3000/api/v1/stories?type=story&minScore=3&page=1&limit=10"

# Get single story by HN item ID
curl http://localhost:3000/api/v1/stories/<hn_item_id>
```

### Metrics & Health

```bash
# Queue metrics (depth, completed, failed per queue)
curl http://localhost:3000/api/v1/metrics

# Health check (DB + Redis connectivity)
curl http://localhost:3000/api/v1/health
```

---

## Monitoring Queue Status

```bash
# Check queue depths and job counts
curl http://localhost:3000/api/v1/metrics
```

Response includes per-queue depth, last-hour completed/failed/pending counts, average processing latency, and last successful run per source:

```json
{
  "queues": {
    "scrape:pending": {
      "depth": { "active": 0, "completed": 20, "failed": 0, "waiting": 0 },
      "lastHour": { "completed": 5, "failed": 0, "pending": 0, "averageProcessingLatencyMs": 1200 }
    }
  },
  "averageProcessingLatencyMs": 950,
  "lastSuccessfulRunBySource": {
    "books": "2026-06-26T02:00:00.000Z",
    "hackernews": "2026-06-26T02:15:00.000Z"
  }
}
```

To inspect failed jobs in the DLQ:

```bash
curl http://localhost:3000/api/v1/jobs/dlq
```

---

## Database Schema

| Table | Dedup Key | Notes |
|---|---|---|
| `scrape_jobs` | `id` (UUID) | Tracks every scrape job lifecycle |
| `books` | `upc` | Upserted on conflict by UPC |
| `hn_stories` | `hn_item_id` | Upserted on conflict by HN item ID |

Migrations are managed with Knex.js and live in `src/db/migrations/`.

---

## Known Limitations & Trade-offs

**Hacker News rate limiting:** HN returns HTTP 429 when requests are made too frequently. The scraper handles this gracefully — jobs complete with 0 stories upserted when blocked. The block typically lifts within a few minutes. The `RATE_LIMIT_DELAY_MS` env var controls the delay between requests.

**Books scraper ~3 min per run:** Each of the 50 books requires an individual detail page request. With the rate limiter, a full run takes approximately 3 minutes. This is intentional to respect the source site.

**Book category scraping:** A small number of books return `"Add a comment"` as their category due to inconsistent breadcrumb structure on the detail pages. These are edge cases in the source site's HTML.

**Metrics endpoint:** Exposes BullMQ queue depth, last-hour throughput, average processing latency, and last successful run timestamp per source (from `scrape_jobs`).

**Tests:** Unit tests cover Zod validation in `bookTransformer` and `hnTransformer`. An integration test validates the scraper→transformer data contract.

**`scrape:dlq` queue name:** BullMQ does not allow `:` in queue names by default in some configurations. Queue names use hyphens internally (`scrape-pending`, etc.) but are aliased to colon notation in the API responses for spec compliance.

---

## Queue Design

| Queue | Workers | Retry Policy | Priority |
|---|---|---|---|
| `scrape:pending` | 3 | 3x exponential backoff (base 2s, max 30s) | HN=1 (high), Books=2 (normal) |
| `scrape:raw` | 5 | 1x retry | — |
| `scrape:processed` | 2 | 5x linear backoff (5s each) | — |
| `scrape:dlq` | — | No retry (manual via API) | — |

Graceful shutdown on `SIGTERM`/`SIGINT`: workers stop accepting new jobs, in-flight jobs complete (max 30s), then process exits cleanly.