import { Context, DateTime, Effect, Layer } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";

import { PostRepository } from "./post-repository.ts";
import type { FreshPost, PostWithTargets } from "./post-repository.ts";

/**
 * The answer of a write, as the post now stands: a use case holds the
 * entities it wrote, which do not know the instant its statements gave
 * `posts.updated_at`. Once it committed, one read takes the post's row,
 * then its targets, so the answer's `updatedAt` is never newer than the
 * state it shows beside it, and that state is at least the write's. What
 * the write tells beside the post (a request's warnings, a replay) stays.
 * A post gone meanwhile keeps what the write held, at the current instant.
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
        Effect.gen(function* stamping() {
          const known = yield* repository.current(
            posts.map(({ post }) => post.id)
          );

          const now = yield* DateTime.now;

          return posts.map((written): A & FreshPost => {
            const stored = known.get(written.post.id);

            return stored === undefined
              ? { ...written, updatedAt: now }
              : {
                  ...written,
                  post: stored.post,
                  targets: stored.targets,
                  updatedAt: stored.updatedAt,
                };
          });
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
