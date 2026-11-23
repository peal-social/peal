import { Schema } from "effect";

/**
 * The account an unclaimed closure was asked for confirmed its address
 * meanwhile: it is its owner's, and is not closed.
 */
export class AccountClaimed extends Schema.TaggedError<AccountClaimed>()(
  "AccountClaimed",
  {}
) {}
