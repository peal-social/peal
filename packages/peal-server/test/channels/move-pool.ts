import { Context, Effect, Layer, Ref } from "effect";

import type { WorkspaceId } from "#shared/domain/ids.ts";
import { freshWorkspace } from "#test/channels/support.ts";

/**
 * The workspaces of the one pool the move tests share, as a partner's
 * count their channels together: a channel moves only among them.
 */
export class MovePool extends Context.Service<
  MovePool,
  Ref.Ref<readonly WorkspaceId[]>
>()("peal-server/test/MovePool") {
  static readonly layerTest = Layer.effect(
    MovePool,
    Ref.make<readonly WorkspaceId[]>([])
  );
}

/** A new workspace, in the pool. */
export const pooledWorkspace = freshWorkspace.pipe(
  Effect.tap((workspaceId) =>
    MovePool.use((pool) => Ref.update(pool, (ids) => [...ids, workspaceId]))
  )
);
