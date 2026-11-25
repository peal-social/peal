"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { useTransition } from "react";

import { useSignOut } from "#auth/use-sign-out.ts";
import { SessionsView } from "#components/account/sessions-view.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { InTimeZone } from "#components/notices/in-time-zone.tsx";
import { SettingsLoading } from "#components/settings/settings-status.tsx";
import { usePathname } from "#i18n/navigation.ts";
import { browserTimeZone } from "#posts/zoned-time.ts";
import { accountSessions, currentSession } from "#settings/atoms.ts";

// Signs this session out, as the account menu does (`useSignOut`), then
// loads the sign-in page, which comes back here once signed in: the new
// session is fresh. Signing out first keeps the old session from staying
// listed beside it.
const SignInAgain = () => {
  const t = useTranslations("AccountSettings.sessions");
  const menu = useTranslations("UserMenu");
  const pathname = usePathname();
  const { leaving, signOut } = useSignOut();
  const [isPending, startTransition] = useTransition();

  const handleSignInAgain = () => {
    startTransition(async () => {
      await signOut({
        refused: () => {
          toast.error(menu("signOutFailed"));
        },
        to: { pathname: "/login", query: { next: pathname } },
      });
    });
  };

  const busy = isPending || leaving;

  return (
    <Button
      variant="outline"
      disabled={busy}
      focusableWhenDisabled
      onClick={handleSignInAgain}
    >
      {busy ? t("revoking") : t("signInAgain")}
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
