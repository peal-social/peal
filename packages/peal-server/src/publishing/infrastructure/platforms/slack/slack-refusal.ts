import { Option } from "effect";

import { OutcomeUnknown } from "#publishing/application/outcome-unknown.ts";
import { platformRefusalCodes } from "#publishing/domain/own-refusals.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenRejected } from "#shared/domain/token-rejected.ts";
import {
  isRefusedToken,
  isTransient,
  slackCode,
} from "#shared/infrastructure/platforms/slack-api.ts";
import type { SlackAnswer } from "#shared/infrastructure/platforms/slack-api.ts";

// The codes of `chat.postMessage` that say the app may not post in the
// channel, which the member fixes in Slack: "Cannot post user messages to
// a channel they are not in" (`not_in_channel`: invite the app), the
// channel gone or not one the app sees (`channel_not_found`), "Channel has
// been archived" (`is_archived`), "A workspace preference prevents the
// authenticated user from posting" (`restricted_action`, and its kinds: a
// read-only channel, one that takes threads only or none, a thread
// locked), `posting_to_channel_denied`, `no_permission` and
// `ekm_access_denied` ("Administrators have suspended posting").
const cannotPostCodes: ReadonlySet<string> = new Set([
  "channel_not_found",
  "ekm_access_denied",
  "is_archived",
  "no_permission",
  "not_in_channel",
  "posting_to_channel_denied",
  "restricted_action",
  "restricted_action_non_threadable_channel",
  "restricted_action_read_only_channel",
  "restricted_action_thread_locked",
  "restricted_action_thread_only_channel",
]);

/**
 * The call a refusal answered: posting the message, or uploading its
 * files, whose `no_permission` and `ekm_access_denied` are about the
 * workspace's uploads, not the channel.
 */
export type SlackCall = "post" | "upload";

// The upload methods' refusals of a file, which another file may pass:
// the workspace takes no such uploads, or has no room left.
const mediaCodes: ReadonlySet<string> = new Set([
  "blocked_file_type",
  "file_type_not_allowed",
  "file_upload_size_restricted",
  "file_uploads_disabled",
  "file_uploads_except_images_disabled",
  "storage_limit_reached",
]);

// Slack's own trouble, nothing done: "The service is temporarily
// unavailable", "POST data was missing or truncated".
const notDoneCodes: ReadonlySet<string> = new Set([
  "request_timeout",
  "service_unavailable",
]);

/** A refusal Slack answered, but its own trouble, read from its code. */
export const slackRefusal = (
  code: string,
  call: SlackCall = "post"
): PublishFailure | TokenRejected => {
  // A token Slack no longer takes, one without a scope the call needs, or
  // without the workspace's access, which only connecting again gives.
  if (
    isRefusedToken(code) ||
    code === "missing_scope" ||
    code === "team_access_not_granted"
  ) {
    return new TokenRejected();
  }

  // "Application has posted too many messages" to the channel, for now.
  if (code === "message_limit_exceeded") {
    return new RateLimited({});
  }

  if (call === "post" && cannotPostCodes.has(code)) {
    return new BadRequest({ code: platformRefusalCodes.cannotPost });
  }

  return mediaCodes.has(code)
    ? new MediaRejected({ code: slackCode(code) })
    : new BadRequest({ code: slackCode(code) });
};

/**
 * What an answer that is not a success comes to, for a call that changes
 * nothing anyone sees (an upload, a read): Slack's trouble is Slack
 * unavailable, tried again later.
 */
export const failureOf = (
  answer: Exclude<SlackAnswer, { readonly _tag: "ok" }>,
  call: SlackCall = "post"
): PublishFailure | TokenRejected => {
  if (answer._tag === "limited") {
    return Option.match(answer.retryAfter, {
      onNone: () => new RateLimited({}),
      onSome: (wait) => new RateLimited({ retryAfter: wait }),
    });
  }

  return answer._tag === "unknown" ||
    isTransient(answer.code) ||
    notDoneCodes.has(answer.code)
    ? new PlatformUnavailable()
    : slackRefusal(answer.code, call);
};

/**
 * The same for the call that posts: whatever Slack did is not known
 * after an answer that is not its own, or one of its errors where "part
 * of the operation may have succeeded" (`internal_error`, `fatal_error`),
 * so the message may be there.
 */
export const commitFailureOf = (
  answer: Exclude<SlackAnswer, { readonly _tag: "ok" }>
): OutcomeUnknown | PublishFailure | TokenRejected =>
  answer._tag === "unknown" ||
  (answer._tag === "refused" &&
    isTransient(answer.code) &&
    !notDoneCodes.has(answer.code))
    ? new OutcomeUnknown({ reason: "noResponse" })
    : failureOf(answer);
