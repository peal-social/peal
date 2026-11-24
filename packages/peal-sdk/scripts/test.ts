// Runs one language's smoke test against a stand-in API:
// `bun scripts/test.ts <language>`, after its sdk:build. The stand-in answers
// the health check, and the credential check to the bearer token peal_test
// only. The test calls both through the SDK as its users would, and checks
// the answer; the run passes only when the stand-in saw both calls, each
// naming the version of the API the SDK was generated against, and none
// naming a workspace: the test's client is made without one, as a key's
// client is, so its optional `Peal-Workspace` must stay unsent. A language
// that `testsUnions` also lists the channels, creates a signature, connects
// a chat and redelivers webhooks, and must send each body as the API reads
// it (`unionRequests`): unions with their tag and their fields' API names.
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

/**
 * The requests a language that `testsUnions` sends with a union in their
 * body, each with the body the API reads and the answer it gets: a
 * signature whose scope is a member given as its own type, and two whole
 * bodies that are unions, one discriminated by `platform` (a chat), one
 * not (a redelivery), whose fields must keep their API names.
 */
const unionRequests = {
  chat: {
    answer: channel("channel-4", { _tag: "active" }),
    body: {
      botToken: "synthetic-telegram-bot-token",
      chat: "@studio",
      platform: "telegram",
    },
    path: "/api/v1/channels/chats",
    status: 200,
  },
  redelivery: {
    answer: { redelivered: [], remaining: 0, skipped: [] },
    body: { deliveryIds: ["delivery-1"] },
    path: "/api/v1/webhooks/deliveries/redeliver",
    status: 202,
  },
  signature: {
    // The answer holds the scope as the API would, whatever was sent: the
    // SDK's decoding is checked apart from its encoding.
    answer: {
      createdAt: "2026-11-24T09:00:00.000Z",
      id: "signature-1",
      isDefault: false,
      name: "Studio",
      scope: signatureScope,
      text: "Sent with Peal",
    },
    body: { name: "Studio", scope: signatureScope, text: "Sent with Peal" },
    path: "/api/v1/posts/signatures",
    status: 201,
  },
} as const;

type UnionRequest = keyof typeof unionRequests;

const unionRequestNames = Object.keys(unionRequests).filter(
  (name): name is UnionRequest => name in unionRequests
);

const decodeBody = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Json));

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
  chat: false,
  credential: false,
  health: false,
  redelivery: false,
  signature: false,
};

/** What each call the stand-in counted sent as its version. */
const versions: (string | null)[] = [];

/** What each call the stand-in counted sent as its workspace. */
const workspaces: (string | null)[] = [];

/** The bodies each request with a union was sent with. */
const sentBodies: { name: UnionRequest; body: Schema.Json }[] = [];

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

    const unionRequest = unionRequestNames.find(
      (name) => unionRequests[name].path === pathname
    );

    if (request.method === "POST" && unionRequest !== undefined) {
      if (!authorized(request)) {
        return unauthenticated();
      }

      count(request, unionRequest);
      sentBodies.push({
        body: decodeBody(await request.text()),
        name: unionRequest,
      });

      const { answer, status } = unionRequests[unionRequest];

      return Response.json(answer, { status });
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
  const missing = [
    ...(seen.channels ? [] : ["GET /api/v1/channels"]),
    ...unionRequestNames
      .filter((name) => !seen[name])
      .map((name) => `POST ${unionRequests[name].path}`),
  ];

  if (missing.length > 0) {
    throw new Error(
      `The ${language.name} SDK's smoke test passed without calling ${missing.join(", ")}.`
    );
  }

  const wrong = sentBodies.find(
    ({ body, name }) => !isDeepStrictEqual(body, unionRequests[name].body)
  );

  if (wrong !== undefined) {
    throw new Error(
      `The ${language.name} SDK must send a union as the API reads it, with its tag and its fields' API names: it sent ${JSON.stringify(wrong.body)} to ${unionRequests[wrong.name].path}, where the API reads ${JSON.stringify(unionRequests[wrong.name].body)}.`
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
