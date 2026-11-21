import { Schema } from "effect";

/**
 * A rule's request acts on a post (`postId`) or on a channel's posts
 * (`channelId`), exactly one of them: either missing, or both given, is
 * refused with its place, so the answer names the field to change.
 */
export const postOrChannel = Schema.makeFilter(
  (request: { readonly channelId?: string; readonly postId?: string }) => {
    if (request.postId !== undefined && request.channelId !== undefined) {
      return {
        issue: "Give postId or channelId, not both",
        path: ["channelId"],
      };
    }

    return (
      request.postId !== undefined ||
      request.channelId !== undefined || {
        issue: "Give postId (one post) or channelId (a channel's posts)",
        path: ["postId"],
      }
    );
  }
);
