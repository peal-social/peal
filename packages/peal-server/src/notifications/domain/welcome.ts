import { Schema } from "effect";

import type { UserId } from "#shared/domain/ids.ts";

/**
 * How one check of a new account ended: its welcome went out, it waits for
 * the next check (the address is not confirmed, or the transport refused
 * the email for a reason a later try may not meet), or there is none to
 * send.
 */
export const WelcomeOutcomeSchema = Schema.Literals(["sent", "wait", "skip"]);

export type WelcomeOutcome = typeof WelcomeOutcomeSchema.Type;

/**
 * Names an account's welcome from one sender, so it goes once: a sender
 * corrected after a refusal is another key, which the transport takes though
 * it may keep the refused one.
 */
export const welcomeKeyOf = (userId: UserId, senderDigest: string): string =>
  `welcome:${userId}:${senderDigest}`;
