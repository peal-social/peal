import { Context } from "effect";
import type { DateTime, Effect, Option } from "effect";

import type { MediaAttachment } from "#publishing/domain/media-attachment.ts";
import type { Poll } from "#publishing/domain/poll.ts";
import type { PostTargetId } from "#publishing/domain/post-target-id.ts";
import type { HoldStanding } from "#publishing/domain/site-hold.ts";
import type { SitePost } from "#publishing/domain/site-post.ts";
import type { TargetOptions } from "#publishing/domain/target-options.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { ChannelId, WorkspaceId } from "#shared/domain/ids.ts";
import type { Platform } from "#shared/domain/platform.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import type {
  PlatformPostId,
  PublishResult,
} from "#shared/domain/publish-result.ts";
import type { ArticleBody } from "#shared/domain/rich-text/rich-body.ts";

/**
 * The posts a part after the first answers to, by the ids the platform
 * gave them: the post's first part (`root`) and the part before this one
 * (`parent`, the root itself for the second part). A platform with threads
 * replies to the parent, and names the root where it asks for it; one that
 * takes comments comments on the root.
 */
export interface ReplyReference {
  readonly parent: PlatformPostId;
  readonly root: PlatformPostId;
}

/**
 * A post, or one part of it, as it goes out on one channel, in one
 * attempt.
 */
export interface OutgoingPost {
  /** The account's id on the platform, as the channel stores it. */
  readonly accountId: string;
  /**
   * The channel's own text as a rich text, on a website's first part
   * (`TextOverride.body`); none elsewhere, and where the channel takes the
   * post's text, which a website's client writes as a body
   * (`bodyOfText`).
   */
  readonly body: Option.Option<ArticleBody>;
  readonly channelId: ChannelId;
  /** Unique to the attempt, and the same for every run of it. */
  readonly idempotencyKey: string;
  /** The part's images and videos, in order, with their descriptions. */
  readonly media: readonly MediaAttachment[];
  /**
   * The options the post has on this channel, checked against its platform
   * when it was scheduled. An adapter reads its own platform's, as in
   * `post.options.pipe(Option.filter(Schema.is(YouTubeOptions)))`.
   */
  readonly options: Option.Option<TargetOptions>;
  /** The part's place in the post: 0 for the post itself. */
  readonly part: number;
  /**
   * The poll the post asks, on its first part only, checked against the
   * platform when it was scheduled. An adapter of a platform that takes
   * one (`poll` in `#publishing/domain/platform-rules.ts`) must send it.
   */
  readonly poll: Option.Option<Poll>;
  /**
   * What a part after the first answers to; none for the post itself.
   * An adapter of a platform that takes parts (`followUps` in
   * `#publishing/domain/platform-rules.ts`) must read it.
   */
  readonly replyTo: Option.Option<ReplyReference>;
  /**
   * The target's round: 1 for its first, one more each time it is sent
   * again. A website's client looks, in a new round, for a post an earlier
   * round's call may have made.
   */
  readonly round: number;
  /** When the attempt's call started: the same for every run of it. */
  readonly startedAt: DateTime.Utc;
  /**
   * On a website's target, what the call is to make of the post the site
   * holds for it (`SiteCall`), as the router read the post inside the
   * gate; left out on every other channel, and read as publishing with
   * nothing held.
   */
  readonly site?: SiteCall;
  /** The target the attempt is of: what a website's files are kept by. */
  readonly targetId: PostTargetId;
  /** The part's text on this channel: its own, or its override there. */
  readonly text: string;
  readonly workspaceId: WorkspaceId;
}

/**
 * What a website's call is to do: publish the post at its time, or what a
 * hand-over asks of the site (`#publishing/domain/site-hold.ts`): hold it
 * for a time, keep it as a draft, take it off.
 */
export type SiteCallStanding =
  | Exclude<HoldStanding, { readonly _tag: "none" }>
  | { readonly _tag: "publish" };

/** A website's call, as the router hands it to the site's client. */
export interface SiteCall {
  readonly standing: SiteCallStanding;
  /** The post the site already holds for the target, if any. */
  readonly held: Option.Option<SitePost>;
  /**
   * Records the post the site now holds for the target, or none, as soon
   * as it answered, inside the gate: false when the target is gone or
   * went out meanwhile, which leaves a post just made there for the
   * client to take off.
   */
  readonly record: (
    onSite: Option.Option<SitePost>
  ) => Effect.Effect<boolean, DatabaseError>;
}

/**
 * Publishes on one platform. `publish` and `resume` keep the promises of
 * PlatformPublisher's methods of the same names.
 */
export interface PlatformClient {
  readonly platform: Platform;
  readonly publish: (
    post: OutgoingPost
  ) => Effect.Effect<PublishResult, PublishFailure>;
  readonly resume: (
    post: OutgoingPost
  ) => Effect.Effect<PublishResult, PublishFailure>;
}

/** The platforms this server publishes to. */
export class PlatformClients extends Context.Service<
  PlatformClients,
  {
    /** The platform's client, if Peal publishes there. */
    readonly for: (platform: Platform) => Option.Option<PlatformClient>;
  }
>()("peal-server/publishing/application/PlatformClients") {}
