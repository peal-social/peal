import { Context } from "effect";
import type { Option } from "effect";

/**
 * Who signs the welcome, as the operator names them: without a signer, the
 * server sends no welcome.
 */
export class WelcomeSigner extends Context.Service<
  WelcomeSigner,
  { readonly name: Option.Option<string> }
>()("peal-server/notifications/application/WelcomeSigner") {}
