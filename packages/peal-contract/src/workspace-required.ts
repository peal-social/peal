import { Schema } from "effect";

import { errorEnvelope } from "./error-envelope.ts";

/**
 * The request names no workspace, and its credential belongs to none: a
 * session, the command line's sign-in and a partner key name one in the
 * `Peal-Workspace` header, as an API key and an application bound to a
 * workspace need not.
 */
export class WorkspaceRequired extends Schema.TaggedError<WorkspaceRequired>()(
  "WorkspaceRequired",
  { ...errorEnvelope },
  {
    description:
      "The request names no workspace, and its credential belongs to none: send the workspace's id in the `Peal-Workspace` header. Nothing was done.",
    httpApiStatus: 400,
  }
) {}
