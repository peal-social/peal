import { Schema } from "effect";

/**
 * The header a request names the workspace it acts in, by its id. The path
 * never names it: the workspace is the credential's, or the header's.
 */
export const workspaceHeader = "peal-workspace";

/**
 * What every endpoint of a workspace takes in its headers: the workspace,
 * optional, as an API key and an application's token bound to a workspace
 * act in their own without it. An endpoint with headers of its own spreads
 * these first.
 */
export const workspaceHeaders = {
  [workspaceHeader]: Schema.optionalKey(
    Schema.String.annotate({
      description:
        "The id of the workspace the request acts in. An API key and an application's token bound to a workspace act in their own workspace without it; a session, the command line's sign-in and a partner key send it.",
    })
  ),
};

/**
 * The headers of a typed client's call that acts in a workspace:
 * `client.tags.list({ headers: forWorkspace(workspaceId) })`.
 */
export const forWorkspace = (workspaceId: string) => ({
  [workspaceHeader]: workspaceId,
});
