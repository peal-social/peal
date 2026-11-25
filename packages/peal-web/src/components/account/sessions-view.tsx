"use client";

import { Cause, Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "peal-ui/components/badge";
import { Button } from "peal-ui/components/button";
import {
  SettingsCard,
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
  SettingsRowText,
} from "peal-ui/components/settings";
import { toast } from "peal-ui/components/toast";
import { useTransition } from "react";
import type { ReactNode } from "react";

import { authClient } from "#auth/client.ts";
import { RevokeOthersRow } from "#components/account/revoke-others.tsx";
import {
  SettingsLoadFailed,
  SettingsLoading,
} from "#components/settings/settings-status.tsx";
import type { AccountSession } from "#settings/atoms.ts";
import type { AuthCallFailed } from "#settings/auth-call.ts";
import { settingsErrorKey } from "#settings/errors.ts";

// A value of a session's request, if it had one.
const known = (value: string | null | undefined): string | undefined =>
  value === null || value === undefined || value.trim() === ""
    ? undefined
    : value;

// One session: the browser it runs in, from where, since when, and signing
// it out, unless it is this one.
const SessionRow = ({
  current,
  onChanged,
  session,
}: {
  readonly current: boolean;
  readonly onChanged: () => void;
  readonly session: AccountSession;
}) => {
  const t = useTranslations("AccountSettings.sessions");
  const errors = useTranslations("Settings.errors");
  const format = useFormatter();
  const [isRevoking, startRevoke] = useTransition();

  const when = (date: Date) =>
    format.dateTime(date, { dateStyle: "medium", timeStyle: "short" });

  // Better Auth stores what the request told, which may be nothing.
  const device = known(session.userAgent) ?? t("unknownDevice");
  const address = known(session.ipAddress) ?? "none";

  const handleRevoke = () => {
    startRevoke(async () => {
      const result = await authClient.revokeSession({ token: session.token });

      if (result.error === null) {
        toast.success(t("revoked"));
        onChanged();
      } else {
        toast.error(errors(settingsErrorKey(result.error)));
      }
    });
  };

  return (
    <li className="flex flex-wrap items-start gap-4 px-4 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{device}</span>
          {current ? <Badge variant="secondary">{t("current")}</Badge> : null}
        </span>
        <span className="text-muted-foreground text-sm">
          {t("details", {
            address,
            lastActive: when(session.updatedAt),
            signedIn: when(session.createdAt),
          })}
        </span>
      </div>
      {current ? null : (
        <Button
          variant="ghost"
          size="sm"
          disabled={isRevoking}
          focusableWhenDisabled
          aria-label={isRevoking ? undefined : t("revokeSession", { device })}
          onClick={handleRevoke}
        >
          {isRevoking ? t("revoking") : t("revoke")}
        </Button>
      )}
    </li>
  );
};

// Better Auth lists sessions, each with its token, only to a session signed
// in less than `freshAge` ago (a day): an older one is refused 403
// `SESSION_NOT_FRESH`, which trying again never changes. Signing in again
// makes a fresh session.
const signedInTooLongAgo = (cause: Cause.Cause<AuthCallFailed>): boolean =>
  Cause.findErrorOption(cause).pipe(
    Option.exists(({ code }) => code === "SESSION_NOT_FRESH")
  );

// What shows in place of the list to a session too old to read it: why,
// the way to sign in again, and signing out every other session, which
// Better Auth lets any session do, fresh or not: someone who fears for a
// device lost or left signed in cuts it off at once.
const SignInToSee = ({
  onChanged,
  signInAgain,
}: {
  readonly onChanged: () => void;
  readonly signInAgain: ReactNode;
}) => {
  const t = useTranslations("AccountSettings.sessions");

  return (
    <SettingsCard>
      <SettingsRow>
        <SettingsRowText>
          <SettingsRowDescription>{t("notFresh")}</SettingsRowDescription>
        </SettingsRowText>
        <SettingsRowControl>{signInAgain}</SettingsRowControl>
      </SettingsRow>
      <RevokeOthersRow onChanged={onChanged} />
    </SettingsCard>
  );
};

/**
 * The user's sessions as Better Auth listed them: loading, the list with
 * this session marked, a session too old to list them told to sign in
 * again (`signInAgain`, the page's button) and offered to sign out the
 * others all the same, or another failure, which may pass when tried
 * again.
 */
export const SessionsView = ({
  currentToken,
  onChanged,
  sessions,
  signInAgain,
}: {
  readonly currentToken: string;
  readonly onChanged: () => void;
  readonly sessions: AsyncResult.AsyncResult<
    readonly AccountSession[],
    AuthCallFailed
  >;
  readonly signInAgain: ReactNode;
}) =>
  AsyncResult.match(sessions, {
    onFailure: ({ cause }) =>
      signedInTooLongAgo(cause) ? (
        <SignInToSee signInAgain={signInAgain} onChanged={onChanged} />
      ) : (
        <SettingsLoadFailed onRetry={onChanged} />
      ),
    onInitial: () => <SettingsLoading />,
    onSuccess: ({ value }) => (
      <SettingsCard>
        <ul className="divide-y">
          {value.map((session) => (
            <SessionRow
              key={session.id}
              current={session.token === currentToken}
              session={session}
              onChanged={onChanged}
            />
          ))}
        </ul>
        {value.length > 1 ? <RevokeOthersRow onChanged={onChanged} /> : null}
      </SettingsCard>
    ),
  });
