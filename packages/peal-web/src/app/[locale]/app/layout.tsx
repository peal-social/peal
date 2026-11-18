import { DateTime, Option } from "effect";

import { currentUserOrNone } from "#auth/session.ts";
import { Measurement } from "#components/measurement/measurement.tsx";

// Around every page of the signed-in app: the web app's measurement, only
// where GET /api/me (read once per request) says the server measures it
// for this person. Elsewhere the pages render alone, and the SDK's code,
// behind a dynamic import, is never downloaded.
const AppLayout = async ({ children }: LayoutProps<"/[locale]/app">) => {
  const me = await currentUserOrNone();

  const measured = me.pipe(
    Option.flatMap(({ browserAnalytics, user }) =>
      Option.fromNullishOr(browserAnalytics).pipe(
        Option.map((settings) => ({ settings, userId: user.id }))
      )
    )
  );

  if (Option.isNone(measured)) {
    return await children;
  }

  const { settings, userId } = measured.value;

  return (
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
  );
};

export default AppLayout;
