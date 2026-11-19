// The blog's production build under its base, against the development
// stack, over HTTP: `bun nx run peal-blog:smoke` (Postgres and S3 needed,
// so not in `test`). It prepares a database and a bucket named for the
// run, builds with the base /blog, starts the server on a free port and
// checks:
//
// - EmDash's health check answers on a fresh database (start-up ran the
//   migrations and the seed);
// - /blog/ renders, its assets under /blog/_astro/, with the consent notice
//   while BLOG_POSTHOG_KEY and BLOG_POSTHOG_HOST are set, and without it
//   once the server restarts without them;
// - the admin, at /_emdash/admin, sends a fresh site to its setup;
// - /blog/_emdash/… and every path outside the base answer 404.
//
// It then stops the server and drops the database and the bucket.
import { once } from "node:events";
import { request as httpRequest } from "node:http";
import { createServer } from "node:net";
import path from "node:path";

import {
  DeleteBucketCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Schema } from "effect";

import { dropDatabase, setup } from "../../scripts/setup.ts";
import { developmentStack, serverEnvironment } from "../../scripts/stack.ts";
import type { StackSettings } from "../../scripts/stack.ts";
import { publishPostWithImage } from "./editor.ts";

const root = path.join(import.meta.dirname, "..", "..");

const freePort = async (): Promise<number> => {
  const server = createServer();

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = Schema.decodeUnknownSync(
    Schema.Struct({ port: Schema.Number })
  )(server.address(), { onExcessProperty: "ignore" });

  server.close();
  await once(server, "close");

  return port;
};

const dropBucket = async (settings: StackSettings): Promise<void> => {
  const client = new S3Client({
    credentials: {
      accessKeyId: settings.s3.accessKeyId,
      secretAccessKey: settings.s3.secretAccessKey,
    },
    endpoint: settings.s3.endpoint,
    forcePathStyle: true,
    region: settings.s3.region,
  });

  try {
    // The run's upload first: a bucket is deleted empty.
    const listed = await client.send(
      new ListObjectsV2Command({ Bucket: settings.s3.bucket })
    );

    await Promise.all(
      (listed.Contents ?? []).map(
        async ({ Key }) =>
          await client.send(
            new DeleteObjectCommand({ Bucket: settings.s3.bucket, Key })
          )
      )
    );
    await client.send(new DeleteBucketCommand({ Bucket: settings.s3.bucket }));
  } finally {
    client.destroy();
  }
};

const failures: string[] = [];

const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);

  if (!ok) {
    failures.push(what);
  }
};

const run = Date.now().toString(36);
const port = await freePort();
const origin = `http://localhost:${port}`;

const settings = developmentStack({
  ...process.env,
  BLOG_ORIGIN: origin,
  PGDATABASE: `peal_blog_smoke_${run}`,
  S3_BUCKET: `peal-blog-smoke-${run}`,
});

await setup(settings);

let server: ReturnType<typeof Bun.spawn> | undefined;

try {
  // No database or bucket setting at build, as in CI and the image.
  const build = Bun.spawn(["./node_modules/.bin/astro", "build"], {
    cwd: root,
    env: {
      ASTRO_TELEMETRY_DISABLED: "1",
      BLOG_SITE_URL: origin,
      HOME: process.env["HOME"] ?? "",
      PATH: process.env["PATH"] ?? "",
    },
    stderr: "inherit",
    stdout: "ignore",
  });

  if ((await build.exited) !== 0) {
    throw new Error("astro build failed");
  }

  const serve = (measurement: Readonly<Record<string, string>>) =>
    Bun.spawn(["node", "server/serve.ts"], {
      cwd: root,
      env: {
        ...serverEnvironment(settings),
        ...measurement,
        AWS_REQUEST_CHECKSUM_CALCULATION: "WHEN_REQUIRED",
        AWS_RESPONSE_CHECKSUM_VALIDATION: "WHEN_REQUIRED",
        EMDASH_SITE_URL: origin,
        HOST: "127.0.0.1",
        PATH: process.env["PATH"] ?? "",
        PORT: String(port),
      },
      stderr: "inherit",
      stdout: "ignore",
    });

  // Measured first: the notice and its settings on every public page.
  server = serve({
    BLOG_POSTHOG_ENVIRONMENT: "smoke",
    BLOG_POSTHOG_HOST: "/pulse/site",
    BLOG_POSTHOG_KEY: "phc_synthetic",
  });

  // fetch() resolves dot segments before it sends: node:http sends the
  // target as written.
  const sent = async (target: string) => {
    const request = httpRequest({
      headers: { accept: "text/html" },
      host: "127.0.0.1",
      path: target,
      port,
    });

    request.end();

    const [response] = Schema.decodeUnknownSync(
      Schema.Tuple([Schema.Struct({ statusCode: Schema.Number })])
    )(await once(request, "response"), { onExcessProperty: "ignore" });

    // The status is all it needs: the body is dropped with the socket.
    request.destroy();

    return { status: response.statusCode };
  };

  const get = async (pathname: string) =>
    await fetch(`${origin}${pathname}`, {
      headers: { accept: "text/html" },
      redirect: "manual",
    });

  // The first request runs EmDash's start-up: the migrations and the seed.
  // Up to a minute for the server to listen and answer.
  const healthy = async (attempts: number): Promise<Response | null> => {
    const response = await get("/_emdash/api/health").catch(() => null);

    if (response?.ok === true || attempts <= 1) {
      return response;
    }

    await Bun.sleep(500);

    return await healthy(attempts - 1);
  };

  const health = await healthy(120);

  check(
    health?.ok === true,
    "GET /_emdash/api/health answers 200 on a fresh database"
  );

  const index = await get("/blog/");
  const html = await index.text();

  check(index.status === 200, "GET /blog/ answers 200");
  check(
    html.includes('"/blog/_astro/'),
    "/blog/ loads its assets from /blog/_astro/"
  );
  check(
    html.includes("<header") || html.includes("site-header"),
    "/blog/ shows the site's header"
  );
  check(
    html.includes("<peal-consent") &&
      html.includes('data-key="phc_synthetic"') &&
      html.includes('data-source="blog"'),
    "/blog/ holds the consent notice with BLOG_POSTHOG_KEY and BLOG_POSTHOG_HOST set"
  );

  const french = await get("/blog/fr/");

  check(french.status === 200, "GET /blog/fr/ answers 200");

  const admin = await get("/_emdash/admin");

  check(
    admin.status === 302 &&
      (admin.headers.get("location") ?? "").endsWith("/_emdash/admin/setup"),
    "GET /_emdash/admin sends a fresh site to /_emdash/admin/setup"
  );

  const refused = [
    "/blog/_emdash/admin",
    "/blog/_emdash/api/health",
    "/BLOG/_EMDASH/api/health",
    "/blog/%5Femdash/api/health",
    "/",
    "/robots.txt",
    // Spellings a URL parser resolves to /_emdash: sent as written.
    "/blog/%2e%2e/_emdash/api/setup/status",
    "/blog/../_emdash/api/health",
    "/blog/..\\_emdash/api/health",
    "/blog/..%5c_emdash/api/health",
    "/blog/%252e%252e/_emdash/admin",
    "/_emdash/api/media/file/%2e%2e/%2e%2e/setup/status",
    // An image request Astro would not build, and the endpoint spelled
    // with a trailing slash.
    "/blog/_image?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2F01SYNTHETIC.png&w=640&q=1",
    "/blog/_image/?href=%2F_emdash%2Fapi%2Fmedia%2Ffile%2F01SYNTHETIC.png&w=640",
  ];

  const answers = await Promise.all(refused.map(sent));

  for (const [position, response] of answers.entries()) {
    check(
      response.status === 404,
      `GET ${refused[position] ?? ""} answers 404`
    );
  }

  // A post with an image, published as an editor would: the image URL its
  // page writes must answer, so an upgrade that changes those URLs fails.
  const slug = await publishPostWithImage(origin);
  const post = await get(`/blog/${slug}`);
  const markup = await post.text();

  const imageUrl = /src="(?<url>\/blog\/_image\?[^"]+)"/u
    .exec(markup)
    ?.groups?.["url"]?.replaceAll("&amp;", "&");

  check(post.status === 200, `GET /blog/${slug} answers 200`);
  check(imageUrl !== undefined, "the post's page writes a /blog/_image URL");

  if (imageUrl !== undefined) {
    const image = await get(imageUrl);

    check(
      image.status === 200 &&
        (image.headers.get("content-type") ?? "").startsWith("image/"),
      `GET ${imageUrl} answers 200 with an image`
    );
  }

  const missing = await get("/blog/no-such-post");

  check(missing.status === 404, "GET /blog/no-such-post answers 404");

  // Then without measurement's settings: no notice at all.
  server.kill();
  await server.exited;
  server = serve({});

  const again = await healthy(120);

  check(
    again?.ok === true,
    "the server answers again without measurement's settings"
  );

  const unmeasuredPage = await get("/blog/");
  const unmeasured = await unmeasuredPage.text();

  check(
    !unmeasured.includes("<peal-consent"),
    "/blog/ holds no consent notice without BLOG_POSTHOG_KEY and BLOG_POSTHOG_HOST"
  );
} finally {
  server?.kill();
  await server?.exited;
  await dropDatabase(settings);
  await dropBucket(settings);
}

if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed.`);
  process.exit(1);
}

console.log("Every check passed.");
