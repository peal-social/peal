import { assert, describe, it } from "@effect/vitest";
import { Effect, Ref, Schema } from "effect";

import { draftingKey, filesLayer, partnerKey, signedIn } from "./signed-in.ts";
import {
  customerId,
  mastodonId,
  refusedRequestId,
  scheduledId,
  shopId,
  studioId,
} from "./studio.ts";
import { output } from "./support.ts";

// A run nobody attends: PEAL_API_KEY in the environment, and no sign-in.

// The key goes only to a server the run names.
const key = {
  PEAL_API_KEY: draftingKey.key,
  PEAL_API_URL: "http://localhost:3000",
};

const inStudio = ["--workspace", studioId];

const headless = (signIn = false) =>
  signedIn({ keys: [draftingKey], signIn }).pipe(
    Effect.map((session) => ({ ...session, ...session.withEnv(key) }))
  );

const everythingPrinted = output.pipe(
  Effect.map(({ errors, logs }) => [...errors, ...logs].join("\n"))
);

const FailureSchema = Schema.fromJsonString(
  Schema.Struct({
    error: Schema.Struct({
      code: Schema.String,
      message: Schema.String,
      permission: Schema.optionalKey(Schema.String),
      reason: Schema.optionalKey(Schema.String),
      requestId: Schema.optionalKey(Schema.String),
    }),
  })
);

const failureOf = Schema.decodeUnknownSync(FailureSchema);

describe("an API key in PEAL_API_KEY", () => {
  it.effect("drafts and lists, in the workspace its id names", () =>
    Effect.gen(function* drafts() {
      const session = yield* headless();

      const saved = yield* session.printed([
        "drafts",
        "save",
        "--text",
        "A synthetic draft from a script.",
        "--channel",
        mastodonId,
        ...inStudio,
      ]);

      assert.include(saved, "Saved draft");

      const { changes } = yield* Ref.get(session.studio.state);

      assert.isAbove(changes.length, 0);
      assert.include(
        yield* session.printed(["drafts", "list", ...inStudio]),
        "A synthetic draft from a script."
      );
      assert.include(
        yield* session.printed(["channels", "list", "--json", ...inStudio]),
        mastodonId
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect(
    "is refused what it lacks in the server's words, with the request's id",
    () =>
      Effect.gen(function* lacks() {
        const session = yield* headless();
        const schedule = ["posts", "unschedule", scheduledId, ...inStudio];
        const refusal = yield* session.refused(schedule);

        assert.include(
          refusal,
          "Peal refused: This API key does not have the permission post:schedule. An owner or an admin of the workspace gives it to the key, or creates a key that has it."
        );
        assert.include(refusal, `Request ${refusedRequestId} (forbidden).`);

        // With --json, the error as the server sent it.
        assert.deepStrictEqual(
          failureOf(yield* session.refused([...schedule, "--json"])).error,
          {
            code: "forbidden",
            message:
              "This API key does not have the permission post:schedule. An owner or an admin of the workspace gives it to the key, or creates a key that has it.",
            permission: "post:schedule",
            reason: "missingPermission",
            requestId: refusedRequestId,
          }
        );
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("is never printed", () =>
    Effect.gen(function* secret() {
      const session = yield* headless();

      yield* session.printed(["drafts", "list", ...inStudio]);
      yield* session.printed(["doctor", "--json", ...inStudio]);
      yield* session.printed(["doctor", ...inStudio]);
      yield* session.printed(["whoami"]);
      yield* session.printed(["whoami", "--json"]);
      yield* session.refused(["posts", "unschedule", scheduledId, ...inStudio]);
      yield* session.refused(["drafts", "list", "--workspace", shopId]);
      yield* session.printed(["drafts", "list", "--json"]);
      yield* session
        .withEnv({ PEAL_API_KEY: "peal_test_unknown_key" })
        .refused(["drafts", "list", ...inStudio]);

      const printed = yield* everythingPrinted;

      assert.notInclude(printed, draftingKey.key);
      assert.notInclude(printed, "peal_test_unknown_key");
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("acts in its own workspace when none is named", () =>
    Effect.gen(function* own() {
      const session = yield* headless();

      // The workspace's name, as the credential check gives it.
      assert.include(
        yield* session.printed(["drafts", "list"]),
        "Drafts of Studio"
      );
      assert.include(
        yield* session.printed(["channels", "list", "--json"]),
        mastodonId
      );

      const saved = yield* session.printed([
        "drafts",
        "save",
        "--text",
        "A synthetic draft with the key alone.",
        "--channel",
        mastodonId,
      ]);

      assert.include(saved, "Saved draft");
      assert.include(saved, "in Studio");

      // A blank PEAL_WORKSPACE, as an unset variable in a script gives,
      // names nothing.
      for (const blank of ["", "  "]) {
        assert.include(
          yield* session
            .withEnv({ ...key, PEAL_WORKSPACE: blank })
            .printed(["drafts", "list"]),
          "Drafts of Studio"
        );
      }
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("names a workspace by id, never by slug", () =>
    Effect.gen(function* byId() {
      const session = yield* headless();

      assert.include(
        yield* session
          .withEnv({ ...key, PEAL_WORKSPACE: studioId })
          .printed(["drafts", "list"]),
        "Drafts of"
      );
      assert.include(
        yield* session.printed(["drafts", "list", ...inStudio]),
        "Drafts of"
      );

      const bySlug = yield* session.refused([
        "drafts",
        "list",
        "--workspace",
        "studio",
      ]);

      assert.include(bySlug, "take the workspace's id, not its slug (studio)");
      assert.include(bySlug, "Leave it out");
      assert.strictEqual(
        failureOf(
          yield* session.refused([
            "drafts",
            "list",
            "--json",
            "--workspace",
            "studio",
          ])
        ).error.code,
        "workspace_id_required"
      );

      // Another workspace's id is the server's to refuse.
      assert.include(
        yield* session.refused(["drafts", "list", "--workspace", shopId]),
        "This key or token belongs to another workspace"
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect(
    "is a partner key, which names one of its partner's workspaces",
    () =>
      Effect.gen(function* partner() {
        const session = yield* signedIn({
          keys: [partnerKey],
          signIn: false,
        }).pipe(
          Effect.map((signed) =>
            signed.withEnv({ ...key, PEAL_API_KEY: partnerKey.key })
          )
        );

        const missing = yield* session.refused(["channels", "list"]);

        assert.include(
          missing,
          "A partner key belongs to no workspace: name one of its partner's workspaces by its id, with --workspace or PEAL_WORKSPACE."
        );
        assert.strictEqual(
          failureOf(yield* session.refused(["channels", "list", "--json"]))
            .error.code,
          "workspace_id_required"
        );
        assert.strictEqual(
          failureOf(
            yield* session.refused([
              "channels",
              "list",
              "--json",
              "--workspace",
              studioId,
            ])
          ).error.code,
          "workspace_not_found"
        );
        yield* session.printed(["channels", "list", "--workspace", customerId]);
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect(
    "says which key it is, its workspace and its permissions, through the credential check",
    () =>
      Effect.gen(function* whoami() {
        const session = yield* headless();
        const prose = yield* session.printed(["whoami"]);

        assert.include(
          prose,
          `The API key in PEAL_API_KEY is "Synthetic script" (${draftingKey.key.slice(0, 10)}…), of the workspace Studio (${studioId})`
        );
        assert.include(
          prose,
          "Permissions: channel:read, post:read, post:create, post:update."
        );
        assert.include(prose, "It never expires.");

        const json = yield* session.printed(["whoami", "--json"]);

        assert.include(json, '"_tag": "apiKey"');
        assert.notInclude(`${prose}${json}`, draftingKey.key);
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("cannot do what only a person does, and asks no server", () =>
    Effect.gen(function* person() {
      const session = yield* headless();

      for (const args of [
        ["login"],
        ["account", "apps"],
        ["account", "export"],
        ["members", "list", ...inStudio],
        ["invitations", "list", ...inStudio],
        ["invitations", "send", "guest@example.test", ...inStudio],
        ["invitations", "revoke", "0190f3a0-0000-7000-8000-00000000a001"],
      ]) {
        const refusal = yield* session.refused(args);

        assert.include(refusal, "An API key cannot ");
        assert.include(refusal, "PEAL_API_KEY is set");
      }

      const { changes } = yield* Ref.get(session.studio.state);

      assert.deepStrictEqual(changes, []);
      assert.strictEqual(
        failureOf(yield* session.refused(["account", "apps", "--json"])).error
          .code,
        "person_required"
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("wins over a saved sign-in, which doctor says", () =>
    Effect.gen(function* wins() {
      const session = yield* headless(true);

      // The person may unschedule; the key in the environment may not.
      assert.include(
        yield* session.refused([
          "posts",
          "unschedule",
          scheduledId,
          ...inStudio,
        ]),
        "This API key does not have the permission post:schedule."
      );
      assert.include(
        yield* session.printed(["doctor", ...inStudio]),
        "The API key in PEAL_API_KEY, which wins over a saved sign-in."
      );
      assert.include(
        yield* session.withEnv({}).printed(["doctor", ...inStudio]),
        "The sign-in saved for http://localhost:3000. PEAL_API_KEY is not set."
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("is never sent in clear to a server that is not this machine", () =>
    Effect.gen(function* inClear() {
      const session = yield* headless();
      const drafts = ["drafts", "list", ...inStudio];
      const elsewhere = ["--api-url", "http://api.example.test"];

      // Plain HTTP beyond this machine: refused before any request,
      // with what to do about it.
      const refusal = yield* session.refused([...drafts, ...elsewhere]);

      assert.include(refusal, "http://api.example.test");
      assert.include(refusal, "https://");
      assert.include(refusal, "--insecure-http");
      assert.strictEqual(
        failureOf(yield* session.refused([...drafts, ...elsewhere, "--json"]))
          .error.code,
        "insecure_api_url"
      );

      // HTTPS, this machine under any of its names, and a server its
      // operator vouches for all take the key.
      for (const allowed of [
        ["--api-url", "https://api.example.test"],
        ["--api-url", "http://127.0.0.1:3000"],
        ["--api-url", "http://[::1]:3000"],
        ["--api-url", "http://peal.localhost:3000"],
        [...elsewhere, "--insecure-http"],
      ]) {
        yield* session.printed([...drafts, ...allowed]);
      }

      yield* session
        .withEnv({ ...key, PEAL_INSECURE_HTTP: "true" })
        .printed([...drafts, ...elsewhere]);

      // What sends no credential needs none of this.
      yield* session.printed(["health", ...elsewhere]);

      // And doctor says it, rather than send the key to find out.
      const checked = yield* session.refusedAfter([
        "doctor",
        ...inStudio,
        ...elsewhere,
      ]);

      assert.include(checked.logs, "--insecure-http");
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect("is told when the server refuses it, not to sign in again", () =>
    Effect.gen(function* revoked() {
      const session = yield* headless();

      const unknown = session.withEnv({
        ...key,
        PEAL_API_KEY: "peal_test_unknown_key",
      });

      const refusal = yield* unknown.refused(["drafts", "list", ...inStudio]);

      assert.include(
        refusal,
        "http://localhost:3000 refused the API key in PEAL_API_KEY"
      );
      assert.notInclude(refusal, "peal login");
      assert.strictEqual(
        failureOf(
          yield* unknown.refused(["drafts", "list", "--json", ...inStudio])
        ).error.code,
        "api_key_refused"
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );
});
