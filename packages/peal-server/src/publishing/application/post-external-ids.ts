import { Context, Effect, Layer, Option } from "effect";

import { PostExternalIdTaken } from "#publishing/domain/post-external-id-taken.ts";
import type { PostExternalId } from "#publishing/domain/post-external-id.ts";
import { withExternalId } from "#publishing/domain/post.ts";
import type { DatabaseError } from "#shared/application/database-error.ts";
import { TransactionRunner } from "#shared/application/transaction-runner.ts";
import type { Actor } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";
import type { PostId, WorkspaceId } from "#shared/domain/ids.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";

import type { PostNotFound } from "./post-not-found.ts";
import { PostRepository } from "./post-repository.ts";
import type { PostWithTargets } from "./post-repository.ts";
import { lockInWorkspace } from "./workspace-posts.ts";

/**
 * Succeeds when no post of the workspace that is not cancelled has the
 * external id, but `except` (the post being given it); otherwise
 * PostExternalIdTaken, naming the post that has it. `holderOf` reads the
 * post that has it: `PostRepository.externalIdHolder` for a check,
 * `claimExternalId` in the transaction that gives a post the id, which
 * holds the id until it ends.
 */
export const externalIdFree = (
  workspaceId: WorkspaceId,
  externalId: PostExternalId,
  holderOf: (
    workspaceId: WorkspaceId,
    externalId: PostExternalId
  ) => Effect.Effect<Option.Option<PostId>, DatabaseError>,
  except: Option.Option<PostId> = Option.none()
): Effect.Effect<void, DatabaseError | PostExternalIdTaken> =>
  holderOf(workspaceId, externalId).pipe(
    Effect.flatMap((holder) =>
      Option.isNone(holder) || Option.contains(except, holder.value)
        ? Effect.void
        : Effect.fail(new PostExternalIdTaken({ postId: holder }))
    )
  );

/**
 * Giving a post its caller's own id, or taking it off, whatever its
 * status: the id says nothing to the platforms, as tags do not. Needs
 * post:update.
 */
export class PostExternalIds extends Context.Service<
  PostExternalIds,
  {
    /**
     * The post with this external id instead of the one it had (none
     * takes it off): PostExternalIdTaken when another post that is not
     * cancelled has it.
     */
    readonly set: (
      actor: Actor,
      postId: PostId,
      externalId: Option.Option<PostExternalId>
    ) => Effect.Effect<
      PostWithTargets,
      DatabaseError | MissingPermission | PostExternalIdTaken | PostNotFound
    >;
  }
>()("peal-server/publishing/application/PostExternalIds") {
  static readonly layer = Layer.effect(
    PostExternalIds,
    Effect.gen(function* PostExternalIdsLive() {
      const posts = yield* PostRepository;
      const { transaction } = yield* TransactionRunner;
      const ports = yield* Effect.context<PostRepository>();

      const withPorts = Effect.provideContext(ports);

      const set = Effect.fn("PostExternalIds.set")(function* set(
        actor: Actor,
        postId: PostId,
        externalId: Option.Option<PostExternalId>
      ) {
        yield* Effect.fromResult(authorize(actor, "post:update"));

        return yield* transaction(
          Effect.gen(function* give() {
            // The id's lock before the post's row, as a post made with it
            // takes them.
            if (Option.isSome(externalId)) {
              yield* externalIdFree(
                actor.workspaceId,
                externalId.value,
                posts.claimExternalId,
                Option.some(postId)
              );
            }

            const current = yield* lockInWorkspace(
              actor.workspaceId,
              postId
            ).pipe(withPorts);

            yield* posts.setExternalId(postId, externalId);

            return {
              post: withExternalId(current.post, externalId),
              targets: yield* posts.targets(postId),
            };
          })
        );
      });

      return PostExternalIds.of({ set });
    })
  );
}
