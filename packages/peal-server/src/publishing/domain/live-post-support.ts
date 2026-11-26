import { DateTime, Duration, Option, Schema } from "effect";

import type { Platform } from "#shared/domain/platform.ts";

import { livePartsOf } from "./post-target.ts";
import type { PostTarget } from "./post-target.ts";

/**
 * Why Peal cannot change a post once it is live on a platform:
 *
 * - `noApi`: the platform's API has no call for it.
 * - `permission`: the call exists, but needs a permission Peal does not
 *   ask its members for, which the platform grants after a review.
 * - `unverified`: the call exists, but the platform's documentation does
 *   not say that the permissions Peal holds allow it: Peal does not try it
 *   on members' accounts until that is confirmed.
 *
 * Clients read it in the capabilities (`livePost`): add a member, never
 * rename or remove one.
 */
export const LivePostBlockerSchema = Schema.Literals([
  "noApi",
  "permission",
  "unverified",
]);

export type LivePostBlocker = typeof LivePostBlockerSchema.Type;

/** What Peal can do to a post live on a platform, or why not. */
export interface LivePostAbility {
  /** Why Peal cannot delete a post there; none when it can. */
  readonly unpublish: Option.Option<LivePostBlocker>;
  /** Why Peal cannot replace a post's text there; none when it can. */
  readonly edit: Option.Option<LivePostBlocker>;
}

const can: Option.Option<LivePostBlocker> = Option.none();

const blockedBy = (blocker: LivePostBlocker) => Option.some(blocker);

/**
 * Per platform, whether Peal deletes a published post there, and whether
 * it replaces its text, or what stops it: the one table the capabilities,
 * the use cases and the docs' tables read (`docs/guides/posts/published.mdx`, kept
 * equal by a test). A platform deletes, or edits, only when its adapter
 * is in `LivePostClientsLive`'s registry, which a test compares with this
 * table. Each line cites the page it was read from, on 2026-11-11 (the
 * edit calls re-read on 2026-11-12).
 */
export const livePostSupport = {
  // `com.atproto.repo.deleteRecord`, with the `action=delete` the post
  // scope asks for. https://atproto.com/specs/permission ; the PDS's
  // `api/com/atproto/repo/deleteRecord.ts` answers a record already gone
  // as done, without a commit. Posts have no edit call.
  bluesky: { edit: blockedBy("noApi"), unpublish: can },
  // DEV's `PUT /api/articles/{id}` with `published: false` takes an
  // article down (DEV deletes nothing an API key made). Its edit is the
  // same call, which posts do not make yet: a live article is changed
  // through the articles' update for now.
  // https://developers.forem.com/api/v1#tag/articles/operation/updateArticle
  devto: { edit: blockedBy("unverified"), unpublish: can },
  // `DELETE /webhooks/{webhook.id}/{webhook.token}/messages/{message.id}`
  // ("Returns a 204 No Content response on success") and `PATCH` on the
  // same address ("Edits a previously-sent webhook message from the same
  // token"; "To remove or replace files you will have to supply the
  // attachments field", so an edit that sends none keeps them), each with
  // `thread_id` for a message in a thread. Read 2026-11-16.
  // https://docs.discord.com/developers/resources/webhook
  discord: { edit: can, unpublish: can },
  // Page posts: `DELETE /{page_post_id}` is documented in the Pages API,
  // and the Graph reference says "Only select developers can perform this
  // operation using the API": whether Peal's app may is not known.
  // https://developers.facebook.com/docs/pages-api/posts ,
  // https://developers.facebook.com/docs/graph-api/reference/page-post/
  // An edit is `POST /{page_post_id}` with `message` ("An app can only
  // update a Page post if the post was made using that app."), but the
  // Pages guide lists `pages_manage_engagement` and
  // `pages_read_user_engagement` among its requirements without saying
  // which call needs them, and Peal asks for neither.
  facebook: {
    edit: blockedBy("unverified"),
    unpublish: blockedBy("unverified"),
  },
  // `DELETE https://mybusiness.googleapis.com/v4/{localPost}`, with
  // `business.manage`; NOT_FOUND for a post that does not exist.
  // https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts/delete
  // An edit is `PATCH https://mybusiness.googleapis.com/v4/{localPost}`
  // with `business.manage`: "You must specify each field that is being
  // updated in the mask" (`updateMask=summary`).
  // https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts/patch
  googleBusiness: { edit: can, unpublish: can },
  // Hashnode's `removePost` (`deleteDraft` for a draft) removes it; its
  // edit, `updatePost`, posts do not make yet.
  // https://apidocs.hashnode.com/
  hashnode: { edit: blockedBy("unverified"), unpublish: can },
  // `DELETE /<IG_MEDIA_ID>` needs `instagram_manage_contents` and Facebook
  // Login, which Peal does not ask for; only `comment_enabled` changes.
  // https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-media
  instagram: {
    edit: blockedBy("noApi"),
    unpublish: blockedBy("permission"),
  },
  // `DELETE /rest/posts/{urn}` is documented, but the Posts API page does
  // not say which permission a deletion needs, nor which an update of
  // `commentary` needs (`X-RestLi-Method: PARTIAL_UPDATE`, documented on
  // the same page).
  // https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api
  linkedin: {
    edit: blockedBy("unverified"),
    unpublish: blockedBy("unverified"),
  },
  // `DELETE /api/v1/statuses/:id`, "User token + `write:statuses`", and
  // `PUT /api/v1/statuses/:id` to edit (since 3.5.0), with the same
  // scope. https://docs.joinmastodon.org/methods/statuses/
  mastodon: { edit: can, unpublish: can },
  // `DELETE /v5/pins/{pin_id}` (`pins/delete`), with the `pins:write` and
  // `boards:write` scopes Peal asks for: Pinterest's published API
  // description, https://github.com/pinterest/api-description (v5).
  // `PATCH /v5/pins/{pin_id}` is "currently in beta and not available to
  // all apps" there (v5.28.0): whether Peal's app has it is not known.
  pinterest: { edit: blockedBy("unverified"), unpublish: can },
  // `chat.delete` and `chat.update` (`chat:write`) change a message the
  // app posted, by its channel and `ts`; an update "cannot exceed 4,000
  // characters" of text, and a workspace's settings may close edits
  // (`edit_window_closed`). Read 2026-11-16.
  // https://docs.slack.dev/reference/methods/chat.delete
  // https://docs.slack.dev/reference/methods/chat.update
  slack: { edit: can, unpublish: can },
  // `DELETE /v1/public_profiles/{profile_id}/spotlights/{spotlight_id}`
  // "permanently deletes a Spotlight posted by the profile"
  // (developers.snap.com, Public Profile API, Profile Asset Management,
  // read 2026-11-26). The scopes table says `snapchat-profile-api`
  // "allows the app to read": whether the permission Peal holds covers a
  // deletion is not known. No call edits a Spotlight.
  // https://developers.snap.com/marketing-api/Public-Profile-API/ProfileAssetManagement
  snapchat: { edit: blockedBy("noApi"), unpublish: blockedBy("unverified") },
  // `deleteMessages` ("A JSON-serialized list of 1-100 identifiers of
  // messages to delete"), under `deleteMessage`'s rules: "A message can
  // only be deleted if it was sent less than 48 hours ago", and "Bots
  // granted can_post_messages permissions can delete outgoing messages in
  // channels", "Bots can delete outgoing messages in private chats,
  // groups, and supergroups". `editMessageText` and `editMessageCaption`
  // replace a text or a caption, with no time limit stated for a bot's
  // own message. Bot API 10.4, read 2026-11-16.
  // https://core.telegram.org/bots/api
  telegram: { edit: can, unpublish: can },
  // `DELETE /{threads-media-id}` needs `threads_delete`, which Peal does
  // not ask for; Threads documents no edit call.
  // https://developers.facebook.com/docs/threads/posts/delete-posts
  threads: {
    edit: blockedBy("noApi"),
    unpublish: blockedBy("permission"),
  },
  // The Content Posting API has no call to delete or change a post.
  // https://developers.tiktok.com/doc/content-posting-api-get-started
  tiktok: { edit: blockedBy("noApi"), unpublish: blockedBy("noApi") },
  // `DELETE /wp/v2/posts/{id}` without `force` moves the post to the
  // site's trash ("Whether to bypass Trash and force deletion"), for a
  // user who may delete it, as the application password's is. Its edit,
  // `POST /wp/v2/posts/{id}`, posts do not make yet. WordPress.com runs
  // the same API under `/wp/v2/sites/{id}/`.
  // https://developer.wordpress.org/rest-api/reference/posts/#delete-a-post
  wordpress: { edit: blockedBy("unverified"), unpublish: can },
  wordpressCom: { edit: blockedBy("unverified"), unpublish: can },
  // `DELETE /2/tweets/{id}`, with `tweet.read`, `users.read` and
  // `tweet.write`. https://docs.x.com/x-api/posts/delete-post
  // An edit is `POST /2/tweets` with `edit_options.previous_post_id`
  // ("Edit an existing tweet rather than creating a new one."), and the
  // page says nothing of which posts may be edited, or on which access.
  // https://docs.x.com/x-api/posts/create-post
  x: { edit: blockedBy("unverified"), unpublish: can },
  // `videos.delete` and `videos.update` need `youtube` or
  // `youtube.force-ssl`, not the `youtube.upload` Peal asks for.
  // https://developers.google.com/youtube/v3/docs/videos/delete
  youtube: {
    edit: blockedBy("permission"),
    unpublish: blockedBy("permission"),
  },
} as const satisfies { readonly [P in Platform]: LivePostAbility };

/** Why Peal cannot delete a post live on `platform`; none when it can. */
export const unpublishBlocker = (
  platform: Platform
): Option.Option<LivePostBlocker> => livePostSupport[platform].unpublish;

/** Why Peal cannot replace a post's text on `platform`; none when it can. */
export const editBlocker = (
  platform: Platform
): Option.Option<LivePostBlocker> => livePostSupport[platform].edit;

/**
 * How long after a post went out the platform still deletes it, on a
 * platform that sets a limit: Telegram deletes a bot's message "only if it
 * was sent less than 48 hours ago" (Bot API 10.4, `deleteMessage`, read
 * 2026-11-16). Clients show it as the deletion window.
 */
export const deletionWindows: ReadonlyMap<Platform, Duration.Duration> =
  new Map([["telegram", Duration.hours(48)]]);

/**
 * Whether the platform's deletion window has closed at `now` for any part
 * of the target that is live: each part counts from when it went out, so
 * the oldest decides, and a target whose later parts never went out is
 * judged by those that did. Peal refuses the whole removal before any
 * call, rather than leave a thread half deleted.
 */
export const deletionWindowPassed = (
  target: PostTarget,
  platform: Platform,
  now: DateTime.Utc
): boolean => {
  const window = deletionWindows.get(platform);

  return (
    window !== undefined &&
    livePartsOf(target).some(({ publishedAt }) =>
      DateTime.isGreaterThan(now, DateTime.addDuration(publishedAt, window))
    )
  );
};
