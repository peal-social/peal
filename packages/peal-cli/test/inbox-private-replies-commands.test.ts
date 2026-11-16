import { assert, describe, it } from "@effect/vitest";
import { Effect } from "effect";

import { filesLayer, signedIn } from "./signed-in.ts";
import {
  oldCommentId,
  privateCommentId,
  unconfirmedPrivateReplyId,
} from "./studio-messages.ts";

// peal inbox private-reply, against the in-memory studio: what each
// subcommand asks the server, and what it prints.

const inStudio = ["--workspace", "studio"];

describe("peal inbox private-reply", () => {
  it.effect("sends one, once a comment, and only once agreed", () =>
    Effect.gen(function* sends() {
      const session = yield* signedIn();

      // Without a terminal nobody can be asked: nothing is sent.
      const unasked = yield* session.refused([
        "inbox",
        "private-reply",
        "send",
        privateCommentId,
        "--text",
        "Here is the link.",
        ...inStudio,
      ]);

      assert.include(unasked, "needs a confirmation");

      // With --json it never asks: --yes is required.
      const quiet = yield* session.refused([
        "inbox",
        "private-reply",
        "send",
        privateCommentId,
        "--text",
        "Here is the link.",
        "--json",
        ...inStudio,
      ]);

      assert.include(quiet, "confirmation_required");

      const sent = yield* session.printed([
        "inbox",
        "private-reply",
        "send",
        privateCommentId,
        "--text",
        "Here is the link.",
        "--yes",
        ...inStudio,
      ]);

      assert.include(sent, "cannot be taken back");
      assert.include(sent, "is on its way, as the channel's account");

      const again = yield* session.refused([
        "inbox",
        "private-reply",
        "send",
        privateCommentId,
        "--text",
        "Again.",
        "--yes",
        ...inStudio,
      ]);

      assert.include(again, "has its private reply already");

      const old = yield* session.refused([
        "inbox",
        "private-reply",
        "send",
        oldCommentId,
        "--text",
        "Late.",
        "--yes",
        ...inStudio,
      ]);

      assert.include(old, "takes no private reply to it any more");
    }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );

  it.effect(
    "shows one, and records what was found for an unconfirmed one",
    () =>
      Effect.gen(function* confirms() {
        const session = yield* signedIn();

        const shown = yield* session.printed([
          "inbox",
          "private-reply",
          "show",
          unconfirmedPrivateReplyId,
          ...inStudio,
        ]);

        assert.include(shown, "unconfirmed: the request left");
        assert.include(shown, "peal inbox private-reply confirm");

        const refused = yield* session.refused([
          "inbox",
          "private-reply",
          "confirm",
          unconfirmedPrivateReplyId,
          ...inStudio,
        ]);

        assert.include(refused, "--sent, or --not-sent");

        const settled = yield* session.printed([
          "inbox",
          "private-reply",
          "confirm",
          unconfirmedPrivateReplyId,
          "--not-sent",
          ...inStudio,
        ]);

        assert.include(settled, "failed: it never went out");
      }).pipe(Effect.scoped, Effect.provide(filesLayer))
  );
});
