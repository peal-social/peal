import { DateTime, Option } from "effect";

import { currentUserOrNone } from "#auth/session.ts";
import { Measurement } from "#components/measurement/measurement.tsx";
import { WorkspaceAddresses } from "#components/shell/workspace-addresses.tsx";

// Around every page of the signed-in app: the person's workspaces as their
// addresses need them (`/<slug>`), and the web app's measurement, only
// where GET /api/me (read once per request) says the server measures it
// for this person. Elsewhere the pages render alone, and the SDK's code,
// behind a dynamic import, is never downloaded.
//
// A signed-in person reads the app in the language their account keeps,
// whatever the address or the browser's cookie says: a page opened in
// another is sent to the same page in theirs, its query kept, before
// anything of it renders. The layouts below do it (`toAccountLanguage`),
// as only they know the page from their route's params. Signed out, or
// for staff acting as someone, the address decides, then the cookie, then
// the browser, as on every other page.
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
