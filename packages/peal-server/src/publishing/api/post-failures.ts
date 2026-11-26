import { Effect, Option } from "effect";
import {
  ChannelSetNotFound,
  PostContentInvalid,
  PostExternalIdTaken,
  PostNotFound,
  PostStatusConflict,
  SignatureNotFound,
  UnknownChannels,
  UnknownMedia,
  UnknownTags,
} from "peal-contract";

import type { InvalidPostTransition } from "#publishing/domain/invalid-post-transition.ts";
import type { PostContentRejected } from "#publishing/domain/post-content-rejected.ts";
import type { PostExternalIdTaken as ExternalIdTakenError } from "#publishing/domain/post-external-id-taken.ts";

// How the use cases' failures that a post's and a draft's handlers share
// answer.

export const notFound = () => Effect.fail(new PostNotFound());

export const conflict = ({ from }: InvalidPostTransition) =>
  Effect.fail(new PostStatusConflict({ status: from }));

export const contentInvalid = ({ violations }: PostContentRejected) =>
  Effect.fail(new PostContentInvalid({ violations }));

export const unknownChannels = ({
  channelIds,
}: {
  readonly channelIds: readonly string[];
}) => Effect.fail(new UnknownChannels({ channelIds }));

export const unknownMedia = ({
  mediaIds,
}: {
  readonly mediaIds: readonly string[];
}) => Effect.fail(new UnknownMedia({ mediaIds }));

export const unknownTags = ({
  tagIds,
}: {
  readonly tagIds: readonly string[];
}) => Effect.fail(new UnknownTags({ tagIds }));

export const setNotFound = () => Effect.fail(new ChannelSetNotFound());

export const signatureNotFound = () => Effect.fail(new SignatureNotFound());

/** Another post has the external id: the post that has it, by its id. */
export const externalIdTakenBy = ({ postId }: ExternalIdTakenError) =>
  new PostExternalIdTaken({ postId: Option.getOrNull(postId) });

export const externalIdTaken = (taken: ExternalIdTakenError) =>
  Effect.fail(externalIdTakenBy(taken));
