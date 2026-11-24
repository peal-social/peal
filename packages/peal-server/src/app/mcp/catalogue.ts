import { Context } from "effect";
import { Tool } from "effect/ai";

import { AdsTools } from "#app/mcp/ads-tools.ts";
import { CapabilityTools } from "#app/mcp/capabilities-tools.ts";
import { ConnectTools } from "#app/mcp/connect-tools.ts";
import { ToolAreaSchema } from "#app/mcp/discovery-tools.ts";
import type { ToolArea } from "#app/mcp/discovery-tools.ts";
import { FeedTools } from "#app/mcp/feeds-tools.ts";
import { InboxTools } from "#app/mcp/inbox-tools.ts";
import { MediaTools } from "#app/mcp/media-tools.ts";
import { PeopleTools } from "#app/mcp/people-tools.ts";
import { PostTools } from "#app/mcp/posts-tools.ts";
import { ReportTools } from "#app/mcp/reports-tools.ts";
import { ReviewTools } from "#app/mcp/review-tools.ts";
import { SavedTools } from "#app/mcp/saved-tools.ts";
import { TagTools } from "#app/mcp/tags-tools.ts";
import { BasicTools } from "#app/mcp/tools.ts";
import { WebhookTools } from "#app/mcp/webhooks-tools.ts";
import { scopesFor } from "#workspace/domain/oauth-grant.ts";
import type { WorkspaceScope } from "#workspace/domain/oauth-grant.ts";

// What the catalogue reads of a tool.
interface ListedTool {
  readonly annotations: Context.Context<never>;
  readonly description?: string | undefined;
  readonly name: string;
}

// The tools of a toolkit that `names` gives, in that order: a toolkit
// whose tools act on several of the product's concerns gives each area its
// own.
const pick = <Tools extends { readonly [Name in keyof Tools]: ListedTool }>(
  tools: Tools,
  names: readonly (keyof Tools)[]
): readonly ListedTool[] => names.map((name) => tools[name]);

/**
 * The tools by area: the product's concerns. An area lists a whole
 * toolkit, or the tools it takes of several, by what each tool acts on;
 * every tool is in one area, and `changingTools` (`server.ts`) reads the
 * catalogue built from here, so a tool left out would change things
 * without the activity log keeping its calls. Tools are written by
 * hand, each with a description of what it changes, and none is generated
 * from an endpoint; as their number grows, `find_tools` lists them from
 * here, so a client chooses among summaries rather than read every
 * description. A new tool joins an area here, and a new toolkit joins this
 * map and `PealTools` together; an area with no tool left leaves
 * `ToolAreaSchema`.
 */
export const toolAreas: Readonly<Record<ToolArea, readonly ListedTool[]>> = {
  ads: Object.values(AdsTools.tools),
  analytics: pick(ReportTools.tools, [
    "analytics_summary",
    "analytics_dashboard",
    "channel_analytics",
    "best_times",
    "post_analytics",
  ]),
  approvals: Object.values(ReviewTools.tools),
  automations: [
    ...pick(SavedTools.tools, [
      "list_queues",
      "preview_queue",
      "create_queue",
      "update_queue",
      "delete_queue",
    ]),
    ...pick(PostTools.tools, ["reshuffle_queue", "recycle_post"]),
    ...pick(SavedTools.tools, ["list_recycling_rules", "get_recycling_rule"]),
    ...pick(PostTools.tools, [
      "update_recycling_rule",
      "resume_recycling_rule",
    ]),
    ...pick(SavedTools.tools, [
      "stop_recycling_rule",
      "list_follow_up_rules",
      "get_follow_up_rule",
      "start_follow_up_rule",
      "update_follow_up_rule",
      "stop_follow_up_rule",
    ]),
    ...Object.values(FeedTools.tools),
    ...pick(InboxTools.tools, [
      "list_comment_rules",
      "start_comment_rule",
      "update_comment_rule",
      "stop_comment_rule",
    ]),
  ],
  channels: [
    ...pick(BasicTools.tools, [
      "list_channels",
      "rename_channel",
      "disable_channel",
      "enable_channel",
    ]),
    ...Object.values(CapabilityTools.tools),
    ...pick(PostTools.tools, ["get_tiktok_creator"]),
    ...pick(SavedTools.tools, [
      "list_channel_sets",
      "create_channel_set",
      "update_channel_set",
      "delete_channel_set",
      "get_channel_defaults",
      "set_channel_defaults",
      "clear_channel_defaults",
    ]),
    ...pick(ConnectTools.tools, [
      "list_connect_links",
      "get_connect_link",
      "create_connect_link",
      "revoke_connect_link",
    ]),
  ],
  inbox: pick(InboxTools.tools, [
    "list_comment_threads",
    "get_comment_thread",
    "reply_to_comment",
    "confirm_comment_reply",
    "withdraw_comment_reply",
    "mark_comment_answered",
    "moderate_comment",
    "list_location_reviews",
    "get_location_reviews",
    "reply_to_location_review",
    "delete_location_review_reply",
    "mark_location_review_answered",
    "list_conversations",
    "get_conversation",
    "send_message",
    "send_private_reply",
  ]),
  links: pick(ReportTools.tools, [
    "get_short_link_status",
    "list_short_links",
    "get_short_link",
  ]),
  media: Object.values(MediaTools.tools),
  posts: [
    ...pick(PostTools.tools, [
      "list_drafts",
      "list_posts",
      "get_post",
      "list_post_attempts",
      "create_draft",
      "update_draft",
      "duplicate_post",
      "discard_draft",
      "schedule_post",
      "publish_post",
      "reschedule_post",
      "queue_post",
      "create_post",
      "create_posts",
      "validate_post",
      "await_post",
      "unschedule_post",
      "cancel_post",
      "remove_post_target",
      "repost_target",
      "leave_out_rest",
      "confirm_target",
      "unpublish_post",
      "edit_published_post",
      "list_post_changes",
    ]),
    ...Object.values(TagTools.tools),
    ...pick(SavedTools.tools, [
      "list_signatures",
      "create_signature",
      "update_signature",
      "delete_signature",
    ]),
  ],
  webhooks: Object.values(WebhookTools.tools),
  workspace: [
    ...pick(BasicTools.tools, [
      "find_tools",
      "whoami",
      "list_workspaces",
      "server_health",
    ]),
    ...Object.values(PeopleTools.tools),
    ...pick(ReportTools.tools, ["get_billing", "get_usage", "list_activity"]),
    ...pick(ConnectTools.tools, [
      "get_partner_account",
      "list_partner_workspaces",
      "get_partner_usage",
    ]),
  ],
};

/**
 * The tools that decide what goes out to the platforms, and when: their
 * use cases check the publishing permissions, which only the scope
 * `workspace:publish` leaves to an OAuth client
 * (`#workspace/domain/oauth-grant.ts`). Whatever answers, settles or
 * moderates a comment is among them: its use cases check
 * `engagement:reply`; and what sends a direct message, `engagement:message`. A test calls each with a connection that lacks the
 * scope.
 */
export const publishingTools: ReadonlySet<string> = new Set([
  "approve_post",
  "cancel_post",
  "confirm_comment_reply",
  "confirm_target",
  "create_post",
  "create_posts",
  "create_review_link",
  "delete_location_review_reply",
  "edit_published_post",
  "leave_out_rest",
  "mark_comment_answered",
  "mark_location_review_answered",
  "moderate_comment",
  "publish_post",
  "queue_post",
  "recycle_post",
  "remove_post_target",
  "reply_to_comment",
  "reply_to_location_review",
  "repost_target",
  "request_changes",
  "reschedule_post",
  "reshuffle_queue",
  "resume_recycling_rule",
  "revoke_review_link",
  "schedule_post",
  "send_message",
  "send_private_reply",
  "start_comment_rule",
  "start_follow_up_rule",
  "stop_comment_rule",
  "stop_follow_up_rule",
  "stop_recycling_rule",
  "unpublish_post",
  "unschedule_post",
  "update_comment_rule",
  "update_follow_up_rule",
  "update_recycling_rule",
  "withdraw_comment_reply",
]);

/** A tool as the catalogue describes it. */
export interface CatalogueTool {
  readonly area: ToolArea;
  readonly changes: boolean;
  readonly description: string;
  readonly destructive: boolean;
  readonly name: string;
  readonly reachesOutside: boolean;
  /** The scope an OAuth client needs to call it: the one to ask for. */
  readonly scope: WorkspaceScope;
  /**
   * Every set of scopes that lets an OAuth client call it: holding all of
   * one is enough. Most tools have one set of one scope.
   */
  readonly scopeSets: readonly (readonly WorkspaceScope[])[];
  readonly title: string;
}

/**
 * The tools that spend on ads, or change or quote what spends, with the
 * scopes each takes: their use cases check `ads:spend` (a quote checks
 * what spending would), or, to pause or stop, `ads:spend` or `ads:manage`,
 * which the scope `workspace:ads` leaves to an OAuth client beside
 * `workspace:publish` or `workspace:write` (`scopesFor`). A test calls
 * each with a connection that lacks the scope.
 */
const adsScopeSets = new Map<string, readonly (readonly WorkspaceScope[])[]>(
  Object.entries({
    boost_post: [scopesFor("ads:spend")],
    pause_boost: [scopesFor("ads:spend"), scopesFor("ads:manage")],
    quote_boost: [scopesFor("ads:spend")],
    resume_boost: [scopesFor("ads:spend")],
    stop_boost: [scopesFor("ads:spend"), scopesFor("ads:manage")],
  })
);

/** The tools that take the scope `workspace:ads`. */
export const adsTools: ReadonlySet<string> = new Set(adsScopeSets.keys());

const scopeSetsOf = (
  name: string,
  changes: boolean
): readonly (readonly WorkspaceScope[])[] => {
  const ads = adsScopeSets.get(name);

  if (ads !== undefined) {
    return ads;
  }

  if (publishingTools.has(name)) {
    return [["workspace:publish"]];
  }

  return [[changes ? "workspace:write" : "workspace:read"]];
};

/** Whether scopes an OAuth client holds let it call the tool. */
export const scopesLetCall = (
  tool: Pick<CatalogueTool, "scopeSets">,
  held: readonly string[]
): boolean =>
  tool.scopeSets.some((set) => set.every((scope) => held.includes(scope)));

/** Every tool the endpoint offers, area by area, in the order they list. */
export const toolCatalogue = (): readonly CatalogueTool[] =>
  ToolAreaSchema.literals.flatMap((area) =>
    toolAreas[area].map((tool): CatalogueTool => {
      const hint = (annotation: typeof Tool.Readonly) =>
        Context.getOrElse(tool.annotations, annotation, () => false);

      const changes = !hint(Tool.Readonly);
      const scopeSets = scopeSetsOf(tool.name, changes);
      const [[scope = "workspace:read"] = []] = scopeSets;

      return {
        area,
        changes,
        description: tool.description ?? "",
        destructive: hint(Tool.Destructive),
        name: tool.name,
        reachesOutside: hint(Tool.OpenWorld),
        scope,
        scopeSets,
        title: Context.getOrElse(tool.annotations, Tool.Title, () => tool.name),
      };
    })
  );

// A description's first sentence.
const firstSentence = /^.*?[.!?](?=\s|$)/su;

/** What a tool does, in a sentence: its description's first. */
export const summaryOf = (description: string): string =>
  firstSentence.exec(description)?.[0] ?? description;

/**
 * The catalogue's tools in an area, if one is asked, that hold every word
 * of a query in their name, title or description.
 */
export const findTools = (search: {
  readonly area?: ToolArea | undefined;
  readonly query?: string | undefined;
}): readonly CatalogueTool[] => {
  const words = (search.query ?? "")
    .toLowerCase()
    .split(/\s+/u)
    .filter((word) => word !== "");

  return toolCatalogue().filter((tool) => {
    const text = `${tool.name} ${tool.title} ${tool.description}`.toLowerCase();

    return (
      (search.area === undefined || tool.area === search.area) &&
      words.every((word) => text.includes(word))
    );
  });
};
