import { describe, expect, it } from "@effect/vitest";
import { DateTime, Duration, Option, Result } from "effect";

import { DevtoOptions } from "#publishing/domain/devto-options.ts";
import { HashnodeOptions } from "#publishing/domain/hashnode-options.ts";
import { MastodonOptions } from "#publishing/domain/mastodon-options.ts";
import { emptyContent } from "#publishing/domain/post-content.ts";
import type { PostStatus } from "#publishing/domain/post-status.ts";
import { PostTargetIdSchema } from "#publishing/domain/post-target-id.ts";
import type { PostTargetStatus } from "#publishing/domain/post-target-status.ts";
import {
  cancelTarget,
  heldOnSite,
  missTarget,
  PostTarget,
  publishedBySite,
  repostTarget,
  settleTarget,
  startTarget,
  takenBack,
  withSitePost,
} from "#publishing/domain/post-target.ts";
import { Post } from "#publishing/domain/post.ts";
import {
  afterGivingUp,
  decideHold,
  handOverLead,
  siteUnchanged,
  standingWanted,
  takeBackRetry,
} from "#publishing/domain/site-hold.ts";
import type { HoldStanding } from "#publishing/domain/site-hold.ts";
import type { SitePost } from "#publishing/domain/site-post.ts";
import type { TargetOptions } from "#publishing/domain/target-options.ts";
import { WordPressOptions } from "#publishing/domain/wordpress-options.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import {
  ChannelIdSchema,
  PostIdSchema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import { Schedule } from "#shared/domain/schedule.ts";
import { TimeZoneIdSchema } from "#shared/domain/time-zone.ts";

const utc = (iso: string): DateTime.Utc => DateTime.makeUnsafe(iso);

const postId = PostIdSchema.make("00000000-0000-7000-8000-000000000001");

const workspaceId = WorkspaceIdSchema.make(
  "00000000-0000-7000-8000-000000000002"
);

const at = utc("2026-06-16T09:00:00Z");

const now = utc("2026-06-15T09:00:00Z");

const schedule = new Schedule({
  at,
  timeZone: TimeZoneIdSchema.make("Europe/Paris"),
});

const postIn = (status: PostStatus): Post =>
  new Post({
    authorId: Option.none(),
    content: emptyContent,
    id: postId,
    scheduleRevision: 1,
    status,
    workspaceId,
  });

const posts = {
  awaitingApproval: postIn({ _tag: "awaitingApproval", schedule }),
  cancelled: postIn({
    _tag: "cancelled",
    cancelledAt: now,
    schedule: Option.some(schedule),
  }),
  draft: postIn({ _tag: "draft" }),
  finished: postIn({
    _tag: "finished",
    finishedAt: at,
    outcome: "published",
    schedule,
    startedAt: at,
  }),
  publishing: postIn({ _tag: "publishing", schedule, startedAt: at }),
  scheduled: postIn({ _tag: "scheduled", schedule }),
};

const sitePost: SitePost = {
  permalink: "https://site.example/?p=7",
  platformPostId: PlatformPostIdSchema.make("7"),
  publishAt: at,
};

const wordpress = new WordPressOptions({ title: "A synthetic article" });

const targetWith = (
  options: Option.Option<TargetOptions>,
  {
    onSite,
    round = 1,
    status = { _tag: "pending" },
  }: {
    readonly onSite?: SitePost;
    readonly round?: number;
    readonly status?: PostTargetStatus;
  } = {}
): PostTarget => {
  const target = new PostTarget({
    channelId: ChannelIdSchema.make("00000000-0000-7000-8000-000000000003"),
    id: PostTargetIdSchema.make("00000000-0000-7000-9000-000000000004"),
    liveParts: [],
    options,
    postId,
    round,
    status,
  });

  return withSitePost(target, Option.fromUndefinedOr(onSite));
};

const onWordPress = (
  settings: Parameters<typeof targetWith>[1] = {}
): PostTarget => targetWith(Option.some(wordpress), settings);

const hold: HoldStanding = { _tag: "hold", at };

describe(standingWanted, () => {
  it("holds a post scheduled a day ahead on a site that publishes it itself", () => {
    expect(standingWanted(posts.scheduled, onWordPress(), now)).toStrictEqual(
      hold
    );
    expect(
      standingWanted(
        posts.scheduled,
        targetWith(Option.some(new DevtoOptions({ title: "On DEV" }))),
        now
      )
    ).toStrictEqual(hold);
  });

  it("hands nothing over closer than its lead, on Hashnode, for a draft status, or elsewhere", () => {
    const soon = DateTime.subtractDuration(
      at,
      Duration.sum(handOverLead, Duration.minutes(-5))
    );

    expect(standingWanted(posts.scheduled, onWordPress(), soon)).toStrictEqual({
      _tag: "none",
    });
    expect(
      standingWanted(
        posts.scheduled,
        targetWith(Option.some(new HashnodeOptions({ title: "Hashnode" }))),
        now
      )
    ).toStrictEqual({ _tag: "none" });
    expect(
      standingWanted(
        posts.scheduled,
        targetWith(
          Option.some(
            new WordPressOptions({ siteStatus: "draft", title: "To finish" })
          )
        ),
        now
      )
    ).toStrictEqual({ _tag: "none" });
    expect(
      standingWanted(
        posts.scheduled,
        targetWith(Option.some(new MastodonOptions({}))),
        now
      )
    ).toStrictEqual({ _tag: "none" });
    expect(
      standingWanted(posts.scheduled, targetWith(Option.none()), now)
    ).toStrictEqual({ _tag: "none" });
  });

  it("keeps a hold for its very time however close it is, and takes back one for another time", () => {
    const soon = DateTime.subtractDuration(at, Duration.minutes(5));

    expect(
      standingWanted(posts.scheduled, onWordPress({ onSite: sitePost }), soon)
    ).toStrictEqual(hold);
    expect(
      standingWanted(
        posts.scheduled,
        onWordPress({
          onSite: { ...sitePost, publishAt: utc("2026-06-17T09:00:00Z") },
        }),
        soon
      )
    ).toStrictEqual({ _tag: "draft" });
  });

  it("takes back a draft or a post awaiting an approval that the site has, and asks nothing otherwise", () => {
    for (const post of [posts.draft, posts.awaitingApproval]) {
      expect(
        standingWanted(post, onWordPress({ onSite: sitePost }), now)
      ).toStrictEqual({ _tag: "draft" });
      expect(standingWanted(post, onWordPress(), now)).toStrictEqual({
        _tag: "none",
      });
    }
  });

  it("removes what the site has of a cancelled post or a dropped target", () => {
    const cancelled: PostTargetStatus = { _tag: "cancelled", cancelledAt: now };

    expect(
      standingWanted(
        posts.cancelled,
        onWordPress({ onSite: sitePost, status: cancelled }),
        now
      )
    ).toStrictEqual({ _tag: "remove" });
    expect(
      standingWanted(
        posts.scheduled,
        onWordPress({
          onSite: sitePost,
          status: { ...cancelled, dropped: true },
        }),
        now
      )
    ).toStrictEqual({ _tag: "remove" });
    expect(
      standingWanted(posts.cancelled, onWordPress({ status: cancelled }), now)
    ).toStrictEqual({ _tag: "none" });
  });

  it("leaves a publishing or finished post to the target's own job", () => {
    for (const post of [posts.publishing, posts.finished]) {
      expect(
        standingWanted(post, onWordPress({ onSite: sitePost }), now)
      ).toStrictEqual({ _tag: "none" });
    }
  });
});

describe(decideHold, () => {
  const context = {
    earlier: { rateLimited: 0, unavailable: 0 },
    heldFor: Option.none<DateTime.Utc>(),
    now,
    startedAt: now,
    wanted: hold,
  };

  it("ends once the site answered, had nothing to change, or may have the post", () => {
    expect(
      decideHold(
        { _tag: "published", platformPostId: PlatformPostIdSchema.make("7") },
        context
      )
    ).toStrictEqual({ _tag: "done" });
    expect(
      decideHold({ _tag: "unconfirmed", reason: "noResponse" }, context)
    ).toStrictEqual({ _tag: "done" });
    expect(
      decideHold(new BadRequest({ code: siteUnchanged }), context)
    ).toStrictEqual({ _tag: "done" });
  });

  it("tries an outage again as the posts' policy does, then gives a hold up", () => {
    expect(decideHold(new PlatformUnavailable(), context)).toStrictEqual({
      _tag: "retry",
      delay: Duration.minutes(1),
    });
    expect(
      decideHold(new PlatformUnavailable(), {
        ...context,
        earlier: { rateLimited: 0, unavailable: 5 },
      })
    ).toStrictEqual({ _tag: "gaveUp" });
    expect(
      decideHold(new BadRequest({ code: "wordpress:rest_cannot_create" }), {
        ...context,
      })
    ).toStrictEqual({ _tag: "gaveUp", code: "wordpress:rest_cannot_create" });
  });

  it("tries a take-back the site does not answer every hour until its time, then says the site kept it", () => {
    const takeBack = {
      ...context,
      heldFor: Option.some(at),
      wanted: { _tag: "draft" } as const,
    };

    expect(
      decideHold(new BadRequest({ code: "wordpress:rest_forbidden" }), takeBack)
    ).toStrictEqual({ _tag: "retry", delay: takeBackRetry });
    expect(
      afterGivingUp(Option.none(), {
        ...takeBack,
        now: DateTime.subtractDuration(at, Duration.minutes(20)),
      })
    ).toStrictEqual({ _tag: "retry", delay: Duration.minutes(20) });
    expect(
      afterGivingUp(Option.none(), { ...takeBack, now: at })
    ).toStrictEqual({ _tag: "kept", at });
  });
});

describe("a target its site holds", () => {
  const held = onWordPress({ onSite: sitePost, round: 2 });

  it("is held for its very time only", () => {
    expect(heldOnSite(held, at)).toBeTruthy();
    expect(heldOnSite(held, utc("2026-06-16T09:01:00Z"))).toBeFalsy();
    expect(heldOnSite(onWordPress(), at)).toBeFalsy();
  });

  it("keeps the site's post through a start, a miss and a cancel", () => {
    for (const next of [
      startTarget(held, at),
      missTarget(held, at),
      cancelTarget(held, at),
    ]) {
      expect(Result.getOrUndefined(next)?.onSite).toStrictEqual(sitePost);
    }
  });

  it("loses it once published, as the post that went out", () => {
    const started = Result.getOrThrow(startTarget(held, at));

    const settled = settleTarget(
      started,
      { _tag: "published", platformPostId: sitePost.platformPostId },
      at
    );

    expect(Result.getOrUndefined(settled)?.onSite).toBeUndefined();
  });

  it("taken back, keeps the post without its time, or forgets it", () => {
    expect(takenBack(held, true).onSite).toStrictEqual({
      permalink: sitePost.permalink,
      platformPostId: sitePost.platformPostId,
    });
    expect(takenBack(held, false).onSite).toBeUndefined();
    expect(withSitePost(held, Option.none()).onSite).toBeUndefined();
  });

  it("is published by the site at the time it held it for, without a call", () => {
    const published = Result.getOrThrow(
      publishedBySite(Result.getOrThrow(startTarget(held, at)))
    );

    expect(published.status).toStrictEqual({
      _tag: "published",
      bySite: true,
      permalink: Option.some(sitePost.permalink),
      platformPostId: Option.some(sitePost.platformPostId),
      publishedAt: at,
    });
    expect(published.liveParts).toStrictEqual([
      {
        index: 0,
        permalink: Option.some(sitePost.permalink),
        platformPostId: Option.some(sitePost.platformPostId),
        publishedAt: at,
        round: 2,
      },
    ]);
    expect(published.onSite).toBeUndefined();
    expect(Result.isFailure(publishedBySite(onWordPress()))).toBeTruthy();
  });

  it("is sent again in its next round with the site's post kept", () => {
    const failed = onWordPress({
      onSite: { platformPostId: sitePost.platformPostId },
      status: {
        _tag: "failed",
        code: Option.none(),
        failedAt: at,
        reason: "unavailable",
      },
    });

    expect(Result.getOrUndefined(repostTarget(failed))?.onSite).toStrictEqual({
      platformPostId: sitePost.platformPostId,
    });
  });
});
