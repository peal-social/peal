import { Schema } from "effect";
import { Tool } from "effect/ai";
import { CurrentMember } from "peal-contract";

import { reading } from "#app/mcp/annotations.ts";
import { ToolRefused } from "#app/mcp/tool-refused.ts";

/**
 * The areas the tools are sorted in: the product's concerns, named as the
 * API's namespaces are. An area lists the tools of one toolkit or of
 * several (`toolAreas` in `#app/mcp/catalogue.ts`), and exists only while
 * it has tools.
 */
export const ToolAreaSchema = Schema.Literals([
  "workspace",
  "posts",
  "review",
  "channels",
  "media",
  "inbox",
  "automations",
  "analytics",
  "links",
  "ads",
  "webhooks",
]).annotate({
  description:
    "An area of Peal: `workspace` (who the connection is and what it may do, the workspace, the server, members and their roles, the plan and usage, the activity log, the partner account), `posts` (drafts, scheduling, publishing, outcomes, tags and tagging a post, signatures), `review` (the posts that wait for an approval, deciding them, and review links), `channels` (the connected social accounts: listing them, naming one, turning one off or on, what each platform takes and its lookups, channel sets, a channel's default options, connect links), `media` (images and videos, generated ones included), `inbox` (comments, direct messages and reviews, and answering them), `automations` (what acts on its own: queues, repeating posts, follow-up rules, feeds and comment rules), `analytics` (the figures of posts and channels, and the best times to post), `links` (short links and their clicks), `ads` (ad accounts, campaigns and their numbers, and boosting a published post, which spends money), `webhooks` (endpoints and their deliveries).",
});

export type ToolArea = typeof ToolAreaSchema.Type;

/** A tool as `find_tools` lists it: enough to choose, not its schema. */
export const FoundToolSchema = Schema.Struct({
  area: ToolAreaSchema,
  // Whether it changes something, in Peal or outside.
  changes: Schema.Boolean,
  // Whether it removes or overwrites what was there.
  destructive: Schema.Boolean,
  name: Schema.String,
  // Whether its effect reaches outside Peal: a post on a platform, an
  // email, a request to another server.
  reachesOutside: Schema.Boolean,
  // The OAuth scope a client needs to call it: the one to ask for. What
  // spends on ads takes workspace:publish beside workspace:ads.
  scope: Schema.Literals([
    "workspace:read",
    "workspace:write",
    "workspace:publish",
    "workspace:ads",
  ]),
  // Whether this connection holds every scope the tool takes: null for an
  // API key, which carries permissions, not scopes (whoami lists them).
  scopeGranted: Schema.NullOr(Schema.Boolean),
  // What it does, in a sentence. tools/list gives the whole description.
  summary: Schema.String,
  title: Schema.String,
});

export type FoundTool = typeof FoundToolSchema.Type;

export const FindTools = Tool.make("find_tools", {
  dependencies: [CurrentMember],
  description:
    "Lists Peal's tools by area, with what each does in a sentence, whether it changes something or reaches outside Peal, the OAuth scope it takes and whether this connection holds it. Call it to choose a tool, or to learn what this connection may do before trying: `area` narrows to one area, `query` to the tools whose name, title or description holds every word given. It lists every tool tools/list does, and calls none; a tool's parameters are in tools/list.",
  failure: ToolRefused,
  parameters: Schema.Struct({
    area: Schema.optionalKey(ToolAreaSchema),
    query: Schema.optionalKey(
      Schema.String.check(Schema.isMaxLength(200)).annotate({
        description:
          "Words to look for, in any order and any case: every one must be in the tool's name, title or description.",
      })
    ),
  }),
  success: Schema.Struct({ tools: Schema.Array(FoundToolSchema) }),
})
  .annotateMerge(reading)
  .annotate(Tool.Title, "Find tools");
