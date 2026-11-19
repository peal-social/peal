import { workspaceClient } from "#auth/client.ts";
import { reportBrowserError } from "#errors/browser.ts";

/** What Better Auth's setActive answers: null, or why it refused. */
export interface SetActiveAnswer {
  readonly error: {
    readonly code?: string | undefined;
    readonly status: number;
  } | null;
}

/**
 * Makes a function that sets the workspace a person opens as their
 * session's active one, the one `/` opens next (`activeWorkspaceOf`). The
 * request starts at once and nothing waits for it: a failure is only
 * reported, and the page opens all the same.
 */
export const makeChooseWorkspace =
  ({
    report,
    setActive,
  }: {
    readonly report: (cause: unknown) => void;
    readonly setActive: (organizationId: string) => Promise<SetActiveAnswer>;
  }) =>
  async (organizationId: string): Promise<void> => {
    try {
      const { error } = await setActive(organizationId);

      if (error !== null) {
        report(
          new Error(
            `Setting the active workspace answered ${String(error.status)} ${error.code ?? ""}`.trimEnd()
          )
        );
      }
    } catch (error) {
      report(error);
    }
  };

// Through `workspaceClient`: during an OAuth authorization, `authClient`
// would resume it.
const setActiveWorkspace = makeChooseWorkspace({
  report: (cause) => {
    reportBrowserError(cause, "unhandledRejection");
  },
  setActive: async (organizationId) =>
    await workspaceClient.organization.setActive({ organizationId }),
});

/**
 * Makes `workspaceId` the session's active workspace, for a link that opens
 * it: the request goes on while the link does.
 */
export const chooseWorkspace = (workspaceId: string): void => {
  void setActiveWorkspace(workspaceId);
};
