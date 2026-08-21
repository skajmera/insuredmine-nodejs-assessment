# InsuredMine Node.js Assessment

Policy data ingestion + query APIs, a CPU-aware process supervisor, and a persistent
message scheduler, built for the InsuredMine Node.js developer assessment.

## Stack

Node.js, Express, MongoDB (Mongoose), `worker_threads`, Agenda (Mongo-backed job
scheduling), Multer, SheetJS (`xlsx`).

## Security

- **Helmet** — standard security headers (`X-Content-Type-Options`,
  `X-Frame-Options`, HSTS, etc.) on every response.
- **Rate limiting** (`express-rate-limit`) — a general limit on all of `/api`
  (`RATE_LIMIT_API_MAX`, default 300/15min per IP), plus a much tighter one
  specifically on `POST /api/upload` (`RATE_LIMIT_UPLOAD_MAX`, default 20/15min) —
  it's the one endpoint that spins up worker threads and does the heaviest DB
  writes, so it's the one worth protecting separately from general API traffic.
  Verified: the 21st upload request in a 15-minute window gets `429` with a
  `Retry-After` header telling the client when to come back.
- **NoSQL injection** — `express-mongo-sanitize` strips any `$`/`.`-prefixed keys
  from `req.body`/`req.query`/`req.params` before a route ever sees them. This is a
  real gap, not a hypothetical one: `GET /api/policies/search?username[$ne]=` turns
  `username` into `{ $ne: '' }` under Express's default query parser, and without
  sanitizing that, it reached `.toLowerCase()` in the search service and blew up
  into a raw 500. Each user-supplied field the controllers accept (`username`,
  `message`, `day`, `time`) also gets an explicit `typeof === 'string'` check as a
  second layer, so a wrong-shaped value is a clean `400` either way, not a stack
  trace.
- `express.json({ limit: '10kb' })` — the JSON endpoints here (scheduling a
  message) never need more than that; capping it is a one-line guard against
  oversized-body abuse.

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
`UPLOAD_MAX_FILE_SIZE_MB` limit, default 200MB — the sample sheet is tiny, but a
real InsuredMine export across every agent/carrier won't be). Requests over that
are rejected in `src/middlewares/upload.js`.

The request thread never touches parsing or DB writes directly:

1. A **master-data worker** reads the sheet in a single pass, deduping
   Agent/Account/User/Category/Carrier by their natural key as it goes and building
   the (much smaller) list of policy rows at the same time — it never holds both the
   full raw rows and a separately-mapped policy list in memory at once. `.csv` files
   are streamed row-by-row (`fs.createReadStream` piped through `csv-parse`) instead
   of being read fully into memory first; `.xlsx`/`.xls` still go through SheetJS's
   `readFile`, since the binary spreadsheet format has to be loaded whole regardless
   of library. It upserts master data and returns id maps to the main thread.
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

`GET /api/policies/aggregate?page=1&limit=50` — one row per user: policy count,
total premium, and the list of their policies. Paginated (`limit` capped at 200)
since an ungrouped response here would mean every user in the database, each with
every policy embedded, in one payload.

```bash
curl "http://localhost:4000/api/policies/aggregate?page=1&limit=50"
# => { users: [...], total: 1149, page: 1, limit: 50 }
```

Note: pagination bounds the *response size*, not the work done — grouping by user
still means scanning the whole `Policy` collection, since every policy has to be
looked at to know which user it belongs to. For a much bigger collection than this
assessment's, the next step would be a materialized per-user summary that's updated
incrementally on each policy write, instead of re-aggregating on every read — not
done here since nothing in this assessment's scope needs it yet.

## Indexing & transactions

Added, and why:

- Unique index on every natural key (`Agent.name`, `Account.accountName`,
  `Category.categoryName`, `Carrier.companyName`, `User.email`,
  `Policy.policyNumber`) — these are exactly the fields every upsert during upload
  filters on, so they're both a correctness constraint and the index that makes the
  upload's `find({field: {$in: [...]}})` / `bulkWrite` upserts fast instead of
  scanning.
- `Policy.userId` — the search endpoint's `Policy.find({ userId: { $in: [...] } })`
  and the aggregate endpoint's `$lookup` both key off it.
- `User.firstnameLower` — the search endpoint matches `firstname` case-insensitively.
  A plain index on `firstname` doesn't actually help here: checked with
  `.explain("executionStats")`, and a case-insensitive `$regex` against a
  case-sensitive index still examines every key (1149 of 1149 in the sample data —
  a full index scan in disguise). Storing a lowercased `firstnameLower` alongside
  `firstname` and matching a case-sensitive anchored regex against *that* is what
  actually gets a tight index range scan (2 keys examined for the same query, per
  `explain`).

Deliberately not added: an index on `Policy.categoryId`, `Policy.companyId`,
`Account.agentId`, or `User.accountId`. Nothing currently queries by any of them —
they only ever get read via `$lookup`/`populate` on the *other* side (`_id`, which
is already indexed by default). An index that isn't backing an actual query is just
extra write cost on every insert for no read benefit.

No multi-document transactions, on purpose. Every write in this codebase is either
a single independent document, or an idempotent upsert keyed by a natural key — so
there's no place where two documents need to succeed or fail together for
correctness; a retry after a partial failure just converges to the same end state.
The upload flow specifically *wants* partial success (`ordered: false` bulk writes)
so a handful of bad rows don't roll back the other thousand good ones. On top of
that, multi-document transactions need a replica set — a standalone `mongod` (what
this was tested against locally) can't run them at all.

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

**What happens to an in-flight request when this fires** — e.g. someone's mid-upload
when CPU crosses the threshold, which is realistic, since a big upload is itself
CPU-heavy enough to be *why* usage crossed 70% in the first place:

- `SIGTERM` doesn't kill anything by itself. `server.js`'s handler calls
  `server.close()`, which stops accepting new connections but waits for in-flight
  requests to finish — confirmed by sending `SIGTERM` mid-upload and watching the
  process stay alive until the upload's response was sent.
- The supervisor's own fallback timer (`CPU_SHUTDOWN_GRACE_MS`, default 30s) is what
  actually forces the issue if graceful shutdown takes too long: past that, it sends
  `SIGKILL`, which *does* kill everything immediately, worker threads included,
  mid-write if need be. Verified this by loading ~30k rows (real upload time ~15-25s)
  and letting the CPU monitor fire a restart while it was running: with the grace
  period at 30s, all 30k rows landed; cut down to the old hardcoded 5s, the process
  got force-killed with only ~4k of 30k rows in — same request, no response ever
  reached the client, and the import was left incomplete.
- That incomplete-import outcome is recoverable, not corrupt, specifically because
  every write in the upload path is an idempotent upsert keyed by a natural key (see
  *Indexing & transactions* below): re-uploading the exact same file after a forced
  kill just fills in whatever didn't make it in, nothing gets double-inserted.
- 30 seconds is a bounded best-effort, not a guarantee — a large enough file can still
  exceed it and get force-killed, which is an accepted trade-off (Kubernetes' own
  default pod termination grace period is also 30s) rather than waiting indefinitely
  for a shutdown that, on a genuinely stuck process, might never happen on its own.

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
