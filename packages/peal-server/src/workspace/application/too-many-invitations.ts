import { Schema } from "effect";

/**
 * No invitation may go now: the workspace has as many pending as it may
 * (`pending`), or the inviter, the workspace or the address invited had
 * all the invitation emails a day allows (`emailsToday`,
 * `invitationEmailsPerDay`).
 */
export class TooManyInvitations extends Schema.TaggedError<TooManyInvitations>()(
  "TooManyInvitations",
  { reason: Schema.Literals(["emailsToday", "pending"]) }
) {}
