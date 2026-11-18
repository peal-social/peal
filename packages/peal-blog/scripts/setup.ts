// Prepares the development stack for the blog: the database EmDash keeps
// its content in, and the bucket its media goes to, with the CORS rule the
// admin's uploads need (it PUTs files straight to the bucket from the
// browser). Run from the repository root:
//
//   bun nx run peal-blog:setup
//
// It reads the variables the blog reads, with the development stack's
// values as defaults: PGHOST, PGPORT, PGUSER, PGPASSWORD and PGDATABASE
// (peal_blog), S3_ENDPOINT, S3_BUCKET (peal-blog), S3_ACCESS_KEY_ID and
// S3_SECRET_ACCESS_KEY, and BLOG_ORIGIN, the origin the admin runs at
// (http://localhost:4324). It refuses any host but 127.0.0.1 or localhost:
// production's database and bucket are made by Ansible and Pulumi.
//
// It creates what is missing and changes nothing on a second run. The CORS
// rule keeps the bucket's other rules.
import {
  CreateBucketCommand,
  GetBucketCorsCommand,
  HeadBucketCommand,
  PutBucketCorsCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import type { CORSRule } from "@aws-sdk/client-s3";
import { Client } from "pg";

import { withUploadRule, uploadRule } from "./cors.ts";
import { developmentStack, localOnly } from "./stack.ts";
import type { StackSettings } from "./stack.ts";

const quoted = (name: string) => `"${name.replaceAll('"', '""')}"`;

/** Creates the database when it is missing; answers whether it did. */
export const ensureDatabase = async (
  settings: StackSettings
): Promise<boolean> => {
  // Connect to the server's maintenance database: the blog's may not exist.
  const client = new Client({
    database: "postgres",
    host: settings.pg.host,
    password: settings.pg.password,
    port: settings.pg.port,
    user: settings.pg.user,
  });

  await client.connect();

  try {
    const found = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [settings.pg.database]
    );

    if (found.rowCount !== 0) {
      return false;
    }

    await client.query(`CREATE DATABASE ${quoted(settings.pg.database)}`);

    return true;
  } finally {
    await client.end();
  }
};

/** Drops the database, for a run's own one. */
export const dropDatabase = async (settings: StackSettings): Promise<void> => {
  const client = new Client({
    database: "postgres",
    host: settings.pg.host,
    password: settings.pg.password,
    port: settings.pg.port,
    user: settings.pg.user,
  });

  await client.connect();

  try {
    await client.query(
      `DROP DATABASE IF EXISTS ${quoted(settings.pg.database)} WITH (FORCE)`
    );
  } finally {
    await client.end();
  }
};

const s3Client = (settings: StackSettings) =>
  new S3Client({
    credentials: {
      accessKeyId: settings.s3.accessKeyId,
      secretAccessKey: settings.s3.secretAccessKey,
    },
    endpoint: settings.s3.endpoint,
    forcePathStyle: true,
    region: settings.s3.region,
  });

const missing = (cause: unknown, names: readonly string[]) =>
  cause instanceof S3ServiceException && names.includes(cause.name);

/** Creates the bucket when it is missing; answers whether it did. */
export const ensureBucket = async (
  settings: StackSettings
): Promise<boolean> => {
  const client = s3Client(settings);
  const Bucket = settings.s3.bucket;

  try {
    try {
      await client.send(new HeadBucketCommand({ Bucket }));

      return false;
    } catch (error) {
      if (!missing(error, ["NotFound", "NoSuchBucket"])) {
        throw error;
      }
    }

    await client.send(new CreateBucketCommand({ Bucket }));

    return true;
  } finally {
    client.destroy();
  }
};

/** Puts the upload rule on the bucket; answers whether it changed it. */
export const ensureCors = async (
  settings: StackSettings,
  origins: readonly string[]
): Promise<boolean> => {
  const client = s3Client(settings);
  const Bucket = settings.s3.bucket;

  try {
    let existing: readonly CORSRule[] = [];

    try {
      const found = await client.send(new GetBucketCorsCommand({ Bucket }));

      existing = found.CORSRules ?? [];
    } catch (error) {
      if (!missing(error, ["NoSuchCORSConfiguration"])) {
        throw error;
      }
    }

    const { changed, rules } = withUploadRule(existing, uploadRule(origins));

    if (changed) {
      await client.send(
        new PutBucketCorsCommand({
          Bucket,
          CORSConfiguration: { CORSRules: [...rules] },
        })
      );
    }

    return changed;
  } finally {
    client.destroy();
  }
};

/** Everything at once, refusing a host that is not this machine. */
export const setup = async (settings: StackSettings) => {
  localOnly(settings);

  const database = await ensureDatabase(settings);
  const bucket = await ensureBucket(settings);
  const cors = await ensureCors(settings, [settings.origin]);

  return { bucket, cors, database };
};

const report = (made: boolean, what: string) => {
  console.log(`${made ? "Made" : "Kept"} ${what}.`);
};

if (import.meta.main) {
  const settings = developmentStack(process.env);
  const done = await setup(settings);

  report(done.database, `the database ${settings.pg.database}`);
  report(done.bucket, `the bucket ${settings.s3.bucket}`);
  report(done.cors, `the upload rule for ${settings.origin}`);
}
