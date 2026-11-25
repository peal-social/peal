import { Schema } from "effect";

import type { UserId } from "#shared/domain/ids.ts";

/**
 * How one check of a new account ended: its welcome went out, it waits for
 * the next check (the address is not confirmed, or the transport refused
 * the email for now), or there is none to send.
 */
export const WelcomeOutcomeSchema = Schema.Literals(["sent", "wait", "skip"]);

export type WelcomeOutcome = typeof WelcomeOutcomeSchema.Type;

/** Names an account's welcome, so it goes once. */
export const welcomeKeyOf = (userId: UserId): string => `welcome:${userId}`;
