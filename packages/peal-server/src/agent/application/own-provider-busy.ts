import { Schema } from "effect";

/** The workspace, or the server, already sends as many requests to workspaces' own text providers as it may at once. */
export class OwnProviderBusy extends Schema.TaggedError<OwnProviderBusy>()(
  "OwnProviderBusy",
  {}
) {}
