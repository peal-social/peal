"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { forgetConversation } from "peal-ui/lib/support/crisp";
import { useTransition } from "react";

import { authClient } from "#auth/client.ts";
import { SessionsView } from "#components/account/sessions-view.tsx";
import { useMeasurementSignOut } from "#components/measurement/measurement.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { InTimeZone } from "#components/notices/in-time-zone.tsx";
import { SettingsLoading } from "#components/settings/settings-status.tsx";
import { usePathname, useRouter } from "#i18n/navigation.ts";
import { browserTimeZone } from "#posts/zoned-time.ts";
import { accountSessions, currentSession } from "#settings/atoms.ts";

// Signs this session out, as the account menu does, then opens the sign-in
// page, which comes back here once signed in: the new session is fresh.
// Signing out first keeps the old session from staying listed beside it.
const SignInAgain = () => {
  const t = useTranslations("AccountSettings.sessions");
  const menu = useTranslations("UserMenu");
  const router = useRouter();
  const pathname = usePathname();
  const forgetMeasurement = useMeasurementSignOut();
  const [isPending, startTransition] = useTransition();

  const handleSignInAgain = () => {
    startTransition(async () => {
      const result = await authClient.signOut();

      if (result.error === null) {
        // Before leaving, so nothing more is measured as the person.
        forgetMeasurement();
        forgetConversation();
        router.push({ pathname: "/login", query: { next: pathname } });
        router.refresh();
      } else {
        toast.error(menu("signOutFailed"));
      }
    });
  };

  return (
    <Button
      variant="outline"
      disabled={isPending}
      focusableWhenDisabled
      onClick={handleSignInAgain}
    >
      {isPending ? t("revoking") : t("signInAgain")}
    </Button>
  );
};

const LoadedSessions = () => {
  const sessions = useAtomValue(accountSessions);
  const current = useAtomValue(currentSession);
  const reload = useAtomRefresh(accountSessions);

  const token = AsyncResult.match(current, {
    onFailure: () => "",
    onInitial: () => "",
    onSuccess: ({ value }) => value.session.token,
  });

  return (
    <SessionsView
      currentToken={token}
      sessions={sessions}
      signInAgain={<SignInAgain />}
      onChanged={reload}
    />
  );
};

/** The user's sessions, in the reader's time zone, once the page runs. */
export const SessionsList = () =>
  useHydrated() ? (
    <InTimeZone timeZone={browserTimeZone()}>
      <LoadedSessions />
    </InTimeZone>
  ) : (
    <SettingsLoading />
  );
