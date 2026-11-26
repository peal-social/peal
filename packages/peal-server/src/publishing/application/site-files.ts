import { Context } from "effect";
import type { Effect } from "effect";

import type { PostTargetId } from "#publishing/domain/post-target-id.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import type { SiteFile } from "#shared/application/site-call-journal.ts";
import type { MediaAssetId } from "#shared/domain/ids.ts";

/**
 * The files a website's target sent to its site: the site's id and
 * address for each of the library's files (`publishing.site_files`), so a
 * later attempt, round or change of the post sends none twice. Rows go
 * with their target.
 */
export class SiteFiles extends Context.Service<
  SiteFiles,
  {
    /** The files the target's site took, by the library's id. */
    readonly sent: (
      targetId: PostTargetId
    ) => Effect.Effect<ReadonlyMap<MediaAssetId, SiteFile>, DatabaseError>;
    /** Records a file the site took. */
    readonly record: (
      targetId: PostTargetId,
      mediaId: MediaAssetId,
      file: SiteFile
    ) => Effect.Effect<void, DatabaseError>;
    /** Forgets a file the site no longer has: it is sent again. */
    readonly forget: (
      targetId: PostTargetId,
      mediaId: MediaAssetId
    ) => Effect.Effect<void, DatabaseError>;
    /** Records that the site drops the file as the featured image. */
    readonly featuredRefused: (
      targetId: PostTargetId,
      mediaId: MediaAssetId
    ) => Effect.Effect<void, DatabaseError>;
  }
>()("peal-server/publishing/application/SiteFiles") {}
