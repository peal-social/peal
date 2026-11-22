import { getCurrentAdapter } from "@better-auth/core/context";
import type { GenericEndpointContext } from "better-auth";

/**
 * Disconnects every application the user connected (the command line, MCP
 * clients): what the OAuth provider keeps of them goes, so none renews its
 * access, and the next sign-in asks the person again. The access tokens it
 * stored go first, as some name the refresh token they came with; then the
 * refresh tokens, live or rotated; the consents a client would be given its
 * scopes again from without asking; and the device codes the command
 * line's sign-in has not exchanged yet. An access token already issued is
 * a JWT checked where it is used, and lasts out its fifteen minutes. Run
 * inside a transaction of Better Auth's, it joins it.
 */
export const forgetConnectedApplications = async (
  ctx: Pick<GenericEndpointContext, "context">,
  userId: string
): Promise<void> => {
  const adapter = await getCurrentAdapter(ctx.context.adapter);
  const theirs = [{ field: "userId", value: userId }];

  await adapter.deleteMany({ model: "oauthAccessToken", where: theirs });
  await adapter.deleteMany({ model: "oauthRefreshToken", where: theirs });
  await adapter.deleteMany({ model: "oauthConsent", where: theirs });
  await adapter.deleteMany({ model: "deviceCode", where: theirs });
};
