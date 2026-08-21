# InsuredMine Node.js Assessment

Policy data ingestion + query APIs, a CPU-aware process supervisor, and a persistent
message scheduler, built for the InsuredMine Node.js developer assessment.

## Stack

Node.js, Express, MongoDB (Mongoose), `worker_threads`, Agenda (Mongo-backed job
scheduling), Multer, SheetJS (`xlsx`).

## Data model

The sheet is normalized into six collections instead of one flat table, so a policy
just holds references instead of repeating agent/user/category/carrier data on every
row:

```
Agent 1---* Account 1---* User 1---* Policy *---1 Category
                                        Policy *---1 Carrier
```

- **Agent** — `name`
- **Account** — `accountName`, `agentId`
- **User** — `firstname, dob, address, phone, state, zip, email, gender, userType, accountId`
- **Category** (LOB) — `categoryName`
- **Carrier** — `companyName`
- **Policy** — `policyNumber, startDate, endDate, premiumAmount, categoryId, companyId, userId`

`email` is used as the natural unique key for a user (firstnames repeat in the sheet,
emails don't) and `policyNumber` as the unique key for a policy, so re-uploading the
same file is idempotent.

## Task 1 — ingestion & query APIs

### Upload (worker-threads based)

`POST /api/upload` — multipart form, field name `file` (`.csv`, `.xlsx`, `.xls`,
25MB limit). Requests are rejected above that in `src/middlewares/upload.js`.

The request thread never touches parsing or DB writes directly:

1. A **master-data worker** reads the sheet, dedupes Agent/Account/User/Category/
   Carrier by their natural key, and upserts them, returning id maps to the main
   thread. `.csv` files are streamed row-by-row (`fs.createReadStream` piped through
   `csv-parse`) instead of being read fully into memory — `.xlsx`/`.xls` still go
   through SheetJS's `readFile`, since the binary spreadsheet format has to be
   loaded whole regardless of library.
2. The policy rows are chunked (`UPLOAD_CHUNK_SIZE`, default 500) and fanned out
   across a **worker pool** (`UPLOAD_WORKER_POOL_SIZE`, capped at `os.cpus().length`)
   that bulk-upserts `Policy` documents in parallel.

This is split into two phases instead of one because letting every worker upsert
master data concurrently risks racing on the same Agent/Account/Category/Carrier
document; only the (single-row) master phase touches those collections, and the
parallel phase only ever inserts Policy rows, which are independent of each other.

```bash
curl -X POST http://localhost:4000/api/upload -F "file=@sample-data/policy-data.csv"
```

### Search by username

`GET /api/policies/search?username=<firstname prefix>` — returns every policy for
matching users, with category and carrier populated.

```bash
curl "http://localhost:4000/api/policies/search?username=Lura"
```

### Aggregated policies per user

`GET /api/policies/aggregate` — one row per user: policy count, total premium, and
the list of their policies.

```bash
curl http://localhost:4000/api/policies/aggregate
```

## Task 2 — ops features

### CPU-aware restart

`npm start` runs `supervisor.js`, not the server directly. The supervisor forks
`src/server.js` as a child process and samples system CPU usage on an interval
(`CPU_CHECK_INTERVAL_MS`) using the idle/total delta of `os.cpus()` — no polling
package needed. If usage stays at or above `CPU_THRESHOLD_PERCENT` (default 70) for
`CPU_SUSTAINED_SAMPLES` consecutive checks (to avoid restarting on a brief spike), it
sends the child `SIGTERM` for a graceful shutdown and forks a replacement.

A process can't reliably restart itself while it's the one pegging the CPU, so the
supervisor/child split is what actually makes "restart the server at 70%" possible
rather than just crashing it.

`GET /health/cpu` reports the current sampled usage on demand.

### Scheduled message insert

`POST /api/messages` — body: `{ "message": "...", "day": "YYYY-MM-DD", "time": "HH:mm" }`.

This is backed by **Agenda** (a MongoDB-backed job queue) rather than `node-cron`:
the job is persisted to the `agendaJobs` collection at schedule time and only fires
once, at the exact date/time given — including surviving a server restart in
between, which an in-memory cron scheduler wouldn't. The message is only written to
`scheduledmessages` when the job actually runs, not at request time.

```bash
curl -X POST http://localhost:4000/api/messages \
  -H "Content-Type: application/json" \
  -d '{"message":"Follow up with client","day":"2026-08-25","time":"10:30"}'
```

## Project layout

```
src/
  config/        env + mongoose connection
  models/        one file per collection
  workers/       masterData.worker.js, policyInsert.worker.js, workerPool.js
  services/      upload / policy / scheduler business logic
  controllers/   thin request handlers
  routes/
  middlewares/   multer config, error handler
  utils/         logger, CPU sampling
  app.js         express app
  server.js      DB connect + listen (the process the supervisor forks)
supervisor.js    CPU-aware parent process, entry point for `npm start`
sample-data/     the assessment's CSV, for a quick local test
scripts/         uploadSample.js - posts sample-data/policy-data.csv to a running server
```

## Running locally

```bash
npm install
cp .env.example .env      # point MONGODB_URI at your local/Atlas instance
npm start                 # supervisor + server
# or, without the CPU supervisor, for plain dev:
npm run dev

node scripts/uploadSample.js   # loads the sample sheet through the upload API
```

Requires MongoDB reachable at `MONGODB_URI` and Node 18+ (uses global `fetch`/
`FormData` in `scripts/uploadSample.js`).

## Notes / assumptions

- "Search by username" — the sheet has no `username` field, so this matches against
  `User.firstname` (case-insensitive prefix).
- `premiumAmount` on `Policy` isn't in the spec's field list but is in the sheet, and
  is used for the `totalPremium` figure in the aggregate endpoint — left out entirely
  it would've been a less useful aggregation.
- Rows missing a resolvable user/category/carrier are skipped and counted separately
  in the upload response rather than failing the whole batch.
