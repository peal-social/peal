import { Context } from "effect";
import type { Option } from "effect";

/**
 * Who signs the welcome, as the operator names them, and a digest of the
 * sender it leaves from, which its idempotency key holds: without a signer,
 * the server sends no welcome.
 */
export class WelcomeSigner extends Context.Service<
  WelcomeSigner,
  {
    readonly name: Option.Option<string>;
    /** The same while the sender's setting is. */
    readonly senderDigest: string;
  }
>()("peal-server/notifications/application/WelcomeSigner") {}
