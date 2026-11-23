/**
 * How many invitation emails go out a day (UTC): each names its inviter
 * and its workspace, in a subject and a body sent from Peal's own domain,
 * so they are counted by the member who invites (across their
 * workspaces), by the workspace, by the workspace and the address
 * together, and by the address across Peal. As many a workspace as it may
 * have pending (`pendingInvitationLimit`), so a team still invites
 * everyone in a day; a workspace sends an address a few, as an invitation
 * sent again replaces the one before, and its few never use up another
 * workspace's; the address's own ceiling, higher, only stops a flood from
 * many workspaces at once.
 */
export const invitationEmailsPerDay = {
  perInviter: 100,
  perRecipient: 20,
  perWorkspace: 100,
  perWorkspaceAndRecipient: 3,
} as const;

/**
 * How many days of counts are kept: the day counted, and the one before,
 * deleted as the next ones are counted.
 */
export const invitationEmailDays = 2;

/** What a refusal for the day's invitation emails says, in English. */
export const invitationEmailsRefused = `The inviter, the workspace or the address invited had all the invitation emails a day allows (UTC): ${String(invitationEmailsPerDay.perInviter)} for each member who invites, ${String(invitationEmailsPerDay.perWorkspace)} for each workspace, ${String(invitationEmailsPerDay.perWorkspaceAndRecipient)} from a workspace to one address, ${String(invitationEmailsPerDay.perRecipient)} to one address in all. Try again tomorrow.`;
