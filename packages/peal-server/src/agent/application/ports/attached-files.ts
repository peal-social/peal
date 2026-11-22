import { Context } from "effect";
import type { Effect } from "effect";

import type { MediaRejected } from "#agent/application/media-rejected.ts";
import type { AgentMedia } from "#agent/domain/agent-parts.ts";
import type { Actor } from "#shared/domain/access.ts";

/**
 * The files of the workspace's media library a person attaches to a
 * message, read as they may read them: each must be the workspace's,
 * readable with their permissions, and ready.
 */
export class AttachedFiles extends Context.Service<
  AttachedFiles,
  {
    readonly read: (
      actor: Actor,
      mediaIds: readonly string[]
    ) => Effect.Effect<readonly AgentMedia[], MediaRejected>;
  }
>()("peal-server/agent/application/AttachedFiles") {}
