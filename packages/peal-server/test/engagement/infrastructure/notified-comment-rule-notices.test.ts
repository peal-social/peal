import { assert, describe, it } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";

import { CommentRuleNotices } from "#engagement/application/ports/comment-rule-notices.ts";
import { CommentRuleIdSchema } from "#engagement/domain/comment-rule-id.ts";
import { NotifiedCommentRuleNotices } from "#engagement/infrastructure/notified-comment-rule-notices.ts";
import { Notify } from "#notifications/application/notify.ts";
import type { NoticeRequest } from "#notifications/application/notify.ts";
import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";

// What the notifications context is asked to tell of a comment rule that
// ended by itself: to its starter when its channel left, and to everyone
// who may answer comments, the starter beside them, when the starter can
// no longer answer.

const workspaceId = WorkspaceIdSchema.make(
  "0b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f"
);

const starter = UserIdSchema.make("5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f");

const rule = {
  id: CommentRuleIdSchema.make("00000000-0000-7000-8000-00000000c001"),
  startedBy: Option.some(starter),
  workspaceId,
};

const told = (reason: "channelGone" | "starterGone") =>
  Effect.gen(function* telling() {
    const requests: NoticeRequest[] = [];

    yield* CommentRuleNotices.use((notices) =>
      notices.stopped(rule, reason)
    ).pipe(
      Effect.provide(
        NotifiedCommentRuleNotices.pipe(
          Layer.provide(
            Layer.succeed(
              Notify,
              Notify.of({
                notify: (request) =>
                  Effect.sync(() => {
                    requests.push(request);
                  }),
                resolve: () => Effect.void,
              })
            )
          )
        )
      )
    );

    return requests;
  });

describe("the comment rules' notices", () => {
  it.effect("tell a rule whose channel left to its starter, once", () =>
    Effect.gen(function* channelGone() {
      assert.deepStrictEqual(yield* told("channelGone"), [
        {
          author: starter,
          event: {
            _tag: "CommentRuleStopped",
            reason: "channelGone",
            ruleId: rule.id,
          },
          everyoneWhoMayAct: false,
          key: `comment-rule:${rule.id}:stopped`,
          workspaceId,
        },
      ]);
    })
  );

  it.effect(
    "tell a rule whose starter can no longer answer to everyone who may, the starter beside them",
    () =>
      Effect.gen(function* starterGone() {
        assert.deepStrictEqual(yield* told("starterGone"), [
          {
            event: {
              _tag: "CommentRuleStopped",
              reason: "starterGone",
              ruleId: rule.id,
            },
            everyoneWhoMayAct: true,
            followers: [starter],
            key: `comment-rule:${rule.id}:stopped`,
            workspaceId,
          },
        ]);
      })
  );
});
