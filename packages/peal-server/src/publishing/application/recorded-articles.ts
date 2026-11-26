import { Context, Effect, Layer } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { ChannelId } from "#shared/domain/ids.ts";

/**
 * The posts the articles of a website's channel are known to have made on
 * its site, as the articles context records them: a website's post never
 * adopts one when it looks for its own, while articles and posts both go
 * to websites (until the cutover).
 */
export class RecordedArticles extends Context.Service<
  RecordedArticles,
  {
    /** Those of `platformPostIds` an article of the channel holds. */
    readonly among: (
      channelId: ChannelId,
      platformPostIds: readonly string[]
    ) => Effect.Effect<ReadonlySet<string>, DatabaseError>;
  }
>()("peal-server/publishing/application/RecordedArticles") {
  /** No article is recorded: for tests and servers that send none. */
  static readonly none = Layer.succeed(
    RecordedArticles,
    RecordedArticles.of({ among: () => Effect.succeed(new Set<string>()) })
  );
}
