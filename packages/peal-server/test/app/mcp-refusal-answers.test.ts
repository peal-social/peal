import { assert, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { forWorkspace } from "peal-contract";

import {
  apiKeyOf,
  origin,
  signedUpUnconfirmed,
  TestApp,
  unconfirmedEmails,
  workspaceOf,
} from "#test/workspace/integration/harness.ts";

import { authorize, mcpResource, registeredClient } from "./mcp-support.ts";
import type { JsonRpcRequest } from "./mcp-support.ts";

// What the MCP endpoint answers when it refuses a request before any tool
// runs: the status and headers the specification fixes, and a JSON-RPC
// error whose message says what happened and what to do, never the
// credential it was sent.

const RefusalSchema = Schema.Struct({
  error: Schema.Struct({ code: Schema.Number, message: Schema.String }),
  id: Schema.Null,
  jsonrpc: Schema.Literal("2.0"),
});

const decodeRefusal = Schema.decodeUnknownSync(
  Schema.fromJsonString(RefusalSchema)
);

interface Answer {
  readonly status: number;
  readonly headers: Headers;
  readonly text: string;
}

const resourceMetadata = `resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp"`;

const initialize: JsonRpcRequest = {
  id: 1,
  jsonrpc: "2.0",
  method: "initialize",
  params: {
    capabilities: {},
    clientInfo: { name: "peal-test", version: "1.0.0" },
    protocolVersion: "2025-11-25",
  },
};

const listTools: JsonRpcRequest = {
  id: 2,
  jsonrpc: "2.0",
  method: "tools/list",
};

// Made-up credentials, none the shape of a real one.
const madeUpKey = "peal_synthetic_key_that_opens_nothing";
const madeUpPartnerKey = "peal_partner_synthetic_key_that_opens_nothing";
const forgedToken = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.c2ln";

const send = (init: {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: JsonRpcRequest | readonly JsonRpcRequest[];
}) =>
  Effect.gen(function* sent() {
    const app = yield* TestApp;

    const answer = yield* Effect.promise(
      async () =>
        await app.handler(
          new Request(mcpResource, {
            body:
              init.body === undefined ? undefined : JSON.stringify(init.body),
            headers: {
              accept: "application/json, text/event-stream",
              "content-type": "application/json",
              ...init.headers,
            },
            method: init.method ?? "POST",
          })
        )
    );

    const text = yield* Effect.promise(async () => await answer.text());

    return { headers: answer.headers, status: answer.status, text };
  });

const bearer = (credential: string) => ({
  authorization: `Bearer ${credential}`,
});

// The message of a refusal, once its shape is checked.
const messageOf = (answer: Answer): string => {
  assert.include(answer.headers.get("content-type") ?? "", "application/json");

  return decodeRefusal(answer.text).error.message;
};

layer(
  TestApp.layerWith({ ...unconfirmedEmails, MCP_DYNAMIC_REGISTRATION: "true" }),
  { excludeTestServices: true, timeout: "180 seconds" }
)("the MCP endpoint's refusals", (it) => {
  it.effect(
    "refuses a request with an Origin header with a 403 that says why, whatever its credential",
    () =>
      Effect.gen(function* withOrigin() {
        const owner = yield* signedUpUnconfirmed("origin-owner");
        const workspace = yield* workspaceOf(owner, "Origin");
        const clientId = yield* registeredClient;

        const token = yield* authorize(
          owner,
          clientId,
          workspace,
          "workspace:read"
        );

        const { key } = yield* apiKeyOf(owner, workspace, ["post:read"]);

        const page = { origin: "https://page.example" };

        for (const credential of [
          bearer(token),
          bearer(key),
          bearer(madeUpKey),
          {},
        ]) {
          const answer = yield* send({
            body: initialize,
            headers: { ...credential, ...page },
          });

          assert.strictEqual(answer.status, 403);
          // Signing in would not help: no challenge.
          assert.isNull(answer.headers.get("www-authenticate"));
          assert.include(messageOf(answer), "Origin header");
          assert.include(messageOf(answer), "without an Origin header");
          assert.notInclude(answer.text, token);
          assert.notInclude(answer.text, key);
        }

        // A session's DELETE as well.
        const deleted = yield* send({
          headers: {
            ...bearer(token),
            ...page,
            "mcp-session-id": "synthetic-session",
          },
          method: "DELETE",
        });

        assert.strictEqual(deleted.status, 403);
        assert.include(messageOf(deleted), "Origin header");
      })
  );

  it.effect(
    "tells a request without a credential it needs one, with the challenge that leads to signing in",
    () =>
      Effect.gen(function* missing() {
        const answer = yield* send({ body: initialize });

        assert.strictEqual(answer.status, 401);

        const challenge = answer.headers.get("www-authenticate") ?? "";

        assert.include(challenge, resourceMetadata);
        // RFC 6750 §3.1: no error code without a credential.
        assert.notInclude(challenge, "error=");
        assert.include(messageOf(answer), "needs a credential");
      })
  );

  it.effect(
    "tells a credential that does not work it was refused, never that none was sent, and never repeats it",
    () =>
      Effect.gen(function* refused() {
        const missing = messageOf(yield* send({ body: initialize }));

        for (const credential of [madeUpKey, madeUpPartnerKey, forgedToken]) {
          const answer = yield* send({
            body: initialize,
            headers: bearer(credential),
          });

          assert.strictEqual(answer.status, 401);

          const challenge = answer.headers.get("www-authenticate") ?? "";

          assert.include(challenge, 'error="invalid_token"');
          assert.include(challenge, resourceMetadata);
          assert.notInclude(challenge, credential);

          const message = messageOf(answer);

          assert.include(message, "was refused");
          assert.notStrictEqual(message, missing);
          assert.notInclude(answer.text, credential);
        }

        // A partner key that does not work is refused before the header
        // naming its workspace is asked for.
        const partner = yield* send({
          body: initialize,
          headers: bearer(madeUpPartnerKey),
        });

        assert.notInclude(messageOf(partner), "Peal-Workspace");
      })
  );

  it.effect(
    "answers a scheme it does not take as a missing credential, with the challenge that leads to signing in",
    () =>
      Effect.gen(function* scheme() {
        // A scheme it does not know, and a Bearer without a credential.
        for (const authorization of [
          "Basic c3ludGhldGljOnN5bnRoZXRpYw==",
          "Bearer ",
        ]) {
          const answer = yield* send({
            body: initialize,
            headers: { authorization },
          });

          assert.strictEqual(answer.status, 401);

          const challenge = answer.headers.get("www-authenticate") ?? "";

          assert.isTrue(challenge.startsWith("Bearer "));
          assert.include(challenge, resourceMetadata);
          assert.notInclude(challenge, "error=");
          assert.include(messageOf(answer), "Bearer");
        }
      })
  );

  it.effect(
    "asks a token without a workspace scope for one, and a token whose workspace closed to its user to connect again",
    () =>
      Effect.gen(function* standing() {
        const app = yield* TestApp;
        const owner = yield* signedUpUnconfirmed("standing-owner");
        const workspace = yield* workspaceOf(owner, "Standing");
        const clientId = yield* registeredClient;

        const scopeless = yield* authorize(
          owner,
          clientId,
          workspace,
          "openid"
        );

        const stepUp = yield* send({
          body: initialize,
          headers: bearer(scopeless),
        });

        assert.strictEqual(stepUp.status, 403);
        assert.include(
          stepUp.headers.get("www-authenticate") ?? "",
          'error="insufficient_scope"'
        );
        assert.include(messageOf(stepUp), "workspace:read");
        assert.notInclude(stepUp.text, scopeless);

        const token = yield* authorize(
          owner,
          clientId,
          workspace,
          "workspace:read"
        );

        const deleted = yield* app.request(`/api/v1/workspace`, {
          body: { name: "Standing" },
          headers: { cookie: owner.cookies, ...forWorkspace(workspace) },
          method: "DELETE",
        });

        assert.strictEqual(deleted.status, 204);

        const closed = yield* send({
          body: initialize,
          headers: bearer(token),
        });

        assert.strictEqual(closed.status, 403);
        assert.isNull(closed.headers.get("www-authenticate"));
        assert.include(messageOf(closed), "connect again");
      })
  );

  it.effect(
    "answers another credential's session as an ended one, alike, saying how to open one",
    () =>
      Effect.gen(function* sessions() {
        const owner = yield* signedUpUnconfirmed("session-owner");
        const workspace = yield* workspaceOf(owner, "Sessions");
        const clientId = yield* registeredClient;

        const token = yield* authorize(
          owner,
          clientId,
          workspace,
          "workspace:read"
        );

        const { key } = yield* apiKeyOf(owner, workspace, ["post:read"]);

        const opened = yield* send({
          body: initialize,
          headers: bearer(token),
        });

        const session = opened.headers.get("mcp-session-id") ?? "";

        assert.notStrictEqual(session, "");

        const inSession = (credential: string, id: string) =>
          send({
            body: listTools,
            headers: {
              ...bearer(credential),
              "mcp-protocol-version": "2025-11-25",
              "mcp-session-id": id,
            },
          });

        const theirs = yield* inSession(key, session);
        const ended = yield* inSession(token, "synthetic-session-that-ended");

        assert.strictEqual(theirs.status, 404);
        assert.strictEqual(ended.status, 404);
        assert.strictEqual(theirs.text, ended.text);
        assert.include(messageOf(theirs), "initialize");
        assert.notInclude(theirs.text, session);

        const endedDelete = yield* send({
          headers: {
            ...bearer(token),
            "mcp-protocol-version": "2025-11-25",
            "mcp-session-id": "synthetic-session-that-ended",
          },
          method: "DELETE",
        });

        assert.strictEqual(endedDelete.status, 404);
        assert.strictEqual(endedDelete.text, ended.text);

        // A request of the stateless revision that carries a session id
        // is told the same, in words that hold for it too.
        const stateless = yield* send({
          body: {
            ...listTools,
            params: {
              _meta: {
                "io.modelcontextprotocol/clientCapabilities": {},
                "io.modelcontextprotocol/protocolVersion": "2026-07-28",
              },
            },
          },
          headers: {
            ...bearer(token),
            "mcp-method": "tools/list",
            "mcp-protocol-version": "2026-07-28",
            "mcp-session-id": "synthetic-session-that-ended",
          },
        });

        assert.strictEqual(stateless.status, 404);
        assert.strictEqual(stateless.text, ended.text);
        assert.include(messageOf(stateless), "2026-07-28");
        assert.include(
          messageOf(stateless),
          "without the Mcp-Session-Id header"
        );
      })
  );

  it.effect(
    "tells a DELETE what it lacks: the session's id, or the protocol version the session speaks",
    () =>
      Effect.gen(function* deletes() {
        const owner = yield* signedUpUnconfirmed("delete-owner");
        const workspace = yield* workspaceOf(owner, "Deletes");
        const { key } = yield* apiKeyOf(owner, workspace, ["post:read"]);

        const sessionless = yield* send({
          headers: bearer(key),
          method: "DELETE",
        });

        assert.strictEqual(sessionless.status, 400);
        assert.include(
          messageOf(sessionless),
          "send the session's Mcp-Session-Id header"
        );

        const opened = yield* send({ body: initialize, headers: bearer(key) });
        const session = opened.headers.get("mcp-session-id") ?? "";

        assert.notStrictEqual(session, "");

        const misversioned = yield* send({
          headers: {
            ...bearer(key),
            "mcp-protocol-version": "2024-01-01",
            "mcp-session-id": session,
          },
          method: "DELETE",
        });

        assert.strictEqual(misversioned.status, 400);
        assert.include(messageOf(misversioned), "MCP-Protocol-Version");
        assert.notInclude(
          messageOf(misversioned),
          "send the session's Mcp-Session-Id"
        );
        assert.notInclude(misversioned.text, session);

        // Refused, the session stays, and its own version ends it.
        const ended = yield* send({
          headers: {
            ...bearer(key),
            "mcp-protocol-version": "2025-11-25",
            "mcp-session-id": session,
          },
          method: "DELETE",
        });

        assert.strictEqual(ended.status, 204);
      })
  );

  it.effect(
    "says what a request the transport does not take lacks: its method, its media types, one message at a time",
    () =>
      Effect.gen(function* transport() {
        const owner = yield* signedUpUnconfirmed("transport-owner");
        const workspace = yield* workspaceOf(owner, "Transport");
        const { key } = yield* apiKeyOf(owner, workspace, ["post:read"]);

        const got = yield* send({ headers: bearer(key), method: "GET" });

        assert.strictEqual(got.status, 405);
        assert.strictEqual(got.headers.get("allow"), "POST, DELETE");
        assert.include(messageOf(got), "POST");

        const plain = yield* send({
          body: initialize,
          headers: { ...bearer(key), "content-type": "text/plain" },
        });

        assert.strictEqual(plain.status, 415);
        assert.include(messageOf(plain), "application/json");

        const narrow = yield* send({
          body: initialize,
          headers: { ...bearer(key), accept: "application/json" },
        });

        assert.strictEqual(narrow.status, 406);
        assert.include(messageOf(narrow), "text/event-stream");

        const batch = yield* send({
          body: [initialize],
          headers: bearer(key),
        });

        assert.strictEqual(batch.status, 400);
        assert.include(messageOf(batch), "one JSON-RPC message");
        assert.notInclude(got.text + plain.text + batch.text, key);
      })
  );
});
