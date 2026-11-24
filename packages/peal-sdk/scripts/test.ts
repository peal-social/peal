// Runs one language's smoke test against a stand-in API:
// `bun scripts/test.ts <language>`, after its sdk:build. The stand-in answers
// the health check, and the signed-in user to the bearer token peal_test
// only. The test calls both through the SDK as its users would, and checks
// the answer; the run passes only when the stand-in saw both calls, each
// naming the version of the API the SDK was generated against, and none
// naming a workspace: the test's client is made without one, as a key's
// client is, so its optional `Peal-Workspace` must stay unsent.
import path from "node:path";

import { $ } from "bun";
import { Schema } from "effect";

import { runInContainer, sdkRoot } from "./container.ts";
import { languageNamed } from "./languages.ts";

const language = languageNamed(Bun.argv[2]);

/** The token every smoke test sends, and the only one the stand-in accepts. */
const token = "peal_test";

/** GET /api/me's answer, with the nulls and the enum the SDKs must decode. */
const me = {
  impersonatedBy: null,
  user: {
    email: "ada@example.test",
    emailVerified: true,
    id: "user-1",
    image: null,
    locale: "en",
    name: "Ada",
    twoStepEnabled: false,
  },
  workspaces: [
    {
      id: "workspace-1",
      name: "Studio",
      permissions: ["post:schedule", "media:upload"],
      role: "owner",
      slug: "studio",
      twoStepRequired: false,
    },
  ],
};

/**
 * The version of the API the SDKs were generated from: the day of the
 * latest release the contract's changelog records, as its document says.
 * The changelog is read rather than the SDKs' document, which only
 * `peal-sdk:spec` writes.
 */
const releases = Schema.decodeUnknownSync(
  Schema.fromJsonString(Schema.Array(Schema.Struct({ date: Schema.String })))
)(
  await Bun.file(
    path.join(sdkRoot, "..", "peal-contract", "src", "api-changelog.json")
  ).text()
);

const info = {
  version:
    releases
      .map(({ date }) => date)
      .toSorted()
      .at(-1) ?? "",
};

const seen = { health: false, me: false };

/** What each call the stand-in counted sent as its version. */
const versions: (string | null)[] = [];

/** What each call the stand-in counted sent as its workspace. */
const workspaces: (string | null)[] = [];

const server = Bun.serve({
  fetch: (request) => {
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/api/health") {
      seen.health = true;
      versions.push(request.headers.get("peal-version"));
      workspaces.push(request.headers.get("peal-workspace"));

      return new Response(null, { status: 204 });
    }

    if (request.method === "GET" && pathname === "/api/me") {
      if (request.headers.get("authorization") !== `Bearer ${token}`) {
        return Response.json({ _tag: "Unauthenticated" }, { status: 401 });
      }

      seen.me = true;
      versions.push(request.headers.get("peal-version"));
      workspaces.push(request.headers.get("peal-workspace"));

      return Response.json(me);
    }

    return new Response(null, { status: 404 });
  },
  // Containers reach this machine through host.docker.internal, which on
  // Linux is the Docker bridge's address rather than the loopback.
  hostname: process.platform === "linux" ? "0.0.0.0" : "127.0.0.1",
  port: 0,
});

try {
  const { build } = language;

  await (build.kind === "host"
    ? $`sh -c ${language.test}`.cwd(path.join(sdkRoot, language.name)).env({
        ...process.env,
        PEAL_API_URL: `http://127.0.0.1:${server.port}`,
      })
    : runInContainer({
        arguments: ["sh", "-c", language.test],
        environment: {
          ...build.environment,
          PEAL_API_URL: `http://host.docker.internal:${server.port}`,
        },
        image: build.image,
        workdir: `/sdk/${language.name}`,
      }));
} finally {
  await server.stop(true);
}

if (!seen.health || !seen.me) {
  throw new Error(
    `The ${language.name} SDK's smoke test passed without calling ${seen.health ? "" : "the health check "}${seen.me ? "" : "GET /api/me with its token"}.`
  );
}

if (versions.some((version) => version !== info.version)) {
  throw new Error(
    `The ${language.name} SDK must send Peal-Version: ${info.version} on every request; it sent ${JSON.stringify(versions)}.`
  );
}

if (workspaces.some((workspace) => workspace !== null)) {
  throw new Error(
    `The ${language.name} SDK's client, made without a workspace, must send no Peal-Workspace; it sent ${JSON.stringify(workspaces)}.`
  );
}
