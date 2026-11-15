import { Context, Effect, Layer, Ref } from "effect";

/**
 * What a fake platform's sign-in does before it answers, as a connect
 * link's completion runs it, holding the link: nothing, unless a test
 * holds it there while something else asks for the link.
 */
export class SignInHold extends Context.Service<
  SignInHold,
  Ref.Ref<Effect.Effect<void>>
>()("peal-server/test/SignInHold") {
  static readonly layerTest = Layer.effect(
    SignInHold,
    Ref.make<Effect.Effect<void>>(Effect.void)
  );
}
