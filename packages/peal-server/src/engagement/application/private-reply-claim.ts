import type { PrivateReply } from "#engagement/domain/private-reply.ts";
import type { MeterClaim } from "#shared/application/metered-usage.ts";

/**
 * The outbound message a private reply claimed when it was journalled:
 * what it gives back when it ends as never sent.
 */
export const claimOfPrivateReply = (reply: PrivateReply): MeterClaim => ({
  at: reply.createdAt,
  meter: "outboundMessages",
  units: 1,
  workspaceId: reply.workspaceId,
});
