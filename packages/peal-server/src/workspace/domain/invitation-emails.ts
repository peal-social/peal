/**
 * How many invitation emails go out a day (UTC): each names its inviter
 * and its workspace, in a subject and a body sent from Peal's own domain,
 * so they are counted by the member who invites (across their
 * workspaces), by the workspace and by the address invited, which no one
 * else's invitations may flood. As many a workspace as it may have
 * pending (`pendingInvitationLimit`), so a team still invites everyone in
 * a day; an address takes a few, as an invitation sent again replaces the
 * one before.
 */
export const invitationEmailsPerDay = {
  perInviter: 100,
  perRecipient: 3,
  perWorkspace: 100,
} as const;

/**
 * How many days of counts are kept: the day counted, and the one before,
 * deleted as the next ones are counted.
 */
export const invitationEmailDays = 2;

/** What a refusal for the day's invitation emails says, in English. */
export const invitationEmailsRefused = `The inviter, the workspace or the address invited had all the invitation emails a day allows (UTC): ${String(invitationEmailsPerDay.perInviter)} for each member who invites, ${String(invitationEmailsPerDay.perWorkspace)} for each workspace, ${String(invitationEmailsPerDay.perRecipient)} for each address. Try again tomorrow.`;
