import { Schema } from "effect";
import { Tool, Toolkit } from "effect/ai";
import { CurrentMember, WorkspaceMemberSchema } from "peal-contract";

import { reading } from "#app/mcp/annotations.ts";
import { ToolRefused } from "#app/mcp/tool-refused.ts";

/**
 * A member as list_members answers them: their email address only when
 * asked for, as an AI client rarely needs it.
 */
export const ListedMemberSchema = Schema.Struct({
  ...WorkspaceMemberSchema.fields,
  email: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "ListedMember" });

export const ListMembers = Tool.make("list_members", {
  dependencies: [CurrentMember],
  description:
    "Lists the workspace's members, in the order they joined, with their name and role, as every member sees them in the workspace's settings. Their email addresses come only with includeEmails. No tool invites people or changes who is in the workspace: the user does that in the web app.",
  failure: ToolRefused,
  parameters: Schema.Struct({
    includeEmails: Schema.optionalKey(Schema.Boolean).annotate({
      description:
        "Add each member's email address. Pass it only when the user asks for email addresses: names and roles are enough to mention or assign someone.",
    }),
  }),
  success: Schema.Struct({ members: Schema.Array(ListedMemberSchema) }),
})
  .annotateMerge(reading)
  .annotate(Tool.Title, "List members");

/**
 * The tools that read who is in the workspace. None invites, revokes an
 * invitation, or changes or removes a member: no application connected
 * over OAuth but Peal's command line does (`commandLineOnlyPermissions`),
 * a person's MCP connection is always such an application, and a key is
 * nobody. An invitee would hold whatever the connection was not given,
 * and outlive its grant.
 */
export const PeopleTools = Toolkit.make(ListMembers);
