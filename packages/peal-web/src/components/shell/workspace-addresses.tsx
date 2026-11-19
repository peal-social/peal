"use client";

import { createContext, useCallback, useContext } from "react";
import type { ReactNode } from "react";

import { workspacePath } from "#shell/workspace-path.ts";
import type { WorkspaceAddress } from "#shell/workspace-path.ts";

const Addresses = createContext<readonly WorkspaceAddress[]>([]);

/**
 * The person's workspaces as their addresses need them, for every page
 * of the signed-in app (its layout gives them, from GET /api/me): components name a
 * workspace by its id, and `useWorkspaceHref` writes its slug.
 */
export const WorkspaceAddresses = ({
  children,
  workspaces,
}: {
  readonly children: ReactNode;
  readonly workspaces: readonly WorkspaceAddress[];
}) => <Addresses value={workspaces}>{children}</Addresses>;

/** The person's workspaces, by id and slug. */
export const useWorkspaceAddresses = (): readonly WorkspaceAddress[] =>
  useContext(Addresses);

/**
 * Writes the address of a workspace's page from its id (`href(id,
 * "/posts")`): under its slug, or under its id where the workspace is not
 * among the person's (a page outside the app), which the proxy sends on.
 */
export const useWorkspaceHref = (): ((
  workspaceId: string,
  rest?: string
) => string) => {
  const workspaces = useContext(Addresses);

  return useCallback(
    (workspaceId: string, rest = "") =>
      workspacePath(
        workspaces.find(({ id }) => id === workspaceId)?.slug ?? workspaceId,
        rest
      ),
    [workspaces]
  );
};
