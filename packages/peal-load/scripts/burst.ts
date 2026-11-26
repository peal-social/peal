// A publishing burst: k6 schedules POSTS posts (1,229 by default, a record
// minute at Black Friday scale) for the same minute, LEAD minutes ahead,
// spread over the run's channels, then this watches them go out on the fake
// platform, and says how late they went and how fast.
//
//   POSTS=1229 LEAD=3 bun scripts/burst.ts
import path from "node:path";

import { Schema } from "effect";

import { databaseUrl, fakeStatsUrl, packageRoot } from "./run.ts";

const posts = process.env["POSTS"] ?? "1229";
const lead = Number(process.env["LEAD"] ?? "3");

// How long after the minute to wait for the last post, in seconds.
const patience = Number(process.env["PATIENCE"] ?? "900");

const at = new Date(Date.now() + lead * 60_000);

at.setUTCSeconds(0, 0);

const StatsSchema = Schema.fromJsonString(
  Schema.Struct({
    hooks: Schema.Number,
    statuses: Schema.Number,
    statusesPeakPerSecond: Schema.Number,
  })
);

const stats = async () => {
  const answer = await fetch(`${fakeStatsUrl}/stats`);

  return Schema.decodeUnknownSync(StatsSchema)(await answer.text());
};

await fetch(`${fakeStatsUrl}/reset`, { method: "POST" });

console.log(`Scheduling ${posts} posts for ${at.toISOString()}`);

const scheduled = Bun.spawn(
  ["k6", "run", "--quiet", path.join(packageRoot, "k6", "schedule-burst.ts")],
  {
    env: { ...process.env, AT: at.toISOString(), POSTS: posts },
    stdio: ["ignore", "inherit", "inherit"],
  }
);

if ((await scheduled.exited) !== 0) {
  throw new Error("k6 failed to schedule the burst");
}

const sql = new Bun.SQL(databaseUrl);

const CountsSchema = Schema.Array(
  Schema.Struct({ n: Schema.Number, status: Schema.String })
);

// The burst's targets by status.
const counts = async () => {
  const rows = Schema.decodeUnknownSync(CountsSchema)(
    await sql`
      SELECT t.status, count(*)::int AS n
      FROM publishing.post_targets t
      JOIN publishing.posts p ON p.id = t.post_id
      JOIN auth.organization o ON o.id = p.workspace_id
      WHERE p.scheduled_at = ${at} AND o.slug LIKE 'load-run-%'
      GROUP BY t.status`
  );

  return new Map(rows.map((row) => [row.status, row.n]));
};

const scheduledTargets = await counts();
const total = [...scheduledTargets.values()].reduce((a, b) => a + b, 0);

// Prints each change of the counts, once a second, until every target is
// done or `patience` has passed since the minute.
const watch = async (last: string): Promise<void> => {
  const byStatus = await counts();
  const done = (byStatus.get("published") ?? 0) + (byStatus.get("failed") ?? 0);
  const since = Math.round((Date.now() - at.getTime()) / 1000);
  const line = JSON.stringify(Object.fromEntries(byStatus));

  if (line !== last) {
    console.log(`t${since >= 0 ? "+" : ""}${since}s ${line}`);
  }

  if ((done >= total && since >= 0) || since > patience) {
    return;
  }

  await Bun.sleep(1000);

  await watch(line);
};

await watch("");

const LatenessSchema = Schema.Tuple([
  Schema.Struct({
    max: Schema.NullOr(Schema.Number),
    p50: Schema.NullOr(Schema.Number),
    p95: Schema.NullOr(Schema.Number),
    published: Schema.Number,
  }),
]);

const [lateness] = Schema.decodeUnknownSync(LatenessSchema)(
  await sql`
    SELECT count(*)::int AS published,
      percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM t.finished_at - p.scheduled_at))::float AS p50,
      percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM t.finished_at - p.scheduled_at))::float AS p95,
      max(extract(epoch FROM t.finished_at - p.scheduled_at))::float AS max
    FROM publishing.post_targets t
    JOIN publishing.posts p ON p.id = t.post_id
    JOIN auth.organization o ON o.id = p.workspace_id
    WHERE p.scheduled_at = ${at} AND t.status = 'published'
      AND o.slug LIKE 'load-run-%'`
);

await sql.close();

const fake = await stats();

const seconds = (value: number | null) =>
  value === null ? "-" : `${value.toFixed(1)} s`;

console.log(`
Published ${lateness.published} of ${total}, finished after the minute:
  median ${seconds(lateness.p50)}, p95 ${seconds(lateness.p95)}, last ${seconds(lateness.max)}
The fake platform took ${fake.statuses} posts, ${fake.statusesPeakPerSecond} in its busiest second,
and ${fake.hooks} webhook deliveries so far.`);
