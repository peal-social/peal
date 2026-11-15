import { Effect, Layer, Option } from "effect";

import { CommentRuleNotices } from "#engagement/application/ports/comment-rule-notices.ts";
import { Notify } from "#notifications/application/notify.ts";
import { DatabaseError } from "#shared/application/database-error.ts";

/**
 * CommentRuleNotices through the notifications context: `CommentRuleStopped`,
 * in the transaction that ends the rule, to whoever started it while they
 * are a member (as a post's author), else to every member who may answer
 * comments, and to those of them who chose to hear of every post. Keyed by
 * the rule, which ends once. Its id and the reason only: never its
 * keywords or its reply.
 */
export const NotifiedCommentRuleNotices = Layer.effect(
  CommentRuleNotices,
  Effect.gen(function* NotifiedCommentRuleNotices() {
    const notices = yield* Notify;

    return CommentRuleNotices.of({
      stopped: (rule, reason) =>
        notices
          .notify({
            // A starter who can no longer answer follows the notice, and
            // every member who may answer hears it: they are the ones to
            // start the rule again.
            ...Option.match(rule.startedBy, {
              onNone: () => ({}),
              onSome: (starter) =>
                reason === "starterGone"
                  ? { followers: [starter] }
                  : { author: starter },
            }),
            event: { _tag: "CommentRuleStopped", reason, ruleId: rule.id },
            everyoneWhoMayAct: reason === "starterGone",
            key: `comment-rule:${rule.id}:stopped`,
            workspaceId: rule.workspaceId,
          })
          .pipe(
            Effect.catchTag("RecipientsUnavailable", (failure) =>
              Effect.fail(new DatabaseError({ cause: failure }))
            )
          ),
    });
  })
);
