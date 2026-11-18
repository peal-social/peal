import { Schema } from "effect";

// The database and bucket the blog's scripts prepare, from the variables the
// blog reads, with the development stack's values as defaults
// (packages/peal-docker/compose.yaml).

const StackSettingsSchema = Schema.Struct({
  origin: Schema.String,
  pg: Schema.Struct({
    database: Schema.NonEmptyString,
    host: Schema.NonEmptyString,
    password: Schema.String,
    port: Schema.FiniteFromString,
    user: Schema.NonEmptyString,
  }),
  s3: Schema.Struct({
    accessKeyId: Schema.NonEmptyString,
    bucket: Schema.NonEmptyString,
    endpoint: Schema.NonEmptyString,
    region: Schema.NonEmptyString,
    secretAccessKey: Schema.NonEmptyString,
  }),
});

export type StackSettings = typeof StackSettingsSchema.Type;

type Environment = Readonly<Record<string, string | undefined>>;

/** The development stack's settings, each overridden by its variable. */
export const developmentStack = (env: Environment): StackSettings => {
  const value = (name: string, fallback: string) => {
    const set = env[name]?.trim();

    return set === undefined || set === "" ? fallback : set;
  };

  return Schema.decodeUnknownSync(StackSettingsSchema)({
    origin: new URL(value("BLOG_ORIGIN", "http://localhost:4324")).origin,
    pg: {
      database: value("PGDATABASE", "peal_blog"),
      host: value("PGHOST", "127.0.0.1"),
      password: value("PGPASSWORD", "peal"),
      port: value("PGPORT", "15432"),
      user: value("PGUSER", "peal"),
    },
    s3: {
      accessKeyId: value("S3_ACCESS_KEY_ID", "peal"),
      bucket: value("S3_BUCKET", "peal-blog"),
      endpoint: value("S3_ENDPOINT", "http://127.0.0.1:18333"),
      region: value("S3_REGION", "auto"),
      secretAccessKey: value("S3_SECRET_ACCESS_KEY", "peal-development-secret"),
    },
  });
};

const localHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Throws unless the database and the bucket are on this machine. */
export const localOnly = (settings: StackSettings): void => {
  const s3Host = new URL(settings.s3.endpoint).hostname;

  for (const host of [settings.pg.host, s3Host]) {
    if (!localHosts.has(host)) {
      throw new Error(
        `Refusing ${host}: the blog's scripts only prepare the development stack, on 127.0.0.1 or localhost.`
      );
    }
  }
};

/** The variables the blog's server reads for these settings. */
export const serverEnvironment = (settings: StackSettings) => ({
  PGDATABASE: settings.pg.database,
  PGHOST: settings.pg.host,
  PGPASSWORD: settings.pg.password,
  PGPORT: String(settings.pg.port),
  PGUSER: settings.pg.user,
  S3_ACCESS_KEY_ID: settings.s3.accessKeyId,
  S3_BUCKET: settings.s3.bucket,
  S3_ENDPOINT: settings.s3.endpoint,
  S3_REGION: settings.s3.region,
  S3_SECRET_ACCESS_KEY: settings.s3.secretAccessKey,
});
