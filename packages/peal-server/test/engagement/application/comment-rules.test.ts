import { assert, describe, it } from "@effect/vitest";
import {
  DateTime,
  Deferred,
  Duration,
  Effect,
  Fiber,
  Layer,
  Option,
  Ref,
} from "effect";
import { SqlClient } from "effect/sql";

import { CommentRules } from "#engagement/application/comment-rules.ts";
import { EngagementPrivateReplies } from "#engagement/application/engagement-private-replies.ts";
import { EngagementRecords } from "#engagement/application/engagement-records.ts";
import { CommentRuleStore } from "#engagement/application/ports/comment-rule-store.ts";
import { CommentRuleIdSchema } from "#engagement/domain/comment-rule-id.ts";
import {
  maxChannelRepliesPerDay,
  maxRuleRepliesPerDay,
} from "#engagement/domain/comment-rule.ts";
import { DrizzleCommentRuleStore } from "#engagement/infrastructure/drizzle-comment-rule-store.ts";
import { DatabaseError } from "#shared/application/database-error.ts";
import { newId } from "#shared/application/ids.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import { Actor } from "#shared/domain/access.ts";
import { ChannelIdSchema, PostIdSchema } from "#shared/domain/ids.ts";
import { freshWorkspace } from "#test/channels/support.ts";
import {
  forget,
  instagramRule,
  meanwhile,
  messagesOn,
  platformsOf,
  postChannels,
  privateOutcomes,
  privateRepliesIn,
  privateStarted,
  privateText,
  publicRepliesEnd,
  received,
  RulesTest,
  rulesTestWith,
  started,
  starterPermissions,
  startersGone,
  stoppedRules,
  threadOn,
} from "#test/engagement/rule-world.ts";
import { actorIn } from "#test/publishing/support.ts";
import { fakeMeters } from "#test/shared/fake-meters.ts";
import { withheldWhileImpersonating } from "#workspace/domain/membership.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// Comment rules on Postgres, with the inbox's own replies: a comment that
// holds a keyword is answered once, its author once, a rule's day bounded,
// and a platform whose rules forbid it refuses the rule. Rows are written
// under a workspace of each test's own, on the real clock (the pool's
// timers would replay a virtual one's years), and deleted after.

// The rules' store on Postgres, failing for a rule whose keywords hold
// "outage" when it reads what the rule may answer, as a database would.
const FailingForOutage = Layer.effect(
  CommentRuleStore,
  Effect.gen(function* FailingForOutage() {
    const store = yield* CommentRuleStore;

    return CommentRuleStore.of({
      ...store,
      candidates: (rule, channelIds, claimedBefore, limit) =>
        rule.keywords.includes("outage")
          ? Effect.fail(new DatabaseError({ cause: "synthetic outage" }))
          : store.candidates(rule, channelIds, claimedBefore, limit),
    });
  })
).pipe(Layer.provide(DrizzleCommentRuleStore));

const OutageTest = rulesTestWith(FailingForOutage);

describe("comment rules", () => {
  it.live(
    "answer a comment that holds a keyword, once, and its author once",
    () =>
      Effect.gen(function* answers() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const thread = yield* threadOn(workspaceId, "mastodon");
          const rules = yield* CommentRules;

          const rule = yield* rules.start(actorIn(workspaceId), {
            keywords: ["Price", "prix"],
            reply: "The price list is on our site.",
            scope: { _tag: "channel", channelId: thread.channelId },
          });

          assert.deepStrictEqual(
            rule.channels.map(({ platform, reply }) => [platform, reply]),
            [["mastodon", "available"]]
          );

          const [asks, other, again] = yield* received(thread, [
            { author: 1, text: "What is the PRICE?" },
            { author: 2, text: "Lovely photo" },
            { author: 1, text: "And the prix for two?" },
          ]);

          const run = yield* rules.runDue;

          assert.strictEqual(run.replied, 1);
          assert.strictEqual((yield* Ref.get(started)).length, 1);

          const after = yield* rules.get(actorIn(workspaceId), rule.rule.id);

          assert.deepStrictEqual(
            new Map(
              after.matches.map(({ commentId, outcome }) => [
                commentId,
                outcome._tag,
              ])
            ),
            new Map([
              [asks?.id, "replied"],
              [again?.id, "samePerson"],
            ])
          );
          assert.isFalse(
            after.matches.some(({ commentId }) => commentId === other?.id)
          );

          // A later run looks at nothing again.
          assert.strictEqual((yield* rules.runDue).looked, 0);
          assert.strictEqual((yield* Ref.get(started)).length, 1);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "are refused where the platform's rules forbid an app to answer",
    () =>
      Effect.gen(function* refuses() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const thread = yield* threadOn(workspaceId, "bluesky");

          const refused = yield* CommentRules.use((rules) =>
            rules.start(actorIn(workspaceId), {
              keywords: ["price"],
              reply: "The price list is on our site.",
              scope: { _tag: "channel", channelId: thread.channelId },
            })
          ).pipe(Effect.flip);

          assert.strictEqual(refused._tag, "CommentRuleNotPossible");
          assert.deepStrictEqual(
            refused._tag === "CommentRuleNotPossible"
              ? refused.channels.map(({ reply }) => reply)
              : [],
            ["notAllowed"]
          );

          const none = yield* CommentRules.use((rules) =>
            rules.start(actorIn(workspaceId), {
              keywords: ["  "],
              reply: "Hello",
              scope: { _tag: "channel", channelId: thread.channelId },
            })
          ).pipe(Effect.flip);

          assert.strictEqual(
            none._tag === "CommentRuleNotPossible" ? none.reason : none._tag,
            "keywords"
          );

          const contributor = yield* CommentRules.use((rules) =>
            rules.start(actorIn(workspaceId, permissionsFor("contributor")), {
              keywords: ["price"],
              reply: "Hello",
              scope: { _tag: "channel", channelId: thread.channelId },
            })
          ).pipe(Effect.flip);

          assert.strictEqual(contributor._tag, "MissingPermission");
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live("answer nothing received before they started, nor while paused", () =>
    Effect.gen(function* waits() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const thread = yield* threadOn(workspaceId, "mastodon");

        yield* received(thread, [{ author: 3, text: "price?" }]);
        yield* Effect.sleep("5 millis");

        const rules = yield* CommentRules;
        const beforeStart = yield* DateTime.now;

        yield* Effect.sleep("5 millis");

        const rule = yield* rules.start(actorIn(workspaceId), {
          keywords: ["price"],
          reply: "On our site.",
          scope: { _tag: "post", postId: thread.postId },
        });

        assert.strictEqual((yield* rules.runDue).looked, 0);

        // Nor one written before it started that Peal read only after.
        yield* Effect.sleep("5 millis");
        yield* received(
          thread,
          [{ author: 5, text: "price, late" }],
          beforeStart
        );
        yield* Effect.sleep("5 millis");
        assert.strictEqual((yield* rules.runDue).looked, 0);

        yield* rules.change(actorIn(workspaceId), rule.rule.id, {
          paused: true,
        });
        yield* Effect.sleep("5 millis");
        yield* received(thread, [{ author: 4, text: "price please" }]);

        assert.strictEqual((yield* rules.runDue).looked, 0);

        // Set going again, it never answers what came while it was paused.
        yield* rules.change(actorIn(workspaceId), rule.rule.id, {
          paused: false,
        });

        assert.strictEqual((yield* rules.runDue).looked, 0);

        yield* rules.stop(actorIn(workspaceId), rule.rule.id);

        const stopped = yield* rules.get(actorIn(workspaceId), rule.rule.id);

        assert.strictEqual(stopped.rule.status._tag, "ended");
      }).pipe(Effect.ensuring(forget(workspaceId)));
    }).pipe(Effect.provide(RulesTest))
  );

  it.live("take a rule on a post not out yet, on the channels it is for", () =>
    Effect.gen(function* scheduled() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const postId = yield* newId(PostIdSchema);
        const mastodon = yield* newId(ChannelIdSchema);

        yield* Ref.update(
          platformsOf,
          (known) => new Map([...known, [mastodon, "mastodon"]])
        );
        yield* Ref.update(
          postChannels,
          (known) => new Map([...known, [postId, [mastodon]]])
        );

        const rules = yield* CommentRules;

        const rule = yield* rules.start(actorIn(workspaceId), {
          keywords: ["price"],
          reply: "On our site.",
          scope: { _tag: "post", postId },
        });

        assert.deepStrictEqual(
          rule.channels.map(({ channelId, reply }) => [channelId, reply]),
          [[mastodon, "available"]]
        );

        // Once out, the inbox follows it there, and the rule answers.
        const thread = yield* threadOn(workspaceId, "mastodon", postId);

        yield* Effect.sleep("5 millis");
        yield* received(thread, [{ author: 3, text: "price?" }]);

        assert.strictEqual((yield* rules.runDue).replied, 1);
      }).pipe(Effect.ensuring(forget(workspaceId)));
    }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "take a claim back that was left for over half an hour, and answer it",
    () =>
      Effect.gen(function* reclaims() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const thread = yield* threadOn(workspaceId, "mastodon");
          const rules = yield* CommentRules;

          const rule = yield* rules.start(actorIn(workspaceId), {
            keywords: ["price"],
            reply: "On our site.",
            scope: { _tag: "channel", channelId: thread.channelId },
          });

          yield* Effect.sleep("5 millis");

          const [stale, fresh] = yield* received(thread, [
            { author: 1, text: "price?" },
            { author: 2, text: "price, please" },
          ]);

          assert.isDefined(stale);
          assert.isDefined(fresh);

          // A run that stopped after claiming them: one long ago, one now.
          const sql = yield* SqlClient.SqlClient;

          yield* sql`INSERT INTO engagement.comment_rule_matches (rule_id, comment_id, outcome, looked_at)
          VALUES (${rule.rule.id}, ${stale.id}, 'claimed', now() - interval '31 minutes'),
            (${rule.rule.id}, ${fresh.id}, 'claimed', now())`.pipe(
            Effect.orDie
          );

          const run = yield* rules.runDue;

          assert.strictEqual(run.replied, 1);

          const after = yield* rules.get(actorIn(workspaceId), rule.rule.id);

          assert.deepStrictEqual(
            new Map(
              after.matches.map(({ commentId, outcome }) => [
                commentId,
                outcome._tag,
              ])
            ),
            new Map([
              [stale.id, "replied"],
              [fresh.id, "claimed"],
            ])
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live("go on to the other rules when one meets a database error", () =>
    Effect.gen(function* isolates() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const failing = yield* threadOn(workspaceId, "mastodon");
        const working = yield* threadOn(workspaceId, "mastodon");
        const rules = yield* CommentRules;

        yield* rules.start(actorIn(workspaceId), {
          keywords: ["outage"],
          reply: "We are on it.",
          scope: { _tag: "channel", channelId: failing.channelId },
        });

        const answering = yield* rules.start(actorIn(workspaceId), {
          keywords: ["price"],
          reply: "On our site.",
          scope: { _tag: "channel", channelId: working.channelId },
        });

        yield* Effect.sleep("5 millis");
        yield* received(failing, [{ author: 1, text: "outage?" }]);
        yield* received(working, [{ author: 2, text: "price?" }]);

        assert.strictEqual((yield* rules.runDue).replied, 1);

        const after = yield* rules.get(actorIn(workspaceId), answering.rule.id);

        assert.deepStrictEqual(
          after.matches.map(({ outcome }) => outcome._tag),
          ["replied"]
        );
      }).pipe(Effect.ensuring(forget(workspaceId)));
    }).pipe(Effect.provide(OutageTest))
  );

  it.live("end a channel's rules when the channel is disconnected", () =>
    Effect.gen(function* channelGone() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const thread = yield* threadOn(workspaceId, "mastodon");
        const rules = yield* CommentRules;

        const rule = yield* rules.start(actorIn(workspaceId), {
          keywords: ["price"],
          reply: "On our site.",
          scope: { _tag: "channel", channelId: thread.channelId },
        });

        yield* EngagementRecords.use((records) =>
          records.channelGone(
            thread.channelId,
            "mastodon",
            DateTime.nowUnsafe()
          )
        );

        const ended = yield* rules.get(actorIn(workspaceId), rule.rule.id);

        assert.deepStrictEqual(
          ended.rule.status._tag === "ended" ? ended.rule.status.reason : null,
          "channelGone"
        );

        // Told once, with why: a channel gone again ends nothing more.
        yield* EngagementRecords.use((records) =>
          records.channelGone(
            thread.channelId,
            "mastodon",
            DateTime.nowUnsafe()
          )
        );

        assert.deepStrictEqual(
          (yield* Ref.get(stoppedRules)).filter(([id]) => id === rule.rule.id),
          [[rule.rule.id, "channelGone"]]
        );
      }).pipe(Effect.ensuring(forget(workspaceId)));
    }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "never answer on a channel whose platform forbids it, on a post that went out on several",
    () =>
      Effect.gen(function* refusesThere() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const mastodon = yield* threadOn(workspaceId, "mastodon");

          const bluesky = yield* threadOn(
            workspaceId,
            "bluesky",
            mastodon.postId
          );

          const rules = yield* CommentRules;

          const rule = yield* rules.start(actorIn(workspaceId), {
            keywords: ["price"],
            reply: "On our site.",
            scope: { _tag: "post", postId: mastodon.postId },
          });

          assert.deepStrictEqual(
            new Map(
              rule.channels.map(({ platform, reply }) => [platform, reply])
            ),
            new Map([
              ["bluesky", "notAllowed"],
              ["mastodon", "available"],
            ])
          );

          yield* Effect.sleep("5 millis");

          const [onBluesky] = yield* received(bluesky, [
            { author: 5, text: "price?" },
          ]);

          const [onMastodon] = yield* received(mastodon, [
            { author: 6, text: "price?" },
          ]);

          const before = (yield* Ref.get(started)).length;
          const run = yield* rules.runDue;

          assert.strictEqual(run.replied, 1);
          assert.strictEqual((yield* Ref.get(started)).length, before + 1);

          const after = yield* rules.get(actorIn(workspaceId), rule.rule.id);

          assert.deepStrictEqual(
            after.matches.map(({ commentId }) => commentId),
            [onMastodon?.id]
          );
          assert.isFalse(
            after.matches.some(({ commentId }) => commentId === onBluesky?.id)
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "answer no more than a channel's day allows, every rule together",
    () =>
      Effect.gen(function* boundedDay() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const thread = yield* threadOn(workspaceId, "mastodon");
          const rules = yield* CommentRules;
          const sql = yield* SqlClient.SqlClient;

          const first = yield* rules.start(actorIn(workspaceId), {
            keywords: ["hours"],
            reply: "Nine to five.",
            scope: { _tag: "channel", channelId: thread.channelId },
          });

          // The channel's day, full: as many replies as it takes, today.
          const earlier = yield* received(
            thread,
            Array.from({ length: maxChannelRepliesPerDay }, (_, n) => ({
              author: 100 + n,
              text: `earlier ${String(n)}`,
            }))
          );

          for (const comment of earlier) {
            yield* sql`INSERT INTO engagement.comment_rule_matches (rule_id, comment_id, outcome, looked_at)
            VALUES (${first.rule.id}, ${comment.id}, 'replied', now())`;
          }

          const second = yield* rules.start(actorIn(workspaceId), {
            keywords: ["price"],
            reply: "On our site.",
            scope: { _tag: "post", postId: thread.postId },
          });

          yield* Effect.sleep("5 millis");
          yield* received(thread, [{ author: 7, text: "price?" }]);

          const before = (yield* Ref.get(started)).length;

          yield* rules.runDue;

          assert.strictEqual((yield* Ref.get(started)).length, before);
          assert.deepStrictEqual(
            (yield* rules.get(actorIn(workspaceId), second.rule.id)).matches,
            []
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live("count a rule's day with the replies other runs are making", () =>
    Effect.gen(function* inFlight() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const thread = yield* threadOn(workspaceId, "mastodon");
        const rules = yield* CommentRules;
        const sql = yield* SqlClient.SqlClient;

        const rule = yield* rules.start(actorIn(workspaceId), {
          keywords: ["price"],
          reply: "On our site.",
          scope: { _tag: "channel", channelId: thread.channelId },
        });

        yield* Effect.sleep("5 millis");

        // Another run claimed as many comments as the rule's day allows,
        // and its replies are on their way.
        const claimed = yield* received(
          thread,
          Array.from({ length: maxRuleRepliesPerDay }, (_, n) => ({
            author: 200 + n,
            text: `price ${String(n)}?`,
          }))
        );

        for (const comment of claimed) {
          yield* sql`INSERT INTO engagement.comment_rule_matches (rule_id, comment_id, outcome, looked_at)
            VALUES (${rule.rule.id}, ${comment.id}, 'claimed', now())`;
        }

        const [late] = yield* received(thread, [{ author: 7, text: "price?" }]);

        const before = (yield* Ref.get(started)).length;
        const run = yield* rules.runDue;

        assert.strictEqual(run.replied, 0);
        assert.strictEqual((yield* Ref.get(started)).length, before);
        assert.isFalse(
          (yield* rules.get(actorIn(workspaceId), rule.rule.id)).matches.some(
            ({ commentId }) => commentId === late?.id
          )
        );
      }).pipe(Effect.ensuring(forget(workspaceId)));
    }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "count a rule's and a channel's day under their lock, waiting for whoever holds it",
    () =>
      Effect.gen(function* locked() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const thread = yield* threadOn(workspaceId, "mastodon");
          const rules = yield* CommentRules;

          const rule = yield* rules.start(actorIn(workspaceId), {
            keywords: ["price"],
            reply: "On our site.",
            scope: { _tag: "channel", channelId: thread.channelId },
          });

          yield* Effect.sleep("5 millis");
          yield* received(thread, [{ author: 7, text: "price?" }]);

          // Another transaction holds the rule's and the channel's day.
          const held = yield* Deferred.make<boolean>();
          const release = yield* Deferred.make<boolean>();
          const { transaction } = yield* TransactionRunner;

          const holder = yield* transaction(
            CommentRuleStore.use((store) =>
              store.claimReplyDay(rule.rule.id, thread.channelId)
            ).pipe(
              Effect.andThen(Deferred.succeed(held, true)),
              Effect.andThen(Deferred.await(release))
            )
          ).pipe(Effect.forkChild);

          yield* Deferred.await(held);

          const run = yield* rules.runDue.pipe(Effect.forkChild);

          yield* Effect.sleep("300 millis");

          const waited = run.pollUnsafe() === undefined;

          yield* Deferred.succeed(release, true);
          yield* Fiber.join(holder);

          assert.isTrue(waited);
          assert.strictEqual((yield* Fiber.join(run)).replied, 1);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live("end a rule whose starter is gone, and tell it once", () =>
    Effect.gen(function* starterGone() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const thread = yield* threadOn(workspaceId, "mastodon");
        const rules = yield* CommentRules;

        const rule = yield* rules.start(actorIn(workspaceId), {
          keywords: ["price"],
          reply: "On our site.",
          scope: { _tag: "channel", channelId: thread.channelId },
        });

        yield* Ref.update(
          startersGone,
          (gone) => new Set([...gone, workspaceId])
        );

        assert.strictEqual((yield* rules.runDue).ended, 1);
        yield* rules.runDue;

        const ended = yield* rules.get(actorIn(workspaceId), rule.rule.id);

        assert.deepStrictEqual(
          ended.rule.status._tag === "ended" ? ended.rule.status.reason : null,
          "starterGone"
        );
        assert.deepStrictEqual(
          (yield* Ref.get(stoppedRules)).filter(([id]) => id === rule.rule.id),
          [[rule.rule.id, "starterGone"]]
        );
      }).pipe(Effect.ensuring(forget(workspaceId)));
    }).pipe(Effect.provide(RulesTest))
  );

  it.live("wait for the channel's day held by another rule's run", () =>
    Effect.gen(function* channelLocked() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const thread = yield* threadOn(workspaceId, "mastodon");
        const rules = yield* CommentRules;

        yield* rules.start(actorIn(workspaceId), {
          keywords: ["price"],
          reply: "On our site.",
          scope: { _tag: "channel", channelId: thread.channelId },
        });

        yield* Effect.sleep("5 millis");
        yield* received(thread, [{ author: 7, text: "price?" }]);

        // Another rule's run holds the channel's day.
        const otherRule = CommentRuleIdSchema.make(
          "00000000-0000-7000-8000-00000000c0ff"
        );

        const held = yield* Deferred.make<boolean>();
        const release = yield* Deferred.make<boolean>();
        const { transaction } = yield* TransactionRunner;

        const holder = yield* transaction(
          CommentRuleStore.use((store) =>
            store.claimReplyDay(otherRule, thread.channelId)
          ).pipe(
            Effect.andThen(Deferred.succeed(held, true)),
            Effect.andThen(Deferred.await(release))
          )
        ).pipe(Effect.forkChild);

        yield* Deferred.await(held);

        const run = yield* rules.runDue.pipe(Effect.forkChild);

        yield* Effect.sleep("300 millis");

        const waited = run.pollUnsafe() === undefined;

        yield* Deferred.succeed(release, true);
        yield* Fiber.join(holder);

        assert.isTrue(waited);
        assert.strictEqual((yield* Fiber.join(run)).replied, 1);
      }).pipe(Effect.ensuring(forget(workspaceId)));
    }).pipe(Effect.provide(RulesTest))
  );

  it.live("count a channel's day with the replies another rule is making", () =>
    Effect.gen(function* channelInFlight() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const thread = yield* threadOn(workspaceId, "mastodon");
        const rules = yield* CommentRules;
        const sql = yield* SqlClient.SqlClient;

        const other = yield* rules.start(actorIn(workspaceId), {
          keywords: ["hours"],
          reply: "Nine to five.",
          scope: { _tag: "post", postId: thread.postId },
        });

        // The channel's day, full but for one, and that one on its way.
        const earlier = yield* received(
          thread,
          Array.from({ length: maxChannelRepliesPerDay }, (_, n) => ({
            author: 300 + n,
            text: `earlier ${String(n)}`,
          }))
        );

        for (const [n, comment] of earlier.entries()) {
          yield* sql`INSERT INTO engagement.comment_rule_matches (rule_id, comment_id, outcome, looked_at)
            VALUES (${other.rule.id}, ${comment.id}, ${n === 0 ? "claimed" : "replied"}, now())`;
        }

        const rule = yield* rules.start(actorIn(workspaceId), {
          keywords: ["price"],
          reply: "On our site.",
          scope: { _tag: "channel", channelId: thread.channelId },
        });

        yield* Effect.sleep("5 millis");
        yield* received(thread, [{ author: 7, text: "price?" }]);

        assert.strictEqual((yield* rules.runDue).replied, 0);
        assert.deepStrictEqual(
          (yield* rules.get(actorIn(workspaceId), rule.rule.id)).matches,
          []
        );
      }).pipe(Effect.ensuring(forget(workspaceId)));
    }).pipe(Effect.provide(RulesTest))
  );

  it.live("answer no more than the rule's day allows within one run", () =>
    Effect.gen(function* ruleFullDuringRun() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const thread = yield* threadOn(workspaceId, "mastodon");
        const rules = yield* CommentRules;
        const sql = yield* SqlClient.SqlClient;

        const rule = yield* rules.start(actorIn(workspaceId), {
          keywords: ["price"],
          reply: "On our site.",
          scope: { _tag: "channel", channelId: thread.channelId },
        });

        yield* Effect.sleep("5 millis");

        // The rule's day, full but for one.
        const earlier = yield* received(
          thread,
          Array.from({ length: maxRuleRepliesPerDay - 1 }, (_, n) => ({
            author: 400 + n,
            text: `price ${String(n)}?`,
          }))
        );

        for (const comment of earlier) {
          yield* sql`INSERT INTO engagement.comment_rule_matches (rule_id, comment_id, outcome, looked_at)
          VALUES (${rule.rule.id}, ${comment.id}, 'replied', now())`;
        }

        yield* received(thread, [
          { author: 7, text: "price?" },
          { author: 8, text: "the price?" },
        ]);

        assert.strictEqual((yield* rules.runDue).replied, 1);
      }).pipe(Effect.ensuring(forget(workspaceId)));
    }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "leave a rule paused while the run asked for its starter, gone or not",
    () =>
      Effect.gen(function* pausedMeanwhile() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const thread = yield* threadOn(workspaceId, "mastodon");
          const rules = yield* CommentRules;
          const sql = yield* SqlClient.SqlClient;

          const rule = yield* rules.start(actorIn(workspaceId), {
            keywords: ["price"],
            reply: "On our site.",
            scope: { _tag: "channel", channelId: thread.channelId },
          });

          yield* Ref.update(
            startersGone,
            (gone) => new Set([...gone, workspaceId])
          );
          yield* Ref.set(
            meanwhile,
            sql`UPDATE engagement.comment_rules SET status = 'paused', status_at = now() WHERE id = ${rule.rule.id}`.pipe(
              Effect.asVoid,
              Effect.orDie
            )
          );

          // Only this workspace's rule is asked about first.
          const toldBefore = (yield* Ref.get(stoppedRules)).length;

          yield* rules.runDue;

          const after = yield* rules.get(actorIn(workspaceId), rule.rule.id);

          assert.strictEqual(after.rule.status._tag, "paused");
          assert.isFalse(
            (yield* Ref.get(stoppedRules))
              .slice(toldBefore)
              .some(([id]) => id === rule.rule.id)
          );
        }).pipe(
          Effect.ensuring(Ref.set(meanwhile, Effect.void)),
          Effect.ensuring(forget(workspaceId))
        );
      }).pipe(Effect.provide(RulesTest))
  );
});

describe("a comment rule's private reply", () => {
  it.live(
    "goes once the public reply is out, once, to the comment's author",
    () =>
      Effect.gen(function* follows() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const { rule, thread } = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;

          assert.deepStrictEqual(
            rule.channels.map(({ privateReply }) => privateReply),
            ["available"]
          );

          const [asks] = yield* received(thread, [
            { author: 1, text: "What is the price?" },
          ]);

          assert.isDefined(asks);

          const first = yield* rules.runDue;

          // The public reply is journalled; the private one waits for it.
          assert.strictEqual(first.replied, 1);
          assert.strictEqual(first.privateReplied, 0);
          assert.deepStrictEqual(yield* privateRepliesIn(workspaceId), []);
          assert.strictEqual(
            (yield* privateOutcomes(workspaceId, rule.rule.id)).get(asks.id),
            "waiting"
          );

          // Still on its way: the private one waits on.
          assert.strictEqual((yield* rules.runDue).privateReplied, 0);

          yield* publicRepliesEnd(workspaceId, "sent");

          const startedBefore = (yield* Ref.get(privateStarted)).length;
          const second = yield* rules.runDue;

          assert.strictEqual(second.privateReplied, 1);
          assert.strictEqual(second.replied, 0);

          const made = yield* privateRepliesIn(workspaceId);

          assert.deepStrictEqual(
            made.map(({ commentId, ruleId, text }) => [
              commentId,
              ruleId,
              text,
            ]),
            [[asks.id, rule.rule.id, privateText]]
          );
          assert.strictEqual(
            (yield* Ref.get(privateStarted)).length,
            startedBefore + 1
          );
          assert.strictEqual(
            (yield* privateOutcomes(workspaceId, rule.rule.id)).get(asks.id),
            "made"
          );

          const view = yield* rules.get(actorIn(workspaceId), rule.rule.id);

          assert.deepStrictEqual(
            view.matches.map(({ privateStatus }) => privateStatus),
            [Option.some("sending")]
          );

          // A later run sends nothing more.
          assert.strictEqual((yield* rules.runDue).privateReplied, 0);
          assert.strictEqual((yield* privateRepliesIn(workspaceId)).length, 1);
          assert.strictEqual(
            (yield* Ref.get(privateStarted)).length,
            startedBefore + 1
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live("never follows a public reply that failed or is unconfirmed", () =>
    Effect.gen(function* notOut() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const { rule, thread } = yield* instagramRule(workspaceId);
        const rules = yield* CommentRules;

        const [failing, doubtful] = yield* received(thread, [
          { author: 1, text: "price?" },
          { author: 2, text: "price please" },
        ]);

        assert.isDefined(failing);
        assert.isDefined(doubtful);
        assert.strictEqual((yield* rules.runDue).replied, 2);

        yield* publicRepliesEnd(workspaceId, "failed", failing.id);
        yield* publicRepliesEnd(workspaceId, "unconfirmed", doubtful.id);

        assert.strictEqual((yield* rules.runDue).privateReplied, 0);
        assert.deepStrictEqual(yield* privateRepliesIn(workspaceId), []);
        assert.deepStrictEqual(
          yield* privateOutcomes(workspaceId, rule.rule.id),
          new Map([
            [failing.id, "publicReplyFailed"],
            [doubtful.id, "publicReplyUnconfirmed"],
          ])
        );
      }).pipe(Effect.ensuring(forget(workspaceId)));
    }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "never makes a second private reply to a comment: after a member's, or when a run takes it again",
    () =>
      Effect.gen(function* once() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const { rule, thread } = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;

          const [byMember, byRule] = yield* received(thread, [
            { author: 1, text: "price?" },
            { author: 2, text: "price please" },
          ]);

          assert.isDefined(byMember);
          assert.isDefined(byRule);

          yield* rules.runDue;
          yield* publicRepliesEnd(workspaceId, "sent");

          // A member answers one privately first.
          const members = yield* EngagementPrivateReplies.use((replies) =>
            replies.send(
              actorIn(workspaceId),
              byMember.id,
              "I am writing to you myself."
            )
          );

          assert.strictEqual((yield* rules.runDue).privateReplied, 1);

          const made = yield* privateRepliesIn(workspaceId);

          assert.deepStrictEqual(
            made.map(({ commentId, ruleId }) => [commentId, ruleId]),
            [
              [byMember.id, null],
              [byRule.id, rule.rule.id],
            ]
          );
          assert.strictEqual(members.commentId, byMember.id);
          assert.deepStrictEqual(
            yield* privateOutcomes(workspaceId, rule.rule.id),
            new Map([
              [byMember.id, "PrivateReplyPending"],
              [byRule.id, "made"],
            ])
          );

          // A run that lost what it made, and takes the comment again,
          // finds the one its key made: nothing new is journalled or
          // started.
          const sql = yield* SqlClient.SqlClient;
          const startedBefore = (yield* Ref.get(privateStarted)).length;

          yield* sql`UPDATE engagement.comment_rule_matches
            SET private_code = 'waiting', private_reply_id = NULL
            WHERE rule_id = ${rule.rule.id}`.pipe(Effect.orDie);

          yield* rules.runDue;

          const after = yield* privateRepliesIn(workspaceId);

          assert.deepStrictEqual(after, made);
          assert.strictEqual(
            (yield* Ref.get(privateStarted)).length,
            startedBefore
          );
          assert.strictEqual(
            (yield* privateOutcomes(workspaceId, rule.rule.id)).get(byRule.id),
            "made"
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live("never makes two between two rules answering one comment", () =>
    Effect.gen(function* twoRules() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const { thread } = yield* instagramRule(workspaceId);
        const rules = yield* CommentRules;

        yield* rules.start(actorIn(workspaceId), {
          keywords: ["list"],
          privateReply: "Another private text.",
          reply: "Another public text.",
          scope: { _tag: "post", postId: thread.postId },
        });
        yield* Effect.sleep("5 millis");

        const [both] = yield* received(thread, [
          { author: 1, text: "price list?" },
        ]);

        assert.isDefined(both);

        yield* rules.runDue;
        yield* publicRepliesEnd(workspaceId, "sent");
        yield* rules.runDue;
        yield* publicRepliesEnd(workspaceId, "sent");
        yield* rules.runDue;

        assert.strictEqual((yield* privateRepliesIn(workspaceId)).length, 1);
      }).pipe(Effect.ensuring(forget(workspaceId)));
    }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "keeps the public reply when the private one is refused: past the 7 days",
    () =>
      Effect.gen(function* tooOld() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const { rule, thread } = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;
          const sql = yield* SqlClient.SqlClient;
          const now = yield* DateTime.now;

          // A rule from long ago, and a comment written 7 days less half
          // an hour ago, read only now: within Meta's days, past Peal's.
          yield* sql`UPDATE engagement.comment_rules
            SET answers_from = now() - interval '30 days'
            WHERE id = ${rule.rule.id}`.pipe(Effect.orDie);

          const [old] = yield* received(
            thread,
            [{ author: 1, text: "price?" }],
            DateTime.subtractDuration(now, Duration.minutes(167 * 60 + 30))
          );

          assert.isDefined(old);
          assert.strictEqual((yield* rules.runDue).replied, 1);

          yield* publicRepliesEnd(workspaceId, "sent");

          assert.strictEqual((yield* rules.runDue).privateReplied, 0);
          assert.deepStrictEqual(yield* privateRepliesIn(workspaceId), []);

          const view = yield* rules.get(actorIn(workspaceId), rule.rule.id);

          assert.deepStrictEqual(
            view.matches.map(({ outcome }) =>
              outcome._tag === "replied"
                ? [outcome._tag, Option.getOrUndefined(outcome.private)]
                : [outcome._tag]
            ),
            [
              [
                "replied",
                { _tag: "privateCode", code: "PrivateReplyNotPossible" },
              ],
            ]
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "sends only on the channels that carry it: Instagram, not Mastodon, and not where messages are off",
    () =>
      Effect.gen(function* where() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const postId = yield* newId(PostIdSchema);
          const instagram = yield* threadOn(workspaceId, "instagram", postId);
          const mastodon = yield* threadOn(workspaceId, "mastodon", postId);
          const facebook = yield* threadOn(workspaceId, "facebook", postId);

          yield* messagesOn(workspaceId, instagram.channelId);

          // The Page's messages are on, but in another workspace: not
          // here.
          const elsewhere = yield* freshWorkspace;

          yield* messagesOn(elsewhere, facebook.channelId).pipe(
            Effect.ensuring(forget(elsewhere))
          );

          const rules = yield* CommentRules;

          const rule = yield* rules.start(actorIn(workspaceId), {
            keywords: ["price"],
            privateReply: privateText,
            reply: "The price list is in your messages.",
            scope: { _tag: "post", postId },
          });

          assert.deepStrictEqual(
            new Map(
              rule.channels.map(({ channelId, privateReply }) => [
                channelId,
                privateReply,
              ])
            ),
            new Map([
              [instagram.channelId, "available"],
              [mastodon.channelId, "noApi"],
              [facebook.channelId, "messagesOff"],
            ])
          );

          yield* Effect.sleep("5 millis");

          const [onInstagram] = yield* received(instagram, [
            { author: 1, text: "price?" },
          ]);

          const [onMastodon] = yield* received(mastodon, [
            { author: 2, text: "price?" },
          ]);

          const [onFacebook] = yield* received(facebook, [
            { author: 3, text: "price?" },
          ]);

          assert.strictEqual((yield* rules.runDue).replied, 3);

          yield* publicRepliesEnd(workspaceId, "sent");

          assert.strictEqual((yield* rules.runDue).privateReplied, 1);
          assert.deepStrictEqual(
            (yield* privateRepliesIn(workspaceId)).map(
              ({ commentId }) => commentId
            ),
            [String(onInstagram?.id)]
          );
          assert.deepStrictEqual(
            yield* privateOutcomes(workspaceId, rule.rule.id),
            new Map([
              [onInstagram?.id, "made"],
              [onMastodon?.id, "noApi"],
              [onFacebook?.id, "messagesOff"],
            ])
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "is refused where no channel can carry it, and keeps working in public when the messages go off",
    () =>
      Effect.gen(function* off() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const page = yield* threadOn(workspaceId, "facebook");
          const rules = yield* CommentRules;

          const refused = yield* rules
            .start(actorIn(workspaceId), {
              keywords: ["price"],
              privateReply: privateText,
              reply: "On our site.",
              scope: { _tag: "channel", channelId: page.channelId },
            })
            .pipe(Effect.flip);

          assert.strictEqual(
            refused._tag === "CommentRuleNotPossible"
              ? refused.reason
              : refused._tag,
            "privateReply"
          );
          assert.deepStrictEqual(
            refused._tag === "CommentRuleNotPossible"
              ? refused.channels.map(({ privateReply }) => privateReply)
              : [],
            ["messagesOff"]
          );

          const empty = yield* rules
            .start(actorIn(workspaceId), {
              keywords: ["price"],
              privateReply: " \u0007 ",
              reply: "On our site.",
              scope: { _tag: "channel", channelId: page.channelId },
            })
            .pipe(Effect.flip);

          assert.strictEqual(
            empty._tag === "CommentRuleNotPossible" ? empty.reason : empty._tag,
            "emptyPrivateReply"
          );

          // Turned on, the rule starts; turned off later, it answers in
          // public only, and says why.
          yield* messagesOn(workspaceId, page.channelId);

          const rule = yield* rules.start(actorIn(workspaceId), {
            keywords: ["price"],
            privateReply: privateText,
            reply: "On our site.",
            scope: { _tag: "channel", channelId: page.channelId },
          });

          yield* SqlClient.SqlClient.use(
            (sql) =>
              sql`DELETE FROM engagement.message_channels WHERE workspace_id = ${workspaceId}`
          ).pipe(Effect.orDie);
          yield* Effect.sleep("5 millis");

          const [asks] = yield* received(page, [{ author: 1, text: "price?" }]);

          assert.strictEqual((yield* rules.runDue).replied, 1);
          assert.deepStrictEqual(
            yield* privateOutcomes(workspaceId, rule.rule.id),
            new Map([[asks?.id, "messagesOff"]])
          );

          // Too long for Messenger's 2,000 characters: refused.
          yield* messagesOn(workspaceId, page.channelId);

          const tooLong = yield* rules
            .change(actorIn(workspaceId), rule.rule.id, {
              privateReply: "a".repeat(2001),
            })
            .pipe(Effect.flip);

          assert.deepStrictEqual(
            tooLong._tag === "CommentRuleNotPossible"
              ? [
                  tooLong.reason,
                  tooLong.channels.map(({ privateReply }) => privateReply),
                ]
              : [tooLong._tag],
            ["privateReply", ["textTooLong"]]
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "is started only by who may send private replies, and skipped once the starter may not",
    () =>
      Effect.gen(function* permission() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const thread = yield* threadOn(workspaceId, "instagram");

          yield* messagesOn(workspaceId, thread.channelId);

          const rules = yield* CommentRules;

          const replier = yield* rules
            .start(
              actorIn(
                workspaceId,
                permissionsFor("editor").filter(
                  (granted) => granted !== "engagement:message"
                )
              ),
              {
                keywords: ["price"],
                privateReply: privateText,
                reply: "On our site.",
                scope: { _tag: "channel", channelId: thread.channelId },
              }
            )
            .pipe(Effect.flip);

          assert.deepStrictEqual(
            replier._tag === "MissingPermission"
              ? replier.permission
              : replier._tag,
            "engagement:message"
          );

          // An application the owner did not let send messages.
          const member = actorIn(workspaceId);

          const application = new Actor({
            permissions: member.permissions,
            subject:
              member.subject._tag === "user"
                ? { ...member.subject, clientId: "synthetic-client" }
                : member.subject,
            workspaceId,
          });

          const unconsented = yield* rules
            .start(application, {
              keywords: ["price"],
              privateReply: privateText,
              reply: "On our site.",
              scope: { _tag: "channel", channelId: thread.channelId },
            })
            .pipe(Effect.flip);

          assert.strictEqual(unconsented._tag, "MessagesNeedConsent");

          const rule = yield* rules.start(actorIn(workspaceId), {
            keywords: ["price"],
            privateReply: privateText,
            reply: "On our site.",
            scope: { _tag: "channel", channelId: thread.channelId },
          });

          yield* Effect.sleep("5 millis");

          const [before] = yield* received(thread, [
            { author: 1, text: "price?" },
          ]);

          yield* rules.runDue;
          yield* publicRepliesEnd(workspaceId, "sent");

          // The starter lost the right to send messages since.
          yield* Ref.set(
            starterPermissions,
            permissionsFor("editor").filter(
              (granted) => granted !== "engagement:message"
            )
          );

          const later = yield* received(thread, [
            { author: 2, text: "price too?" },
          ]);

          yield* rules.runDue.pipe(
            Effect.ensuring(
              Ref.set(starterPermissions, permissionsFor("editor"))
            )
          );

          assert.deepStrictEqual(yield* privateRepliesIn(workspaceId), []);
          assert.deepStrictEqual(
            yield* privateOutcomes(workspaceId, rule.rule.id),
            new Map([
              [before?.id, "MissingPermission"],
              [later[0]?.id, "MissingPermission"],
            ])
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "goes no further once the rule is stopped mid-run, paused or without its text",
    () =>
      Effect.gen(function* stops() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const { rule, thread } = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;
          const sql = yield* SqlClient.SqlClient;

          const [first] = yield* received(thread, [
            { author: 1, text: "price?" },
          ]);

          yield* rules.runDue;
          yield* publicRepliesEnd(workspaceId, "sent");

          const [second] = yield* received(thread, [
            { author: 2, text: "price, please" },
          ]);

          const startedBefore = (yield* Ref.get(started)).length;

          // A member stops the rule while the run goes, after it read it.
          yield* Ref.set(
            meanwhile,
            sql`UPDATE engagement.comment_rules SET status = 'ended', ended_reason = 'stopped', status_at = now() WHERE id = ${rule.rule.id}`.pipe(
              Effect.asVoid,
              Effect.orDie
            )
          );

          const run = yield* rules.runDue;

          assert.strictEqual(run.privateReplied, 0);
          assert.strictEqual(run.replied, 0);
          assert.deepStrictEqual(yield* privateRepliesIn(workspaceId), []);
          assert.strictEqual((yield* Ref.get(started)).length, startedBefore);
          assert.deepStrictEqual(
            yield* privateOutcomes(workspaceId, rule.rule.id),
            new Map([[first?.id, "stopped"]])
          );
          assert.isDefined(second);
        }).pipe(
          Effect.ensuring(Ref.set(meanwhile, Effect.void)),
          Effect.ensuring(forget(workspaceId))
        );
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "still answers in public when its private text is taken off mid-run",
    () =>
      Effect.gen(function* textOff() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const { rule, thread } = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;
          const sql = yield* SqlClient.SqlClient;

          const [first] = yield* received(thread, [
            { author: 1, text: "price?" },
          ]);

          yield* rules.runDue;
          yield* publicRepliesEnd(workspaceId, "sent");

          const [second] = yield* received(thread, [
            { author: 2, text: "price, please" },
          ]);

          // The text goes after the run listed what waits for it.
          yield* Ref.set(
            meanwhile,
            sql`UPDATE engagement.comment_rules SET private_reply = NULL WHERE id = ${rule.rule.id}`.pipe(
              Effect.asVoid,
              Effect.orDie
            )
          );

          const run = yield* rules.runDue;

          assert.strictEqual(run.replied, 1);
          assert.strictEqual(run.privateReplied, 0);
          assert.deepStrictEqual(yield* privateRepliesIn(workspaceId), []);
          assert.deepStrictEqual(
            yield* privateOutcomes(workspaceId, rule.rule.id),
            new Map([
              [first?.id, "stopped"],
              [second?.id, "none"],
            ])
          );
        }).pipe(
          Effect.ensuring(Ref.set(meanwhile, Effect.void)),
          Effect.ensuring(forget(workspaceId))
        );
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "shows its private text and private replies only to who may read private replies",
    () =>
      Effect.gen(function* hidden() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const { rule, thread } = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;

          yield* received(thread, [{ author: 1, text: "price?" }]);
          yield* rules.runDue;
          yield* publicRepliesEnd(workspaceId, "sent");
          yield* rules.runDue;

          const member = actorIn(workspaceId);

          const subject =
            member.subject._tag === "user" ? member.subject : undefined;

          assert.isDefined(subject);

          const readers = {
            application: new Actor({
              permissions: member.permissions,
              subject: { ...subject, clientId: "synthetic-client" },
              workspaceId,
            }),
            partnerKey: new Actor({
              permissions: ["engagement:read", "engagement:reply"],
              subject: { _tag: "apiKey", apiKeyId: "synthetic-partner-key" },
              workspaceId,
            }),
            viewer: actorIn(workspaceId, permissionsFor("viewer")),
          };

          // What a reader learns of the rule's private side, by get and list.
          const seen = (reader: Actor) =>
            Effect.all([
              rules.get(reader, rule.rule.id),
              rules
                .list(reader, {
                  after: Option.none(),
                  limit: 100,
                  status: Option.none(),
                })
                .pipe(
                  Effect.map((all) =>
                    all.filter((one) => one.rule.id === rule.rule.id)
                  )
                ),
            ]).pipe(
              Effect.map(([one, listed]) =>
                [one, ...listed].map((shown) => ({
                  privateReply: Option.isSome(shown.rule.privateReply),
                  privateReplyIds: shown.matches.filter(
                    ({ outcome }) =>
                      outcome._tag === "replied" &&
                      Option.exists(
                        outcome.private,
                        (made) => made._tag === "privateReply"
                      )
                  ).length,
                  statuses: shown.matches.filter(({ privateStatus }) =>
                    Option.isSome(privateStatus)
                  ).length,
                }))
              )
            );

          const nothing = {
            privateReply: false,
            privateReplyIds: 0,
            statuses: 0,
          };

          for (const [name, reader] of Object.entries(readers)) {
            assert.deepStrictEqual(
              yield* seen(reader),
              [nothing, nothing],
              name
            );
          }

          // Staff acting as a member hold what membership gives them:
          // nothing of the inbox, so not even the rule.
          const staff = new Actor({
            permissions: member.permissions.filter(
              (permission) => !withheldWhileImpersonating.has(permission)
            ),
            subject: {
              ...subject,
              impersonatedBy: Option.some(subject.userId),
            },
            workspaceId,
          });

          assert.strictEqual(
            (yield* rules.get(staff, rule.rule.id).pipe(Effect.flip))._tag,
            "MissingPermission"
          );

          assert.deepStrictEqual(yield* seen(member), [
            { privateReply: true, privateReplyIds: 1, statuses: 1 },
            { privateReply: true, privateReplyIds: 1, statuses: 1 },
          ]);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "lets only who may send private replies widen or resume a rule that holds one",
    () =>
      Effect.gen(function* widen() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const { rule } = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;

          const replier = actorIn(
            workspaceId,
            permissionsFor("editor").filter(
              (granted) => granted !== "engagement:message"
            )
          );

          const refused = (change: Parameters<typeof rules.change>[2]) =>
            rules.change(replier, rule.rule.id, change).pipe(
              Effect.flip,
              Effect.map((error) =>
                error._tag === "MissingPermission"
                  ? error.permission
                  : error._tag
              )
            );

          assert.strictEqual(
            yield* refused({ keywords: ["price", "list"] }),
            "engagement:message"
          );
          assert.strictEqual(
            yield* refused({ reply: "Another public text." }),
            "engagement:message"
          );

          // Pausing is always theirs; setting going again is not.
          yield* rules.change(replier, rule.rule.id, { paused: true });

          assert.strictEqual(
            yield* refused({ paused: false }),
            "engagement:message"
          );

          // Taking the private text off is theirs too; then the rule is
          // a public one they may change.
          const off = yield* rules.change(replier, rule.rule.id, {
            privateReply: null,
          });

          assert.isTrue(Option.isNone(off.rule.privateReply));

          const resumed = yield* rules.change(replier, rule.rule.id, {
            keywords: ["price", "list"],
            paused: false,
          });

          assert.strictEqual(resumed.rule.status._tag, "active");
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "lets a channel's disconnection take the rule before the box, as a run does",
    () =>
      Effect.gen(function* lockOrder() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const { rule, thread } = yield* instagramRule(workspaceId);
          const sql = yield* SqlClient.SqlClient;
          const store = yield* CommentRuleStore;
          const held = yield* Deferred.make<boolean>();
          const go = yield* Deferred.make<boolean>();

          // A run's transaction: the rule's row, then, later, the box.
          const run = yield* sql
            .withTransaction(
              Effect.gen(function* running() {
                yield* store.lock(workspaceId, rule.rule.id);
                yield* Deferred.succeed(held, true);
                yield* Deferred.await(go);

                return yield* sql`SELECT 1 FROM engagement.message_boxes
                  WHERE channel_id = ${thread.channelId} FOR UPDATE NOWAIT`.pipe(
                  Effect.as("box taken"),
                  Effect.catch(() => Effect.succeed("box held by another"))
                );
              })
            )
            .pipe(Effect.orDie, Effect.forkChild);

          yield* Deferred.await(held);

          // In the transaction that disconnects the channel, as the
          // channels' events run it.
          const gone = yield* EngagementRecords.use((records) =>
            sql.withTransaction(
              records.channelGone(
                thread.channelId,
                "instagram",
                DateTime.nowUnsafe()
              )
            )
          ).pipe(Effect.orDie, Effect.forkChild);

          // Long enough for the disconnection to reach the lock it waits on.
          yield* Effect.sleep("300 millis");
          yield* Deferred.succeed(go, true);

          assert.strictEqual(yield* Fiber.join(run), "box taken");

          yield* Fiber.join(gone);
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "holds back, once stopped or paused, a private reply journalled whose call was not yet claimed",
    () =>
      Effect.gen(function* holdsBack() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const stopped = yield* instagramRule(workspaceId);
          const paused = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;
          const sql = yield* SqlClient.SqlClient;

          const [onStopped, onTheWay] = yield* received(stopped.thread, [
            { author: 1, text: "price?" },
            { author: 2, text: "price please" },
          ]);

          const [onPaused] = yield* received(paused.thread, [
            { author: 3, text: "price?" },
          ]);

          yield* rules.runDue;
          yield* publicRepliesEnd(workspaceId, "sent");
          yield* rules.runDue;

          assert.strictEqual((yield* privateRepliesIn(workspaceId)).length, 3);

          // One's call is claimed: it may be leaving, so it stays.
          yield* sql`UPDATE engagement.private_replies SET call_claimed_at = now()
            WHERE comment_id = ${onTheWay?.id ?? ""}::uuid`.pipe(Effect.orDie);

          yield* rules.stop(actorIn(workspaceId), stopped.rule.rule.id);
          yield* rules.change(actorIn(workspaceId), paused.rule.rule.id, {
            paused: true,
          });

          assert.deepStrictEqual(
            (yield* privateRepliesIn(workspaceId)).map(
              ({ commentId }) => commentId
            ),
            [String(onTheWay?.id)]
          );
          assert.deepStrictEqual(
            yield* privateOutcomes(workspaceId, stopped.rule.rule.id),
            new Map([
              [onStopped?.id, "stopped"],
              [onTheWay?.id, "made"],
            ])
          );
          assert.deepStrictEqual(
            yield* privateOutcomes(workspaceId, paused.rule.rule.id),
            new Map([[onPaused?.id, "stopped"]])
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live("answers nothing more in public once stopped mid-run", () =>
    Effect.gen(function* stopsPublic() {
      const workspaceId = yield* freshWorkspace;

      yield* Effect.gen(function* checks() {
        const thread = yield* threadOn(workspaceId, "mastodon");
        const rules = yield* CommentRules;
        const sql = yield* SqlClient.SqlClient;

        const rule = yield* rules.start(actorIn(workspaceId), {
          keywords: ["price"],
          reply: "On our site.",
          scope: { _tag: "channel", channelId: thread.channelId },
        });

        yield* Effect.sleep("5 millis");
        yield* received(thread, [{ author: 1, text: "price?" }]);

        const startedBefore = (yield* Ref.get(started)).length;

        // Stopped after the run listed it, before it answers.
        yield* Ref.set(
          meanwhile,
          sql`UPDATE engagement.comment_rules SET status = 'ended', ended_reason = 'stopped', status_at = now() WHERE id = ${rule.rule.id}`.pipe(
            Effect.asVoid,
            Effect.orDie
          )
        );

        assert.strictEqual((yield* rules.runDue).replied, 0);
        assert.strictEqual((yield* Ref.get(started)).length, startedBefore);
      }).pipe(
        Effect.ensuring(Ref.set(meanwhile, Effect.void)),
        Effect.ensuring(forget(workspaceId))
      );
    }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "is refused when it is too long for one channel that could carry it",
    () =>
      Effect.gen(function* tooLongForOne() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const postId = yield* newId(PostIdSchema);
          const instagram = yield* threadOn(workspaceId, "instagram", postId);
          const page = yield* threadOn(workspaceId, "facebook", postId);

          yield* messagesOn(workspaceId, instagram.channelId);
          yield* messagesOn(workspaceId, page.channelId);

          // Within Messenger's 2,000 characters, past Instagram's 1,000
          // bytes.
          const refused = yield* CommentRules.use((rules) =>
            rules.start(actorIn(workspaceId), {
              keywords: ["price"],
              privateReply: "a".repeat(1500),
              reply: "On our site.",
              scope: { _tag: "post", postId },
            })
          ).pipe(Effect.flip);

          assert.deepStrictEqual(
            refused._tag === "CommentRuleNotPossible"
              ? [
                  refused.reason,
                  new Map(
                    refused.channels.map(({ channelId, privateReply }) => [
                      channelId,
                      privateReply,
                    ])
                  ),
                ]
              : [refused._tag],
            [
              "privateReply",
              new Map([
                [instagram.channelId, "textTooLong"],
                [page.channelId, "available"],
              ]),
            ]
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "sends none of those waiting once the rule is stopped, or its channel disconnected",
    () =>
      Effect.gen(function* ends() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const stopped = yield* instagramRule(workspaceId);
          const gone = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;

          const [first] = yield* received(stopped.thread, [
            { author: 1, text: "price?" },
          ]);

          const [second] = yield* received(gone.thread, [
            { author: 2, text: "price?" },
          ]);

          yield* rules.runDue;
          yield* rules.stop(actorIn(workspaceId), stopped.rule.rule.id);

          // Only the rule's own record says what came of the match: the
          // channel's messages go with it.
          const sql = yield* SqlClient.SqlClient;

          yield* EngagementRecords.use((records) =>
            records.channelGone(
              gone.thread.channelId,
              "instagram",
              DateTime.nowUnsafe()
            )
          );

          const codes = yield* sql<{
            readonly commentId: string;
            readonly privateCode: string | null;
          }>`SELECT comment_id AS "commentId", private_code AS "privateCode"
            FROM engagement.comment_rule_matches
            WHERE rule_id IN (${stopped.rule.rule.id}, ${gone.rule.rule.id})`.pipe(
            Effect.orDie
          );

          assert.deepStrictEqual(
            new Map(
              codes.map(({ commentId, privateCode }) => [
                commentId,
                privateCode,
              ])
            ),
            new Map([
              [String(first?.id), "stopped"],
              [String(second?.id), "stopped"],
            ])
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "sends none of those waiting once the rule is paused or loses its text",
    () =>
      Effect.gen(function* paused() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const { rule, thread } = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;

          const [first] = yield* received(thread, [
            { author: 1, text: "price?" },
          ]);

          yield* rules.runDue;
          yield* publicRepliesEnd(workspaceId, "sent");
          yield* rules.change(actorIn(workspaceId), rule.rule.id, {
            paused: true,
          });
          yield* rules.change(actorIn(workspaceId), rule.rule.id, {
            paused: false,
          });
          yield* rules.runDue;

          yield* Effect.sleep("5 millis");

          const [second] = yield* received(thread, [
            { author: 2, text: "price, please" },
          ]);

          yield* rules.runDue;

          const changed = yield* rules.change(
            actorIn(workspaceId),
            rule.rule.id,
            {
              privateReply: null,
            }
          );

          yield* publicRepliesEnd(workspaceId, "sent");
          yield* rules.runDue;

          assert.isTrue(Option.isNone(changed.rule.privateReply));
          assert.deepStrictEqual(yield* privateRepliesIn(workspaceId), []);
          assert.deepStrictEqual(
            yield* privateOutcomes(workspaceId, rule.rule.id),
            new Map([
              [first?.id, "stopped"],
              [second?.id, "stopped"],
            ])
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(Effect.provide(RulesTest))
  );

  it.live(
    "counts the second message: without room for it, the public reply stays and the private one is refused",
    () =>
      Effect.gen(function* noRoom() {
        const workspaceId = yield* freshWorkspace;

        yield* Effect.gen(function* checks() {
          const { rule, thread } = yield* instagramRule(workspaceId);
          const rules = yield* CommentRules;

          const [asks] = yield* received(thread, [
            { author: 1, text: "price?" },
          ]);

          assert.strictEqual((yield* rules.runDue).replied, 1);

          yield* publicRepliesEnd(workspaceId, "sent");
          yield* rules.runDue;

          assert.deepStrictEqual(yield* privateRepliesIn(workspaceId), []);
          assert.deepStrictEqual(
            yield* privateOutcomes(workspaceId, rule.rule.id),
            new Map([[asks?.id, "AllowanceReached"]])
          );
        }).pipe(Effect.ensuring(forget(workspaceId)));
      }).pipe(
        Effect.provide(
          rulesTestWith(
            DrizzleCommentRuleStore,
            fakeMeters({ allowed: Option.some(1) })
          )
        )
      )
  );
});
