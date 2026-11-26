// Makes the run's database at the size of a server with many users: creates
// it when missing, migrates it, then fills it with the server's
// `seed-scale.ts` (10,000 users by default: 41,000 channels, 900,000
// posts). Run it once; a database that already holds posts is left as it
// is.
//
//   bun scripts/seed.ts [users]
import { Schema } from "effect";

import { databaseUrl, serverRoot } from "./run.ts";

const users = process.argv[2] ?? "10000";
const name = new URL(databaseUrl).pathname.slice(1);
const maintenance = new URL(databaseUrl);

maintenance.pathname = "/postgres";

const RowsSchema = Schema.Array(Schema.Unknown);
const PostsSchema = Schema.Tuple([Schema.Struct({ posts: Schema.Number })]);

const admin = new Bun.SQL(maintenance.toString());

const found = Schema.decodeUnknownSync(RowsSchema)(
  await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`
);

if (found.length === 0) {
  await admin.unsafe(`CREATE DATABASE "${name.replaceAll('"', '""')}"`);
  console.log(`Created ${name}`);
}

await admin.close();

const run = async (args: readonly string[]) => {
  const child = Bun.spawn(["bun", ...args], {
    cwd: serverRoot,
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: ["ignore", "inherit", "inherit"],
  });

  if ((await child.exited) !== 0) {
    throw new Error(`bun ${args.join(" ")} failed`);
  }
};

await run(["src/migrate.ts"]);

const sql = new Bun.SQL(databaseUrl);

const [{ posts }] = Schema.decodeUnknownSync(PostsSchema)(
  await sql`SELECT count(*)::int AS posts FROM publishing.posts`
);

await sql.close();

if (posts > 0) {
  console.log(`${name} holds ${posts} posts already: seeded before`);
} else {
  await run(["scripts/seed-scale.ts", users]);
}
