# Load tests

How much Peal takes: the public API under a busy day's requests, and posts
due in the same minute going out. k6 drives the API; the server runs as it
does in production, its jobs included, against a database the size of
many users, and publishes to a fake Mastodon instance. Nothing reaches a
real platform. Runs are by hand: never in `bun run test` or CI, which have
neither k6 nor the minutes they take.

## Run

You need the development stack up (`bun nx run peal-docker:up`), Docker,
k6 (`brew install k6`) and OpenSSL. Then, from the repository root:

1. `bun nx run peal-load:seed` makes `peal_loadscale` (any `DATABASE_URL`
   naming a database ending in `scale`), migrates it and fills it with the
   server's `seed-scale.ts`: 10,000 users, 41,000 channels, 900,000 posts.
   Once per database: it leaves one that holds posts alone.
2. `bun nx run peal-load:serve` (continuous) starts the fake platform in a
   container on 127.0.0.1:443, then the server on 3100; `SERVERS=3` starts
   three, on 3100 to 3102, each its own cluster runner.
3. `bun nx run peal-load:setup` makes the synthetic account, 40 workspaces
   with an API key, 10 channels on the fake platform and a webhook endpoint
   each, in `.local/config.json`.
4. `PROFILE=blackfriday bun nx run peal-load:api` runs the API mix
   (`k6/api-mix.ts`: `smoke`, `steps`, `blackfriday`, `flat`), writes
   `.local/api.csv` and summarises it every 30 seconds
   (`scripts/summary.ts`). Give `SERVERS` as `serve` had it.
5. `bun nx run peal-load:burst` schedules 1,229 posts (`POSTS`) for the
   minute three ahead (`LEAD`) through the API, then watches them go out:
   how late after their minute, and the fake's busiest second.

## Read the results

- The seed's channels are sealed under a key the run never holds, so the
  collections and the token sweep read them and fail before any call: they
  still open each channel's gate, as a server with that many channels
  would. The first hour after seeding has all of them due at once, the
  worst case: run a burst then too.
- The figures are this machine's, not production's: a laptop's cores are
  several times faster than the server's. Compare runs on one machine, and
  say which machine a figure came from.
- The fake answers a post after `FAKE_LATENCY_MS` (250 ms); a platform is
  often slower.
- Thresholds are a busy day's figures: 99.961% of requests without a
  server error, a median of 64 ms.

## Watch out

- A burst due right after a collection or the token sweep reads more
  channels than the runner holds entities (`maxResidentEntities` in the
  server's `src/app/cluster.ts`) waits until their gates go idle, ten
  minutes on: at Effect's default of 10,000, the seeded database's
  collections held a burst 23 minutes (2026-11-26). Run a burst after one
  when the limit or the gates change.
- A run writes tens of thousands of scheduled posts and their jobs into its
  database, due weeks ahead. Never point it at the development database:
  every script refuses a name that does not end in `scale`. Drop the
  database when done with it, or keep it for the next run.
- Stop `serve` before running the server's tests on the same machine, and
  the other way round: both load the same Postgres.
- The servers run with the rate limit raised (`PEAL_API_REQUESTS_PER_MINUTE`)
  and `PEAL_OUTBOUND_ALLOWED_HOSTS=127.0.0.1`, which only a load run sets.
- The run's token key, certificate, logs and results stay in `.local/`
  (Git-ignored), never committed.
