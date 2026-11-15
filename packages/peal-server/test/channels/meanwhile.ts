import { Context } from "effect";
import type { Effect, Ref } from "effect";

// What another connection does while a move runs: just before it writes
// (`beforeWrite`), or once it wrote and before it commits (`afterWrite`).
export class Meanwhile extends Context.Service<
  Meanwhile,
  Ref.Ref<{
    readonly afterWrite: Effect.Effect<void>;
    readonly beforeWrite: Effect.Effect<void>;
  }>
>()("peal-server/test/ChannelMovesMeanwhile") {}
