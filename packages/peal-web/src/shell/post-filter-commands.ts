import type { PostOutcome, PostStatus } from "peal-contract";

import { noFilters, postViews, queryOf } from "#posts/post-list-filter.ts";
import type { PostListFilters, PostView } from "#posts/post-list-filter.ts";
import { goViewKeys } from "#shell/keys.ts";
import { workspacePath } from "#shell/workspace-path.ts";

/**
 * The states the command menu opens the posts list on: those people look
 * for, as the list's own filters write them. Drafts and posts that need an
 * approval are tabs of the list, which G then D and G then A open.
 */
export type PostFilterCommand =
  | { readonly kind: "status"; readonly status: PostStatus }
  | { readonly kind: "outcome"; readonly outcome: PostOutcome };

export const postFilterCommands: readonly PostFilterCommand[] = [
  { kind: "status", status: "draft" },
  { kind: "status", status: "scheduled" },
  { kind: "status", status: "awaitingApproval" },
  { kind: "outcome", outcome: "failed" },
  { kind: "outcome", outcome: "partiallyPublished" },
  { kind: "outcome", outcome: "unconfirmed" },
];

const filtersOfCommand = (command: PostFilterCommand): PostListFilters =>
  command.kind === "status"
    ? { ...noFilters, status: command.status }
    : { ...noFilters, outcome: command.outcome, status: "finished" };

/** Where a filter command opens the workspace's posts list, by its slug. */
export const postFilterHref = (
  workspace: string,
  command: PostFilterCommand
): string =>
  workspacePath(workspace, `/posts?${queryOf(filtersOfCommand(command))}`);

/** The second key of G then … that opens the list as a command does. */
export const postFilterKey = (command: PostFilterCommand): string | null =>
  command.kind === "status" ? (goViewKeys[command.status] ?? null) : null;

/** The tab of the list a command opens, when it opens one. */
export const postFilterView = (command: PostFilterCommand): PostView | null =>
  command.kind === "status"
    ? (postViews.find(({ status }) => status === command.status)?.view ?? null)
    : null;
