import { Context, DateTime, Effect, Layer } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";

import { PostRepository } from "./post-repository.ts";
import type { FreshPost, PostWithTargets } from "./post-repository.ts";

/**
 * When what a post's answer shows last changed, for the answer of a write:
 * a use case answers the post from the entities it holds, which do not
 * know the instant its statements just wrote (`posts.updated_at`, moved
 * by the database). One read of the rows gives it, at the boundary, after
 * the write; a post gone meanwhile takes the current instant, as it changed
 * then.
 */
export class PostFreshness extends Context.Service<
  PostFreshness,
  {
    readonly stamp: <A extends PostWithTargets>(
      post: A
    ) => Effect.Effect<A & FreshPost, DatabaseError>;
    readonly stampAll: <A extends PostWithTargets>(
      posts: readonly A[]
    ) => Effect.Effect<readonly (A & FreshPost)[], DatabaseError>;
  }
>()("peal-server/publishing/application/PostFreshness") {
  static readonly layer = Layer.effect(
    PostFreshness,
    Effect.gen(function* PostFreshnessLive() {
      const repository = yield* PostRepository;

      const stampAll = <A extends PostWithTargets>(posts: readonly A[]) =>
        Effect.gen(function* stampAll() {
          const known = yield* repository.freshness(
            posts.map(({ post }) => post.id)
          );
          const now = yield* DateTime.now;

          return posts.map(
            (found): A & FreshPost => ({
              ...found,
              updatedAt: known.get(found.post.id) ?? now,
            })
          );
        });

      return PostFreshness.of({
        stamp: (post) =>
          stampAll([post]).pipe(
            Effect.flatMap(([stamped]) =>
              stamped === undefined
                ? Effect.die("A post was not stamped")
                : Effect.succeed(stamped)
            )
          ),
        stampAll,
      });
    })
  );
}
