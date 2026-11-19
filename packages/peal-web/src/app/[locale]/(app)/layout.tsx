import { DateTime, Option } from "effect";

import { currentUserOrNone } from "#auth/session.ts";
import { Measurement } from "#components/measurement/measurement.tsx";
import { WorkspaceAddresses } from "#components/shell/workspace-addresses.tsx";

// Around every page of the signed-in app: the person's workspaces as their
// addresses need them (`/<slug>`), and the web app's measurement, only
// where GET /api/me (read once per request) says the server measures it
// for this person. Elsewhere the pages render alone, and the SDK's code,
// behind a dynamic import, is never downloaded.
const AppLayout = async ({ children }: LayoutProps<"/[locale]">) => {
  const me = await currentUserOrNone();

  const workspaces = Option.match(me, {
    onNone: () => [],
    onSome: (found) => found.workspaces.map(({ id, slug }) => ({ id, slug })),
  });

  const measured = me.pipe(
    Option.flatMap(({ browserAnalytics, user }) =>
      Option.fromNullishOr(browserAnalytics).pipe(
        Option.map((settings) => ({ settings, userId: user.id }))
      )
    )
  );

  if (Option.isNone(measured)) {
    return (
      <WorkspaceAddresses workspaces={workspaces}>
        {await children}
      </WorkspaceAddresses>
    );
  }

  const { settings, userId } = measured.value;

  return (
    <WorkspaceAddresses workspaces={workspaces}>
      <Measurement
        settings={{
          consent: settings.consent,
          decidedAt:
            settings.decidedAt === null
              ? null
              : DateTime.formatIso(settings.decidedAt),
          environment: settings.environment,
          excludedWorkspaceIds: settings.excludedWorkspaceIds,
          token: settings.token,
        }}
        userId={userId}
      >
        {children}
      </Measurement>
    </WorkspaceAddresses>
  );
};

export default AppLayout;
