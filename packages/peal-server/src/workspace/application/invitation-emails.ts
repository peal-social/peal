import { Context, Effect, Layer } from "effect";
import type { DateTime } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";

/** An invitation email about to go out. */
export interface InvitationEmailClaim {
  readonly at: DateTime.Utc;
  /** The address invited, whatever its case. */
  readonly email: string;
  readonly inviterId: UserId;
  readonly workspaceId: WorkspaceId;
}

/**
 * The invitation emails each day sends (`invitationEmailsPerDay`), counted
 * by the member who invites, by the workspace and by the address invited,
 * under keyed pseudonyms: no count names whom it is about.
 */
export class InvitationEmails extends Context.Service<
  InvitationEmails,
  {
    /**
     * Takes one of the day's invitation emails for the inviter, the
     * workspace and the address, in the caller's transaction if any:
     * false, taking none, when any of them has had all its day allows.
     * Those counting together take turns, so none passes a limit with
     * another; a claim whose email then does not leave is given back by
     * the caller's transaction failing.
     */
    readonly claim: (
      claim: InvitationEmailClaim
    ) => Effect.Effect<boolean, DatabaseError>;
  }
>()("peal-server/workspace/application/InvitationEmails") {
  /** Every email may go: for tests that count none. */
  static readonly unlimited = Layer.succeed(
    InvitationEmails,
    InvitationEmails.of({ claim: () => Effect.succeed(true) })
  );
}
