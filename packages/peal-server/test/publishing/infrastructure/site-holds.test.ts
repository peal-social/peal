import { assert, describe, it } from "@effect/vitest";
import {
  Context,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Ref,
  Scope,
} from "effect";
import { MessageStorage } from "effect/cluster";
import { SqlClient } from "effect/sql";
import { TestClock } from "effect/testing";

import { PostDrafts } from "#publishing/application/post-drafts.ts";
import { PostScheduling } from "#publishing/application/post-scheduling.ts";
import { SiteHoldNotices } from "#publishing/application/site-hold-notices.ts";
import { ChannelOptions } from "#publishing/domain/channel-options.ts";
import { DevtoOptions } from "#publishing/domain/devto-options.ts";
import { PostContent } from "#publishing/domain/post-content.ts";
import type { PostTarget } from "#publishing/domain/post-target.ts";
import type { TargetOptions } from "#publishing/domain/target-options.ts";
import { WordPressOptions } from "#publishing/domain/wordpress-options.ts";
import { SiteHoldV1 } from "#publishing/infrastructure/workflows/site-hold.ts";
import { newId } from "#shared/application/ids.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { ChannelId, PostId } from "#shared/domain/ids.ts";
import { IdsLive } from "#shared/infrastructure/secure-random-ids.ts";
import { fakeDevTo, gardener } from "#test/channels/fakes/fake-devto.ts";
import type { FakeDevTo } from "#test/channels/fakes/fake-devto.ts";
import { editor, fakeWordPress } from "#test/channels/fakes/fake-wordpress.ts";
import type {
  FakeWordPress,
  FakeWordPressOptions,
} from "#test/channels/fakes/fake-wordpress.ts";
import { Outcomes } from "#test/publishing/infrastructure/recorded-outcomes.ts";
import { actorIn, anyChannelOn } from "#test/publishing/support.ts";

import {
  DatabaseTest,
  deploy,
  eventually,
  isFinished,
  isSuspended,
  newChannel,
  outcomeOf,
  scheduleIn,
  setTime,
  shutDown,
  targetsOf,
  utc,
} from "./harness.ts";
import { siteLiveOn, sitePlatformsOn } from "./site-platforms.ts";
import type { SiteUnderTest } from "./site-platforms.ts";

// A post scheduled for later on a website that publishes it itself is
// handed to the site as soon as it is scheduled (`SiteHoldV1`), follows
// the post as it moves, goes back to draft or is cancelled, and is
// counted published by the site at its time, with no call: through the
// channel gates, the posts' jobs and journal, the site client and the
// adapters, against the loopback WordPress and DEV, on the test's clock.

const timeout = 120_000;

const start = "2026-06-15T07:00:00Z";

/** The targets the site was said to keep, past the time it held them. */
class Kept extends Context.Service<
  Kept,
  {
    readonly told: Effect.Effect<
      readonly { readonly at: DateTime.Utc; readonly target: PostTarget }[]
    >;
  }
>()("test/publishing/Kept") {}

const RecordingKept = Layer.effectContext(
  Effect.gen(function* RecordingKept() {
    const told = yield* Ref.make<
      readonly { readonly at: DateTime.Utc; readonly target: PostTarget }[]
    >([]);

    return Context.make(
      SiteHoldNotices,
      SiteHoldNotices.of({
        kept: (target, at) =>
          Ref.update(told, (all) => [...all, { at, target }]),
      })
    ).pipe(Context.add(Kept, { told: Ref.get(told) }));
  })
);

const wordpressOf = (site: FakeWordPress): SiteUnderTest => ({
  credential: `${editor.login}:${editor.password}`,
  platform: "wordpress",
  root: site.root,
});

const devtoOf = (site: FakeDevTo): SiteUnderTest => ({
  api: site.api,
  credential: gardener.key,
  platform: "devto",
  root: String(gardener.id),
});

// A server over the site, with its drafts, telling the site's kept posts.
const serverOn = (site: SiteUnderTest) =>
  PostDrafts.layer.pipe(
    Layer.provideMerge(
      deploy(
        MessageStorage.layerMemory,
        sitePlatformsOn(site),
        anyChannelOn(site.platform),
        siteLiveOn(site)
      )
    ),
    Layer.provideMerge(RecordingKept),
    Layer.provideMerge(DatabaseTest)
  );

type Server = Layer.Success<ReturnType<typeof serverOn>>;

// Runs `test` on a server over the site, from `start`.
const onServer = <A, E>(
  site: SiteUnderTest,
  test: (channel: ChannelId) => Effect.Effect<A, E, Server>
) =>
  Effect.gen(function* running() {
    const scope = yield* Scope.make();
    const context = yield* Layer.buildWithScope(serverOn(site), scope);
    const channel = yield* newChannel;

    yield* test(channel).pipe(Effect.provideContext(context));
    yield* shutDown(scope);
  });

const workspaceId = newId(WorkspaceIdSchema).pipe(Effect.provide(IdsLive));

const wordpressTitled = new WordPressOptions({ title: "A synthetic article" });

// The post, on `channel`, scheduled for `at` in a workspace of its own.
const scheduled = Effect.fn("test.scheduled")(function* scheduled(
  channels: readonly [ChannelId, ...ChannelId[]],
  at: string,
  options: TargetOptions = wordpressTitled
) {
  const { post } = yield* PostScheduling.use(
    Effect.fnUntraced(function* scheduling(posts) {
      return yield* posts.schedule(actorIn(yield* workspaceId), {
        channelIds: channels,
        content: new PostContent({
          media: [],
          overrides: [],
          text: "Held by the site until its time.",
        }),
        options: channels.map(
          (channelId) => new ChannelOptions({ channelId, options })
        ),
        schedule: scheduleIn(at),
      });
    })
  );

  return post;
});

// The target of a post of one channel.
const theTarget = (postId: PostId) =>
  targetsOf(postId).pipe(
    Effect.flatMap(([target]) =>
      target === undefined
        ? Effect.die("The post has no target")
        : Effect.succeed(target)
    )
  );

// Whether the target's site holds its post for `at`.
const heldFor = (postId: PostId, at: string) =>
  theTarget(postId).pipe(
    Effect.map(({ onSite }) =>
      Option.exists(Option.fromUndefinedOr(onSite?.publishAt), (when) =>
        DateTime.Equivalence(when, utc(at))
      )
    )
  );

// Whether the target's latest hand-over waits on a clock.
const handOverWaits = (target: PostTarget) =>
  Effect.gen(function* waiting() {
    const sql = yield* SqlClient.SqlClient;

    const [row] = yield* sql<{
      readonly site_hand_overs: number;
    }>`SELECT site_hand_overs FROM publishing.post_targets WHERE id = ${target.id}`.pipe(
      Effect.orDie
    );

    const executionId = yield* SiteHoldV1.executionId({
      channelId: target.channelId,
      handOver: row?.site_hand_overs ?? 0,
      targetId: target.id,
    });

    const result = yield* SiteHoldV1.poll(executionId);

    return Option.isSome(result) && result.value._tag === "Suspended";
  });

// The status of the site's post of that id.
const statusOf = (site: FakeWordPress, id: string | undefined) =>
  site.posts().find((made) => String(made.id) === id)?.status;

// The changes Peal asked of the site's posts it made.
const tries = (site: FakeWordPress) =>
  site
    .requests()
    .filter(
      ({ method, route }) =>
        method === "POST" && /^\/wp\/v2\/posts\/\d+$/u.test(route)
    ).length;

const wordpressStanding = (site: FakeWordPress) =>
  site.posts().map(({ date_gmt, status }) => ({ date_gmt, status }));

const postRequests = (site: FakeWordPress) =>
  site
    .requests()
    .filter(
      ({ method, route }) =>
        method !== "GET" && route.startsWith("/wp/v2/posts")
    ).length;

describe("a post its website holds", () => {
  it.effect(
    "is on the site as soon as it is scheduled, and published by the site at its time with no call",
    () =>
      Effect.gen(function* handedOver() {
        yield* setTime(start);

        const site = yield* fakeWordPress();

        yield* onServer(wordpressOf(site), (channel) =>
          Effect.gen(function* checks() {
            const post = yield* scheduled([channel], "2026-06-15T08:00:00Z");

            yield* eventually(
              "the site holds it",
              heldFor(post.id, "2026-06-15T08:00:00Z")
            );
            yield* eventually("the job sleeps", isSuspended(post.id));

            assert.deepStrictEqual(wordpressStanding(site), [
              { date_gmt: "2026-06-15T08:00:00", status: "future" },
            ]);

            const [made] = site.posts();
            const held = yield* theTarget(post.id);

            assert.strictEqual(held.status._tag, "pending");
            assert.strictEqual(held.onSite?.platformPostId, String(made?.id));

            const before = postRequests(site);

            yield* setTime("2026-06-15T08:00:00Z");
            yield* eventually("the post finishes", isFinished(post.id));

            assert.strictEqual(yield* outcomeOf(post.id), "published");

            const target = yield* theTarget(post.id);

            assert(target.status._tag === "published");
            assert.isTrue(target.status.bySite);
            assert.deepStrictEqual(
              target.status.platformPostId,
              Option.some(String(made?.id))
            );
            assert.deepStrictEqual(
              target.status.publishedAt,
              utc("2026-06-15T08:00:00Z")
            );

            // No call at its time: the site's own scheduler published it.
            assert.strictEqual(postRequests(site), before);
            assert.strictEqual(site.posts()[0]?.status, "publish");

            // Told once, as published.
            const told = (yield* Outcomes.use(({ told: all }) => all)).filter(
              ({ id }) => id === target.id
            );

            assert.deepStrictEqual(
              told.map(({ status }) => status._tag),
              ["published"]
            );
          })
        );
      }).pipe(Effect.scoped),
    timeout
  );

  it.effect(
    "is re-dated as the post moves, taken back to a draft, held again and taken off once cancelled, always one post",
    () =>
      Effect.gen(function* follows() {
        yield* setTime(start);

        const site = yield* fakeWordPress();

        yield* onServer(wordpressOf(site), (channel) =>
          Effect.gen(function* checks() {
            const post = yield* scheduled([channel], "2026-06-15T08:00:00Z");
            const scheduling = yield* PostScheduling;
            const owner = actorIn(post.workspaceId);

            yield* eventually(
              "the site holds it",
              heldFor(post.id, "2026-06-15T08:00:00Z")
            );

            yield* scheduling.reschedule(
              owner,
              post.id,
              scheduleIn("2026-06-15T09:00:00Z")
            );
            yield* scheduling.reschedule(
              owner,
              post.id,
              scheduleIn("2026-06-15T10:00:00Z")
            );

            yield* eventually(
              "the site holds it for its last time",
              heldFor(post.id, "2026-06-15T10:00:00Z")
            );

            assert.deepStrictEqual(wordpressStanding(site), [
              { date_gmt: "2026-06-15T10:00:00", status: "future" },
            ]);

            yield* scheduling.unschedule(owner, post.id);

            yield* eventually(
              "the site keeps it as a draft",
              Effect.sync(() => site.posts()[0]?.status === "draft")
            );
            yield* eventually(
              "the target says so",
              theTarget(post.id).pipe(
                Effect.map(
                  ({ onSite }) =>
                    onSite !== undefined && onSite.publishAt === undefined
                )
              )
            );

            yield* scheduling.scheduleDraft(owner, post.id, {
              channelIds: [channel],
              schedule: scheduleIn("2026-06-15T09:30:00Z"),
            });

            yield* eventually(
              "the site holds the same post again",
              heldFor(post.id, "2026-06-15T09:30:00Z")
            );

            assert.deepStrictEqual(wordpressStanding(site), [
              { date_gmt: "2026-06-15T09:30:00", status: "future" },
            ]);

            yield* scheduling.cancel(owner, post.id);

            yield* eventually(
              "the site's post is taken off",
              Effect.sync(() => site.posts()[0]?.status === "trash")
            );
            yield* eventually(
              "the target holds nothing there",
              theTarget(post.id).pipe(
                Effect.map(({ onSite }) => onSite === undefined)
              )
            );

            assert.lengthOf(site.posts(), 1);
          })
        );
      }).pipe(Effect.scoped),
    timeout
  );

  it.effect(
    "is taken off the site when its channel is dropped, and when its draft is deleted",
    () =>
      Effect.gen(function* takenOff() {
        yield* setTime(start);

        const site = yield* fakeWordPress();

        yield* onServer(wordpressOf(site), (channel) =>
          Effect.gen(function* checks() {
            const other = yield* newChannel;

            const post = yield* scheduled(
              [channel, other],
              "2026-06-15T08:00:00Z"
            );

            const owner = actorIn(post.workspaceId);

            yield* eventually(
              "the site holds both",
              targetsOf(post.id).pipe(
                Effect.map((targets) =>
                  targets.every(({ onSite }) => onSite?.publishAt !== undefined)
                )
              )
            );

            const dropped = (yield* targetsOf(post.id)).find(
              ({ channelId }) => channelId === other
            );

            assert(dropped !== undefined);

            yield* PostScheduling.use((scheduling) =>
              scheduling.dropTarget(owner, post.id, dropped.id)
            );

            yield* eventually(
              "the dropped channel's post is taken off",
              Effect.sync(
                () => statusOf(site, dropped.onSite?.platformPostId) === "trash"
              )
            );

            yield* PostScheduling.use((scheduling) =>
              scheduling.unschedule(owner, post.id)
            );

            const [kept] = yield* targetsOf(post.id);

            yield* eventually(
              "the other is taken back",
              Effect.sync(
                () => statusOf(site, kept?.onSite?.platformPostId) === "draft"
              )
            );

            yield* PostDrafts.use((drafts) => drafts.discard(owner, post.id));

            yield* eventually(
              "the deleted draft's post is taken off",
              Effect.sync(
                () => statusOf(site, kept?.onSite?.platformPostId) === "trash"
              )
            );
          })
        );
      }).pipe(Effect.scoped),
    timeout
  );

  it.effect(
    "is not handed over closer to its time than the lead, and goes out then as any post",
    () =>
      Effect.gen(function* tooClose() {
        yield* setTime("2026-06-15T07:50:00Z");

        const site = yield* fakeWordPress();

        yield* onServer(wordpressOf(site), (channel) =>
          Effect.gen(function* checks() {
            const post = yield* scheduled([channel], "2026-06-15T08:00:00Z");

            yield* eventually("the job sleeps", isSuspended(post.id));

            assert.lengthOf(site.posts(), 0);

            yield* setTime("2026-06-15T08:00:00Z");
            yield* eventually("the post finishes", isFinished(post.id));

            const target = yield* theTarget(post.id);

            assert(target.status._tag === "published");
            assert.isUndefined(target.status.bySite);
            assert.deepStrictEqual(
              wordpressStanding(site).map(({ status }) => status),
              ["publish"]
            );
          })
        );
      }).pipe(Effect.scoped),
    timeout
  );

  it.effect(
    "follows the post through a site outage: whichever call runs last, the site ends held",
    () =>
      Effect.gen(function* outage() {
        yield* setTime(start);

        let down = false;

        const options: FakeWordPressOptions = {
          intercept: (request) =>
            down &&
            request.method === "POST" &&
            /^\/wp\/v2\/posts\/\d+$/u.test(request.route)
              ? { body: "upstream down", status: 503 }
              : undefined,
        };

        const site = yield* fakeWordPress(options);

        yield* onServer(wordpressOf(site), (channel) =>
          Effect.gen(function* checks() {
            const post = yield* scheduled([channel], "2026-06-15T08:00:00Z");
            const owner = actorIn(post.workspaceId);
            const scheduling = yield* PostScheduling;

            yield* eventually(
              "the site holds it",
              heldFor(post.id, "2026-06-15T08:00:00Z")
            );

            // The take-back meets the outage, and waits to try again.
            down = true;
            yield* scheduling.unschedule(owner, post.id);
            yield* eventually(
              "the take-back was refused",
              Effect.sync(() =>
                site
                  .requests()
                  .some(
                    ({ method, route }) =>
                      method === "POST" && /^\/wp\/v2\/posts\/\d+$/u.test(route)
                  )
              )
            );

            yield* scheduling.scheduleDraft(owner, post.id, {
              channelIds: [channel],
              schedule: scheduleIn("2026-06-15T08:30:00Z"),
            });

            down = false;
            yield* TestClock.adjust(Duration.minutes(2));

            yield* eventually(
              "the site holds it for its new time",
              heldFor(post.id, "2026-06-15T08:30:00Z")
            );

            // The take-back's job, woken last, asks for the same hold.
            yield* TestClock.adjust(Duration.minutes(2));
            yield* eventually(
              "the site stays held",
              Effect.sync(
                () =>
                  site.posts()[0]?.status === "future" &&
                  site.posts()[0]?.date_gmt === "2026-06-15T08:30:00"
              )
            );

            assert.lengthOf(site.posts(), 1);
          })
        );
      }).pipe(Effect.scoped),
    timeout
  );

  it.effect(
    "whose hand-over's answer was lost is found on the site at its time and adopted, never made twice",
    () =>
      Effect.gen(function* lost() {
        yield* setTime(start);

        let dropped = false;

        const site = yield* fakeWordPress({
          drop: (request) => {
            if (
              dropped ||
              request.method !== "POST" ||
              request.route !== "/wp/v2/posts"
            ) {
              return false;
            }

            dropped = true;

            return true;
          },
        });

        yield* onServer(wordpressOf(site), (channel) =>
          Effect.gen(function* checks() {
            const post = yield* scheduled([channel], "2026-06-15T08:00:00Z");

            yield* eventually(
              "the site made it",
              Effect.sync(() => site.posts().length === 1)
            );
            yield* eventually("the job sleeps", isSuspended(post.id));

            // The answer was lost: nothing is recorded.
            yield* eventually(
              "the hand-over ends",
              Effect.sync(() => dropped)
            );

            yield* setTime("2026-06-15T08:00:00Z");
            yield* eventually("the post finishes", isFinished(post.id));

            const target = yield* theTarget(post.id);

            assert.strictEqual(target.status._tag, "published");
            assert.lengthOf(site.posts(), 1);
          })
        );
      }).pipe(Effect.scoped),
    timeout
  );

  it.effect(
    "whose hand-over the site refuses goes out at its time, and fails there with the site's code",
    () =>
      Effect.gen(function* refused() {
        yield* setTime(start);

        const site = yield* fakeWordPress({
          intercept: (request) =>
            request.method === "POST" && request.route === "/wp/v2/posts"
              ? {
                  body: {
                    code: "rest_cannot_create",
                    data: { status: 403 },
                    message: "Sorry, you are not allowed to create posts.",
                  },
                  status: 403,
                }
              : undefined,
        });

        yield* onServer(wordpressOf(site), (channel) =>
          Effect.gen(function* checks() {
            const post = yield* scheduled([channel], "2026-06-15T08:00:00Z");

            yield* eventually(
              "the site refused it",
              Effect.sync(() => postRequests(site) > 0)
            );
            yield* eventually("the job sleeps", isSuspended(post.id));

            const before = postRequests(site);

            yield* setTime("2026-06-15T08:00:00Z");
            yield* eventually("the post finishes", isFinished(post.id));

            const target = yield* theTarget(post.id);

            assert(target.status._tag === "failed");
            assert.strictEqual(target.status.reason, "contentRejected");
            assert.deepStrictEqual(
              target.status.code,
              Option.some("wordpress:rest_cannot_create")
            );
            // Tried again at its time.
            assert.isAbove(postRequests(site), before);
          })
        );
      }).pipe(Effect.scoped),
    timeout
  );

  it.effect(
    "taken back while the site never answers, is tried again until its time, then told kept",
    () =>
      Effect.gen(function* kept() {
        yield* setTime(start);

        let down = false;

        const site = yield* fakeWordPress({
          intercept: (request) =>
            down && request.method !== "GET"
              ? { body: "upstream down", status: 503 }
              : undefined,
        });

        yield* onServer(wordpressOf(site), (channel) =>
          Effect.gen(function* checks() {
            const post = yield* scheduled([channel], "2026-06-15T08:00:00Z");

            yield* eventually(
              "the site holds it",
              heldFor(post.id, "2026-06-15T08:00:00Z")
            );

            down = true;
            yield* PostScheduling.use((scheduling) =>
              scheduling.unschedule(actorIn(post.workspaceId), post.id)
            );

            const target = yield* theTarget(post.id);

            yield* eventually(
              "the take-back is tried",
              Effect.sync(() => tries(site) > 0)
            );

            // The outage's tries, each once its wait is over.
            for (const wait of [1, 5, 15]) {
              const seen = tries(site);

              yield* eventually("the take-back waits", handOverWaits(target));
              yield* TestClock.adjust(Duration.minutes(wait));
              yield* eventually(
                "the take-back is tried again",
                Effect.sync(() => tries(site) > seen)
              );
            }

            // The next wait ends past the site's time: no call is made.
            const before = tries(site);

            yield* eventually("the take-back waits", handOverWaits(target));
            yield* TestClock.adjust(Duration.hours(1));

            yield* eventually(
              "the site is said to have kept it",
              Kept.use(({ told }) => told).pipe(
                Effect.map((all) =>
                  all.some((one) => one.target.id === target.id)
                )
              )
            );

            const told = (yield* Kept.use(({ told: all }) => all)).filter(
              (one) => one.target.id === target.id
            );

            assert.lengthOf(told, 1);
            assert.deepStrictEqual(told[0]?.at, utc("2026-06-15T08:00:00Z"));
            assert.strictEqual(tries(site), before);

            // The draft still says the site holds it for then.
            assert.isTrue(yield* heldFor(post.id, "2026-06-15T08:00:00Z"));
          })
        );
      }).pipe(Effect.scoped),
    timeout
  );

  it.effect(
    "is published where its site held it when the server was down at its time, and missed where it did not",
    () =>
      Effect.gen(function* down() {
        yield* setTime(start);

        const site = yield* fakeWordPress();
        const on = wordpressOf(site);
        const storage = yield* Layer.build(MessageStorage.MemoryDriver.layer);
        const database = yield* Layer.build(DatabaseTest);
        const driver = Context.get(storage, MessageStorage.MemoryDriver);

        // One server, built twice over the same storage: a restart.
        const server = deploy(
          Layer.succeed(MessageStorage.MessageStorage, driver.storage),
          sitePlatformsOn(on),
          anyChannelOn("wordpress"),
          siteLiveOn(on)
        ).pipe(Layer.provideMerge(Layer.succeedContext(database)));

        const held = yield* newChannel;
        const notHeld = yield* newChannel;

        const before = yield* Scope.make();
        const first = yield* Layer.buildWithScope(server, before);

        const post = yield* Effect.gen(function* scheduling() {
          const { post: made } = yield* PostScheduling.use(
            Effect.fnUntraced(function* schedule(posts) {
              return yield* posts.schedule(actorIn(yield* workspaceId), {
                channelIds: [held, notHeld],
                content: new PostContent({
                  media: [],
                  overrides: [],
                  text: "Held by one site, sent to the other at its time.",
                }),
                options: [
                  new ChannelOptions({
                    channelId: held,
                    options: wordpressTitled,
                  }),
                  // A draft to finish there is never handed over ahead.
                  new ChannelOptions({
                    channelId: notHeld,
                    options: new WordPressOptions({
                      siteStatus: "draft",
                      title: "A draft to finish there",
                    }),
                  }),
                ],
                schedule: scheduleIn("2026-06-15T08:00:00Z"),
              });
            })
          );

          yield* eventually(
            "the site holds one",
            targetsOf(made.id).pipe(
              Effect.map((targets) =>
                targets.some(({ onSite }) => onSite?.publishAt !== undefined)
              )
            )
          );
          yield* eventually("the job sleeps", isSuspended(made.id));

          return made;
        }).pipe(Effect.provideContext(first));

        yield* shutDown(before);
        yield* setTime("2026-06-15T09:30:00Z");

        const after = yield* Scope.make();
        const second = yield* Layer.buildWithScope(server, after);

        yield* Effect.gen(function* checks() {
          yield* eventually("the post finishes", isFinished(post.id));

          const targets = yield* targetsOf(post.id);
          const onHeld = targets.find(({ channelId }) => channelId === held);

          const onOther = targets.find(
            ({ channelId }) => channelId === notHeld
          );

          assert(onHeld?.status._tag === "published");
          assert.isTrue(onHeld.status.bySite);
          assert.deepStrictEqual(
            onHeld.status.publishedAt,
            utc("2026-06-15T08:00:00Z")
          );
          assert(onOther?.status._tag === "failed");
          assert.strictEqual(onOther.status.reason, "missed");
          assert.strictEqual(yield* outcomeOf(post.id), "partiallyPublished");
        }).pipe(Effect.provideContext(second));

        yield* shutDown(after);
      }).pipe(Effect.scoped),
    timeout
  );

  it.effect(
    "on DEV, is held, re-dated and taken back",
    () =>
      Effect.gen(function* devto() {
        yield* setTime(start);

        const site = yield* fakeDevTo();

        yield* onServer(devtoOf(site), (channel) =>
          Effect.gen(function* checks() {
            const post = yield* scheduled(
              [channel],
              "2026-06-15T08:00:00Z",
              new DevtoOptions({ title: "A synthetic article" })
            );

            const owner = actorIn(post.workspaceId);
            const scheduling = yield* PostScheduling;

            const standing = () =>
              site.articles().map(({ published, published_at }) => ({
                published,
                published_at,
              }));

            yield* eventually(
              "DEV holds it",
              heldFor(post.id, "2026-06-15T08:00:00Z")
            );

            assert.deepStrictEqual(standing(), [
              { published: true, published_at: "2026-06-15T08:00:00.000Z" },
            ]);

            // DEV takes one write a second.
            yield* TestClock.adjust(Duration.seconds(2));
            yield* scheduling.reschedule(
              owner,
              post.id,
              scheduleIn("2026-06-15T09:00:00Z")
            );
            yield* eventually(
              "DEV holds it for its new time",
              heldFor(post.id, "2026-06-15T09:00:00Z")
            );

            assert.deepStrictEqual(standing(), [
              { published: true, published_at: "2026-06-15T09:00:00.000Z" },
            ]);

            yield* TestClock.adjust(Duration.seconds(2));
            yield* scheduling.unschedule(owner, post.id);
            yield* eventually(
              "DEV keeps it as a draft",
              Effect.sync(() => site.articles()[0]?.published === false)
            );

            assert.lengthOf(site.articles(), 1);
          })
        );
      }).pipe(Effect.scoped),
    timeout
  );
});
