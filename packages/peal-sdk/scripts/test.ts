// Runs one language's smoke test against a stand-in API:
// `bun scripts/test.ts <language>`, after its sdk:build. The stand-in answers
// the health check, and the credential check to the bearer token peal_test
// only. The test calls both through the SDK as its users would, and checks
// the answer; the run passes only when the stand-in saw both calls, each
// naming the version of the API the SDK was generated against, and none
// naming a workspace: the test's client is made without one, as a key's
// client is, so its optional `Peal-Workspace` must stay unsent. A language
// that `testsUnions` also lists the channels and creates a signature, and
// must send the signature's scope with its `_tag`.
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { $ } from "bun";
import { Schema } from "effect";

import { runInContainer, sdkRoot } from "./container.ts";
import { languageNamed } from "./languages.ts";

const language = languageNamed(Bun.argv[2]);

/** The token every smoke test sends, and the only one the stand-in accepts. */
const token = "peal_test";

/**
 * GET /api/v1/credential's answer for a workspace's API key, with the nulls
 * and the enum the SDKs must decode, in a tagged union.
 */
const credential = {
  _tag: "apiKey",
  expiresAt: null,
  id: "key-1",
  name: "Studio's scheduler",
  permissions: ["post:schedule", "media:upload"],
  start: null,
  workspace: { id: "workspace-1", name: "Studio" },
};

/** A channel of GET /api/v1/channels, with its status: a tagged union. */
const channel = (id: string, status: Schema.JsonObject) => ({
  avatarUrl: null,
  connection: null,
  displayName: null,
  handle: `@${id}`,
  id,
  label: null,
  platform: "bluesky",
  status,
  tokenExpiresAt: null,
});

/**
 * The channels, whose statuses are a union's members in a list: two with
 * no field beside their tag, one of two words, and one with a field.
 */
const channels = [
  channel("channel-1", { _tag: "active" }),
  channel("channel-2", { _tag: "refreshNeeded" }),
  channel("channel-3", { _tag: "disabled", refreshNeeded: true }),
];

/** The scope the smoke test gives its new signature, as the API reads it. */
const signatureScope = { _tag: "channel", channelId: "channel-1" };

const SignatureRequestSchema = Schema.Struct({
  name: Schema.String,
  scope: Schema.optional(Schema.Json),
  text: Schema.String,
});

const decodeSignatureRequest = Schema.decodeUnknownSync(
  Schema.fromJsonString(SignatureRequestSchema)
);

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

const seen = {
  channels: false,
  credential: false,
  health: false,
  signature: false,
};

/** What each call the stand-in counted sent as its version. */
const versions: (string | null)[] = [];

/** What each call the stand-in counted sent as its workspace. */
const workspaces: (string | null)[] = [];

/** The scope each signature the smoke test created was sent with. */
const sentScopes: Schema.Json[] = [];

/** Counts the call, with the version and the workspace it named. */
const count = (request: Request, call: keyof typeof seen): void => {
  seen[call] = true;
  versions.push(request.headers.get("peal-version"));
  workspaces.push(request.headers.get("peal-workspace"));
};

const authorized = (request: Request): boolean =>
  request.headers.get("authorization") === `Bearer ${token}`;

const unauthenticated = (): Response =>
  Response.json({ _tag: "Unauthenticated" }, { status: 401 });

const server = Bun.serve({
  fetch: async (request) => {
    const { pathname } = new URL(request.url);

    if (request.method === "GET" && pathname === "/api/health") {
      count(request, "health");

      return new Response(null, { status: 204 });
    }

    if (request.method === "GET" && pathname === "/api/v1/credential") {
      if (!authorized(request)) {
        return unauthenticated();
      }

      count(request, "credential");

      return Response.json(credential);
    }

    if (request.method === "GET" && pathname === "/api/v1/channels") {
      if (!authorized(request)) {
        return unauthenticated();
      }

      count(request, "channels");

      return Response.json(channels);
    }

    if (request.method === "POST" && pathname === "/api/v1/posts/signatures") {
      if (!authorized(request)) {
        return unauthenticated();
      }

      count(request, "signature");

      const {
        name,
        scope = null,
        text,
      } = decodeSignatureRequest(await request.text());

      sentScopes.push(scope);

      // The answer holds the scope as the API would, whatever was sent:
      // the SDK's decoding is checked apart from its encoding.
      return Response.json(
        {
          createdAt: "2026-11-24T09:00:00.000Z",
          id: "signature-1",
          isDefault: false,
          name,
          scope: signatureScope,
          text,
        },
        { status: 201 }
      );
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

if (!seen.health || !seen.credential) {
  throw new Error(
    `The ${language.name} SDK's smoke test passed without calling ${seen.health ? "" : "the health check "}${seen.credential ? "" : "GET /api/v1/credential with its token"}.`
  );
}

if (language.testsUnions === true) {
  if (!seen.channels || !seen.signature) {
    throw new Error(
      `The ${language.name} SDK's smoke test passed without calling ${seen.channels ? "" : "GET /api/v1/channels "}${seen.signature ? "" : "POST /api/v1/posts/signatures"}.`
    );
  }

  const wrongScope = sentScopes.find(
    (scope) => !isDeepStrictEqual(scope, signatureScope)
  );

  if (wrongScope !== undefined) {
    throw new Error(
      `The ${language.name} SDK must send a tagged union with its _tag: it sent the scope ${JSON.stringify(wrongScope)}, where the API reads ${JSON.stringify(signatureScope)}.`
    );
  }
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
