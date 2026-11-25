import { DateTime, Option } from "effect";

import { currentUserOrNone } from "#auth/session.ts";
import { TabPerson } from "#components/auth/tab-person.tsx";
import { Measurement } from "#components/measurement/measurement.tsx";
import { WorkspaceAddresses } from "#components/shell/workspace-addresses.tsx";

// Around every page of the signed-in app: the person's workspaces as their
// addresses need them (`/<slug>`), and the web app's measurement, only
// where GET /api/me (read once per request) says the server measures it
// for this person. Elsewhere the pages render alone, and the SDK's code,
// behind a dynamic import, is never downloaded. Signed in, the pages name
// their person to the tab (`TabPerson`), whose answer to the other tabs'
// news depends on it.
const AppLayout = async ({ children }: LayoutProps<"/[locale]">) => {
  const me = await currentUserOrNone();

  const person = Option.isSome(me) ? (
    <TabPerson userId={me.value.user.id} />
  ) : null;

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
        {person}
        {await children}
      </WorkspaceAddresses>
    );
  }

  const { settings, userId } = measured.value;

  return (
    <WorkspaceAddresses workspaces={workspaces}>
      {person}
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
