import { Context } from "effect";
import type { Effect } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { Actor } from "#shared/domain/access.ts";
import type { MediaAssetId } from "#shared/domain/ids.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";

/** A file of the library an article may show. */
export interface ArticleFile {
  readonly contentType: string;
  readonly mediaId: MediaAssetId;
}

/**
 * The files of the library articles may show: those of the actor's
 * workspace that the media context stored and probed, ready to go out.
 */
export class ArticleMedia extends Context.Service<
  ArticleMedia,
  {
    /** The files among `mediaIds` the actor's articles may show; an id that names none is left out. */
    readonly lookUp: (
      actor: Actor,
      mediaIds: readonly MediaAssetId[]
    ) => Effect.Effect<
      readonly ArticleFile[],
      DatabaseError | MissingPermission
    >;
  }
>()("peal-server/articles/application/ArticleMedia") {}
