// Makes the run's synthetic account and its workspaces on a server that
// `serve.ts` started, each workspace with an API key, Mastodon channels on
// the fake platform and a webhook endpoint to it, and writes them to
// `.local/config.json` for k6. Keys are spread over many workspaces as
// real traffic is: one key alone would make its rate-limit counter one hot
// row. Each run makes new workspaces beside the earlier ones.
//
//   bun scripts/setup.ts [workspaces] [channels a workspace]
import { Schema } from "effect";

import {
  configPath,
  databaseUrl,
  firstPort,
  RunConfigSchema,
  tokenKeys,
} from "./run.ts";
import type { RunConfig } from "./run.ts";

const base = `http://127.0.0.1:${firstPort}`;

// PUBLIC_URL's origin outside production, which cookie writes must name.
const origin = "http://localhost:3001";
const workspaceCount = Number(process.argv[2] ?? "40");
const channelCount = Number(process.argv[3] ?? "10");
const sql = new Bun.SQL(databaseUrl);

const email = "load-synthetic@example.test";
const password = "synthetic-load-password-1";

const IdSchema = Schema.Struct({ id: Schema.String });
const KeySchema = Schema.Struct({ key: Schema.String });

interface Sent {
  readonly body: unknown;
  readonly cookie?: string;
  readonly headers?: Record<string, string>;
}

// A POST to the server, answered with its response and its text.
const send = async (route: string, sent: Sent) => {
  const headers = new Headers({
    "content-type": "application/json",
    origin,
    ...sent.headers,
  });

  if (sent.cookie !== undefined) {
    headers.set("cookie", sent.cookie);
  }

  const response = await fetch(`${base}${route}`, {
    body: JSON.stringify(sent.body),
    headers,
    method: "POST",
  });

  return { response, text: await response.text() };
};

// The same, refusing any answer but a success, decoded with `schema`.
const call = async <A>(
  route: string,
  sent: Sent,
  schema: Schema.Codec<A, unknown>
): Promise<A> => {
  const { response, text } = await send(route, sent);

  if (!response.ok) {
    throw new Error(`${route} answered ${response.status}: ${text}`);
  }

  return Schema.decodeUnknownSync(Schema.fromJsonString(schema))(text);
};

// The account, made once (a second run is told it exists); its address is
// confirmed in the database, as no one reads the run's mail.
await send("/api/auth/sign-up/email", {
  body: { email, name: "Load run", password },
});

await sql`UPDATE auth."user" SET email_verified = true WHERE email = ${email}`;

const signedIn = await send("/api/auth/sign-in/email", {
  body: { email, password },
});

const cookie = signedIn.response.headers
  .getSetCookie()
  .map((header) => header.split(";")[0] ?? "")
  .filter((pair) => !pair.endsWith("="))
  .join("; ");

// Channels' tokens sealed as the server seals them (`TokenCipher`):
// AES-256-GCM under the keyring's first key, the channel's id as
// additional data, `<keyId>.<iv>.<ciphertext>` in base64url.
const keyring = await tokenKeys();
const [keyId = "", keyBase64 = ""] = keyring.split(":");

const sealingKey = await crypto.subtle.importKey(
  "raw",
  Buffer.from(keyBase64, "base64"),
  "AES-GCM",
  false,
  ["encrypt"]
);

const sealed = async (token: string, channelId: string) => {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    {
      additionalData: new TextEncoder().encode(channelId),
      iv,
      name: "AES-GCM",
    },
    sealingKey,
    new TextEncoder().encode(token)
  );

  return `${keyId}.${Buffer.from(iv).toString("base64url")}.${Buffer.from(ciphertext).toString("base64url")}`;
};

const permissions = [
  "activity:read",
  "analytics:read",
  "channel:read",
  "media:read",
  "post:create",
  "post:delete",
  "post:publish",
  "post:read",
  "post:schedule",
  "post:update",
  "webhook:manage",
  "webhook:read",
];

const stamp = Date.now();

// A channel on the fake platform, straight in the database: connecting one
// signs in on a real Mastodon server.
const channelIn = async (workspaceId: string, account: string) => {
  const id = Bun.randomUUIDv7();
  const token = await sealed(`synthetic-token-${account}`, id);

  await sql`INSERT INTO channels.channels (
      id, workspace_id, platform, account_id, handle, scopes, status,
      refresh_needed, token_kind, token_key_id, access_token, created_at,
      updated_at
    ) VALUES (
      ${id}::uuid, ${workspaceId}, 'mastodon', ${`${account}@127.0.0.1`},
      ${`@${account}@127.0.0.1`}, ARRAY['read', 'write'], 'active', false,
      'nonExpiring', ${keyId}, ${token}, now(), now()
    )`;

  return id;
};

const workspaceAt = async (index: number) => {
  const workspace = await call(
    "/api/auth/organization/create",
    {
      body: { name: `Load run ${index}`, slug: `load-run-${stamp}-${index}` },
      cookie,
    },
    IdSchema
  );

  const { key } = await call(
    "/api/v1/workspace/api-keys",
    {
      body: { name: "k6", permissions },
      cookie,
      headers: { "peal-workspace": workspace.id },
    },
    KeySchema
  );

  const channelIds = await Promise.all(
    Array.from(
      { length: channelCount },
      async (_, slot) =>
        await channelIn(workspace.id, `load${stamp}x${index}x${slot}`)
    )
  );

  await call(
    "/api/v1/webhooks",
    {
      body: {
        eventTypes: ["post.published", "post.failed"],
        url: "https://127.0.0.1/hooks",
      },
      headers: { authorization: `Bearer ${key}` },
    },
    Schema.Unknown
  );

  return { apiKey: key, channelIds, workspaceId: workspace.id };
};

const workspaces = await Promise.all(
  Array.from(
    { length: workspaceCount },
    async (_, index) => await workspaceAt(index)
  )
);

const config: RunConfig = { base, workspaces };

await Bun.write(
  configPath,
  JSON.stringify(Schema.encodeSync(RunConfigSchema)(config), null, 2)
);

await sql.close();

console.log(
  `${workspaces.length} workspaces of ${channelCount} channels in .local/config.json`
);
