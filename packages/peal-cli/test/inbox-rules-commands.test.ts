import { assert, describe, it } from "@effect/vitest";
import { Effect, Ref } from "effect";

import { filesLayer, signedIn } from "./signed-in.ts";
import { blueskyId, instagramId, mastodonId } from "./studio.ts";

// peal inbox rules against the in-memory studio.

const inStudio = ["--workspace", "studio"];

const ruleId = "0190f3a0-0000-7000-8000-0000000c0001";

describe("peal inbox rules", () => {
  it.effect("starts a rule on a channel, lists, pauses and stops it", () =>
    Effect.gen(function* lifecycle() {
      const session = yield* signedIn();

      assert.include(
        yield* session.printed([
          "inbox",
          "rules",
          "start",
          "--channel",
          mastodonId,
          "--keyword",
          "Price",
          "--reply",
          "The price list is on our site.",
          ...inStudio,
        ]),
        `Answering comments on channel ${mastodonId} (price · active): ${ruleId}.`
      );
      assert.include(
        yield* session.printed(["inbox", "rules", "list", ...inStudio]),
        `  ${ruleId}  channel ${mastodonId}  price · active`
      );
      assert.include(
        yield* session.printed([
          "inbox",
          "rules",
          "pause",
          ruleId,
          ...inStudio,
        ]),
        "Paused rule"
      );
      assert.strictEqual(
        yield* session.printed(["inbox", "rules", "stop", ruleId, ...inStudio]),
        `Stopped rule ${ruleId}: it answers nothing more, and its replies stay.`
      );
      assert.include(
        (yield* Ref.get(session.studio.state)).changes,
        `inboxRules.delete ${ruleId}`
      );
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect(
    "says why a platform cannot carry it, and refuses no keyword before asking",
    () =>
      Effect.gen(function* refuses() {
        const session = yield* signedIn();

        assert.include(
          yield* session.refused([
            "inbox",
            "rules",
            "start",
            "--channel",
            blueskyId,
            "--keyword",
            "price",
            "--reply",
            "Hi",
            ...inStudio,
          ]),
          `bluesky ${blueskyId}: notAllowed`
        );
        assert.include(
          yield* session.refused([
            "inbox",
            "rules",
            "start",
            "--channel",
            mastodonId,
            "--reply",
            "Hi",
            ...inStudio,
          ]),
          "Give 1 to 10 --keyword"
        );
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect(
    "gives a rule a private reply where a channel carries it, and takes it off",
    () =>
      Effect.gen(function* privately() {
        const session = yield* signedIn();

        const started = yield* session.printed([
          "inbox",
          "rules",
          "start",
          "--channel",
          instagramId,
          "--keyword",
          "price",
          "--reply",
          "The list is in your messages.",
          "--private-reply",
          "Here is the list. (Automatic message)",
          ...inStudio,
        ]);

        assert.include(
          started,
          "  private reply: Here is the list. (Automatic message)"
        );
        assert.include(
          started,
          `  instagram ${instagramId}: available, private reply available`
        );

        const taken = yield* session.printed([
          "inbox",
          "rules",
          "update",
          ruleId,
          "--no-private-reply",
          ...inStudio,
        ]);

        assert.notInclude(taken, "private reply:");
        assert.include(
          yield* session.refused([
            "inbox",
            "rules",
            "update",
            ruleId,
            "--private-reply",
            "Hi",
            "--no-private-reply",
            ...inStudio,
          ]),
          "Give --private-reply or --no-private-reply, not both"
        );
        assert.include(
          yield* session.refused([
            "inbox",
            "rules",
            "start",
            "--channel",
            mastodonId,
            "--keyword",
            "price",
            "--reply",
            "Hi",
            "--private-reply",
            "Hi privately",
            ...inStudio,
          ]),
          `mastodon ${mastodonId}: available, private reply noApi`
        );
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );
});
