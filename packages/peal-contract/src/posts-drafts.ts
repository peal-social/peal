import { Schema } from "effect";
import {
  HttpApiEndpoint,
  HttpApiError,
  HttpApiGroup,
  HttpApiSchema,
  OpenApi,
} from "effect/http-api";

import { Authentication } from "./authentication.ts";
import { ChannelSetNotFound } from "./channel-set-not-found.ts";
import { Forbidden } from "./forbidden.ts";
import { PostContentInvalid } from "./post-content-invalid.ts";
import { PostExternalIdTaken } from "./post-external-id-taken.ts";
import { PostNotFound } from "./post-not-found.ts";
import { PostStatusConflict } from "./post-status-conflict.ts";
import {
  defaultDraftPageSize,
  DraftPageSchema,
  maxDraftPageSize,
  PostDraftSchema,
  PostSchema,
} from "./posts.ts";
import { SignatureNotFound } from "./signature-not-found.ts";
import { UnknownChannels } from "./unknown-channels.ts";
import { UnknownMedia } from "./unknown-media.ts";
import { UnknownTags } from "./unknown-tags.ts";
import { WorkspaceAccess } from "./workspace-access.ts";
import { workspaceHeaders } from "./workspace-header.ts";

const post = { postId: Schema.String };

/**
 * A workspace's drafts: posts with no time yet, made, listed and deleted
 * here. Updating and scheduling one go through the posts' own operations.
 */
export class PostDraftsApi extends HttpApiGroup.make("posts.drafts")
  .add(
    HttpApiEndpoint.post("create", "/", {
      error: [
        Forbidden,
        PostContentInvalid,
        UnknownChannels,
        UnknownMedia,
        UnknownTags,
        ChannelSetNotFound,
        SignatureNotFound,
        PostExternalIdTaken,
      ],
      headers: workspaceHeaders,

      payload: PostDraftSchema,
      success: PostSchema.pipe(HttpApiSchema.status(201)),
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Creates a draft for some of the workspace's channels, possibly none yet, with options on those whose platform takes them (`TargetOptions`, of the channel's platform). Its media must be the workspace's, and ready. Its text, media and options are checked against each platform's rules when it is scheduled, not before. It may name channel sets (`channelSets`, by id or name), whose connected channels it is for as well, with the options each set keeps; a channel of a set that is no longer connected is left out, and the answer says so (`warnings`). A channel on which it gives no options takes the channel's default options, if it has some. With `defaultSignatures`, each channel's default signature goes under its text, and `signatureId` puts one signature under it on every channel: a signature is then text of the post, never added under a text that already ends with it. `shortenLinks: true` sends its links shortened where the server has short links (`links.status`), `false` as written; left out, the post takes the workspace's default (`byDefault`) when it is made, and keeps it. Needs post:create, channel:read, and media:read when it shows media.",
        summary: "Create a draft",
      })
    ),
    HttpApiEndpoint.get("list", "/", {
      error: [Forbidden, HttpApiError.BadRequest],
      headers: workspaceHeaders,

      query: {
        cursor: Schema.optionalKey(Schema.String),
        limit: Schema.optionalKey(
          Schema.Int.check(
            Schema.isBetween({ maximum: maxDraftPageSize, minimum: 1 })
          )
        ),
      },
      success: DraftPageSchema,
    }).annotateMerge(
      OpenApi.annotations({
        description: `Lists the workspace's drafts, newest first, ${defaultDraftPageSize} a page unless \`limit\` (at most ${maxDraftPageSize}) says otherwise. Pass the page's \`nextCursor\` as \`cursor\` for the next one. Needs post:read.`,
        summary: "List drafts",
      })
    ),
    HttpApiEndpoint.delete("delete", "/:postId", {
      error: [Forbidden, PostNotFound, PostStatusConflict],
      headers: workspaceHeaders,
      params: post,
      success: HttpApiSchema.NoContent,
    }).annotateMerge(
      OpenApi.annotations({
        description:
          "Deletes a draft. A post scheduled or sent is a conflict: cancel it instead. Needs post:delete, or post:update for the user who created the draft.",
        summary: "Discard a draft",
      })
    )
  )
  .middleware(WorkspaceAccess)
  .middleware(Authentication)
  .prefix("/api/v1/posts/drafts") {}
