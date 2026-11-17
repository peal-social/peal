// What the articles' integration tests share: an article's content, a
// member who may do everything with it, and the article sent to a fresh
// site on a fresh server.
import { assert } from "@effect/vitest";
import { DateTime, Duration, Effect, Option } from "effect";
import type { Layer, Scope } from "effect";
import { MessageStorage, Sharding } from "effect/cluster";
import { TestClock } from "effect/testing";

import { ArticleStore } from "#publishing/application/article-store.ts";
import { Articles } from "#publishing/application/articles.ts";
import { ArticleContent } from "#publishing/domain/article-content.ts";
import type { ArticleId } from "#publishing/domain/article-id.ts";
import type { Article } from "#publishing/domain/article.ts";
import { TimeZoneIdSchema } from "#shared/domain/time-zone.ts";
import { fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import type {
  FakeWordPress,
  FakeWordPressOptions,
} from "#test/channels/fakes/fake-wordpress.ts";
import { actorIn, freshWorkspace } from "#test/channels/support.ts";
import {
  ArticleServerTest,
  bodyImage,
  coverImage,
  siteChannel,
} from "#test/publishing/article-server.ts";
import {
  eventually,
  setTime,
} from "#test/publishing/infrastructure/harness.ts";

export const zone = TimeZoneIdSchema.make("Europe/Paris");

export const content = (fields: Partial<ArticleContent> = {}) =>
  new ArticleContent({
    body: {
      content: [
        {
          attrs: { level: 2 },
          content: [{ text: "Sow early", type: "text" }],
          type: "heading",
        },
        {
          content: [{ text: "Peas & beans <first>.", type: "text" }],
          type: "paragraph",
        },
        {
          attrs: { alt: "A row of peas", mediaId: bodyImage.media.mediaId },
          type: "image",
        },
      ],
      type: "doc",
    },
    categories: ["Uncategorized", "Vegetables"],
    coverMediaId: Option.some(coverImage.media.mediaId),
    excerpt: Option.some("What to sow first."),
    siteStatus: "publish",
    tags: ["peas", "spring"],
    title: "Spring sowing",
    ...fields,
  });

export const writer = (workspaceId: Parameters<typeof actorIn>[0]) =>
  actorIn(workspaceId, [
    "channel:read",
    "post:read",
    "post:create",
    "post:update",
    "post:delete",
    "post:schedule",
    "post:publish",
  ]);

/**
 * Waits until the article's job settled it: no longer scheduled or
 * publishing. Its attempt has then given its channel's turn back, which
 * the site holding its post does not say: an attempt still records the
 * post it made, in its turn, after the site answered, and the channel's
 * next attempt meanwhile finds the turn taken and asks again seconds
 * later, a time `eventually` never moves the clock to.
 */
export const untilSent = (label: string, articleId: ArticleId) =>
  eventually(
    label,
    ArticleStore.use((store) => store.get(articleId)).pipe(
      Effect.map((found) =>
        Option.exists(
          found,
          ({ state }) =>
            state._tag !== "scheduled" && state._tag !== "publishing"
        )
      )
    )
  );

// The article, scheduled now on a fresh site's channel, once its job ended.
export const sentTo = Effect.fn("test.sentTo")(function* sentTo(
  options: FakeWordPressOptions = {},
  fields: Partial<ArticleContent> = {},
  password?: string,
  // What the site holds already, before the article is sent.
  prepare?: (site: FakeWordPress) => void
) {
  const site = yield* fakeWordPress(options);

  prepare?.(site);

  const workspaceId = yield* freshWorkspace;
  const channel = yield* siteChannel(workspaceId, site, password);
  const articles = yield* Articles;
  const actor = writer(workspaceId);

  const article = yield* articles.create(
    actor,
    { channelId: channel.id, content: content(fields) },
    Option.some({ at: Option.none(), timeZone: zone })
  );

  yield* untilSent("the article is sent", article.id);

  const sent = yield* ArticleStore.use((store) => store.get(article.id)).pipe(
    Effect.map(Option.getOrThrow)
  );

  return { actor, channelId: channel.id, sent, site, workspaceId };
});

export const stateOf = (article: Article) => article.state._tag;

// Runs the test on a fresh server, built once the clock is set: built at
// the epoch, the cluster's timers would replay every second up to it.
export const onArticles = <A, E>(
  test: Effect.Effect<
    A,
    E,
    Layer.Success<typeof ArticleServerTest> | Scope.Scope
  >
) =>
  setTime("2026-06-15T07:00:00Z").pipe(
    Effect.andThen(test.pipe(Effect.scoped, Effect.provide(ArticleServerTest)))
  );

/**
 * Waits until `condition` holds, moving the virtual clock a second a
 * round: for what waits on a retry's delay, never past its deadlines
 * while the machine is slow.
 */
export const eventuallyLater = <E, R>(
  label: string,
  condition: Effect.Effect<boolean, E, R>
) =>
  Effect.gen(function* waitingLater() {
    const sharding = yield* Sharding.Sharding;

    for (let round = 0; round < 3000; round += 1) {
      if (yield* condition) {
        return;
      }

      yield* sharding.pollStorage;
      yield* TestClock.adjust(Duration.seconds(1));
      yield* TestClock.withLive(Effect.sleep(Duration.millis(10)));
    }

    assert.fail(`Timed out waiting until ${label}`);
  });

// The earliest instant past `now` that storage holds a request back to:
// a durable clock's wake-up.
const nextWakeUp = (now: number) =>
  MessageStorage.MemoryDriver.use((driver) =>
    Effect.sync(() =>
      Option.fromUndefinedOr(
        [...driver.unprocessed]
          .flatMap((envelope) =>
            envelope._tag === "Request"
              ? [driver.requests.get(envelope.requestId)?.deliverAt ?? now]
              : []
          )
          .filter((deliverAt) => deliverAt > now)
          .toSorted((left, right) => left - right)
          .at(0)
      )
    )
  );

/**
 * Waits, the virtual clock still, until storage holds a durable clock's
 * wake-up later than now, then moves the clock to it and returns it: for
 * a long wait (a scheduled time, a retry's delay) that `eventuallyLater`,
 * a second a round, takes thousands of rounds to reach. The clock lands
 * on the wake-up, never past it, so no deadline after it goes by.
 */
export const untilWokenLater = (label: string) =>
  Effect.gen(function* wakingLater() {
    const sharding = yield* Sharding.Sharding;

    for (let round = 0; round < 1000; round += 1) {
      const wakeUp = yield* nextWakeUp(
        DateTime.toEpochMillis(yield* DateTime.now)
      );

      if (Option.isSome(wakeUp)) {
        yield* TestClock.setTime(wakeUp.value);

        return DateTime.makeUnsafe(wakeUp.value);
      }

      yield* sharding.pollStorage;
      yield* TestClock.withLive(Effect.sleep(Duration.millis(10)));
    }

    return assert.fail(`Timed out waiting until ${label}`);
  });
