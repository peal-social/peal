import { DateTime, Option } from "effect";
import { hasLocale } from "next-intl";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { currentUserOrNone } from "#auth/session.ts";
import { Measurement } from "#components/measurement/measurement.tsx";
import { WorkspaceAddresses } from "#components/shell/workspace-addresses.tsx";
import {
  accountLanguageAddress,
  pageAddressHeader,
} from "#i18n/account-language.ts";
import { routing } from "#i18n/routing.ts";

// Around every page of the signed-in app: the person's workspaces as their
// addresses need them (`/<slug>`), and the web app's measurement, only
// where GET /api/me (read once per request) says the server measures it
// for this person. Elsewhere the pages render alone, and the SDK's code,
// behind a dynamic import, is never downloaded.
//
// A signed-in person reads the app in the language their account keeps,
// whatever the address or the browser's cookie says: a page opened in
// another is sent to the same page in theirs, its query kept
// (`accountLanguageAddress`, from the address the proxy hands on), before
// anything of it renders. Signed out, or for staff acting as someone, the
// address decides, then the cookie, then the browser, as on every other
// page.
const AppLayout = async ({ children, params }: LayoutProps<"/[locale]">) => {
  const [{ locale }, me, incoming] = await Promise.all([
    params,
    currentUserOrNone(),
    headers(),
  ]);

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const elsewhere = accountLanguageAddress(
    me,
    locale,
    incoming.get(pageAddressHeader)
  );

  if (Option.isSome(elsewhere)) {
    return redirect(elsewhere.value);
  }

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
