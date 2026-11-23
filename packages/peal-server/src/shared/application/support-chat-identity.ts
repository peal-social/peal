import { Context, Effect, Layer, Option } from "effect";

/**
 * Signs the email the web app's support chat names a signed-in person
 * with, so the chat provider marks the conversation verified: none where
 * the server holds no identity secret. Only the session's own account
 * email is ever signed (GET /api/me), never an address a caller sends.
 */
export class SupportChatIdentity extends Context.Service<
  SupportChatIdentity,
  {
    readonly sign: (email: string) => Effect.Effect<Option.Option<string>>;
  }
>()("peal-server/shared/application/SupportChatIdentity") {
  /** No identity secret: the chat names people unverified. */
  static readonly none = Layer.succeed(
    SupportChatIdentity,
    SupportChatIdentity.of({ sign: () => Effect.succeed(Option.none()) })
  );
}
