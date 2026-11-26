import { Effect, Option } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";
import { Api, CurrentMember, defaultDraftPageSize } from "peal-contract";

import { PostDrafts } from "#publishing/application/post-drafts.ts";
import { PostQueries } from "#publishing/application/post-queries.ts";
import { actorOf } from "#shared/api/actor.ts";
import { forbidden } from "#shared/api/forbidden.ts";

import {
  conflict,
  contentInvalid,
  externalIdTaken,
  notFound,
  setNotFound,
  signatureNotFound,
  unknownChannels,
  unknownMedia,
  unknownTags,
} from "./post-failures.ts";
import {
  channelIdsFrom,
  contentFrom,
  draftExternalIdFrom,
  draftTagsFrom,
  optionsFrom,
  postIdFrom,
  postIdOption,
  presetsFrom,
} from "./post-input.ts";
import { freshPostViews, postView } from "./post-view.ts";

// A failure of the server's own (the database, a bug) is a defect: 500.
export const PostDraftsHandlers = HttpApiBuilder.group(
  Api,
  "posts.drafts",
  Effect.fn(function* postDraftsHandlers(handlers) {
    const drafts = yield* PostDrafts;
    const queries = yield* PostQueries;
    const views = yield* freshPostViews;

    return handlers.handleAll({
      create: ({ payload }) =>
        Effect.gen(function* create() {
          const actor = actorOf(yield* CurrentMember);
          const channelIds = yield* channelIdsFrom(payload.channelIds);
          const content = yield* contentFrom(payload.content);
          const options = yield* optionsFrom(payload.options ?? []);
          const filed = yield* draftTagsFrom(payload.tagIds);
          const own = yield* draftExternalIdFrom(payload.externalId);
          const asked = yield* presetsFrom(payload);

          const created = yield* drafts
            .create(actor, {
              channelIds,
              content,
              options,
              presets: asked,
              shortenLinks: payload.shortenLinks,
              ...filed,
              ...own,
            })
            .pipe(
              Effect.catchTags({
                ChannelSetNotFound: setNotFound,
                DatabaseError: Effect.die,
                MissingPermission: forbidden,
                PostContentRejected: contentInvalid,
                PostExternalIdTaken: externalIdTaken,
                SignatureNotFound: signatureNotFound,
                UnknownChannels: unknownChannels,
                UnknownMedia: unknownMedia,
                UnknownTags: unknownTags,
              })
            );

          return yield* views.one(created);
        }),
      delete: ({ params }) =>
        Effect.gen(function* discard() {
          const actor = actorOf(yield* CurrentMember);
          const postId = yield* postIdFrom(params.postId);

          yield* drafts.discard(actor, postId).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              InvalidPostTransition: conflict,
              MissingPermission: forbidden,
              PostNotFound: notFound,
            })
          );
        }),
      list: ({ query }) =>
        Effect.gen(function* listDrafts() {
          const actor = actorOf(yield* CurrentMember);

          // A cursor is the id of the last draft of the page before.
          const after = Option.fromUndefinedOr(query.cursor).pipe(
            Option.map(postIdOption)
          );

          if (Option.isSome(after) && Option.isNone(after.value)) {
            return yield* new HttpApiError.BadRequest();
          }

          const page = yield* queries
            .listDrafts(actor, {
              after: Option.flatten(after),
              limit: query.limit ?? defaultDraftPageSize,
            })
            .pipe(
              Effect.catchTags({
                DatabaseError: Effect.die,
                MissingPermission: forbidden,
              })
            );

          return {
            items: page.items.map(postView),
            nextCursor: Option.getOrNull(page.next),
          };
        }),
    });
  })
);
