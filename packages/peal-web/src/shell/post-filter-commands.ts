import type { PostOutcome, PostStatus } from "peal-contract";

import { noFilters, queryOf } from "#posts/post-list-filter.ts";
import type { PostListFilters } from "#posts/post-list-filter.ts";
import { workspacePath } from "#shell/workspace-path.ts";

/**
 * The states the command menu opens the posts list on: those people look
 * for, as the list's own filters write them. Waiting for an approval has a
 * page of its own (Approvals), so it is not here.
 */
export type PostFilterCommand =
  | { readonly kind: "status"; readonly status: PostStatus }
  | { readonly kind: "outcome"; readonly outcome: PostOutcome };

export const postFilterCommands: readonly PostFilterCommand[] = [
  { kind: "status", status: "scheduled" },
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
