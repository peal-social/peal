import { DateTime, Effect, Option } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import { Api, CurrentPrincipal, Unauthenticated } from "peal-contract";
import type { BrowserAnalytics, Me } from "peal-contract";

import { forbidden, personRequired } from "#shared/api/forbidden.ts";
import { BrowserMeasurement } from "#shared/application/browser-measurement.ts";
import type { BrowserMeasurementSettings } from "#shared/application/browser-measurement.ts";
import { SupportChatIdentity } from "#shared/application/support-chat-identity.ts";
import { Accounts } from "#workspace/application/accounts.ts";
import type { CurrentAccount } from "#workspace/application/accounts.ts";
import { standingConsent } from "#workspace/domain/browser-analytics-consent.ts";

import { userPrincipalOf } from "./principal.ts";

/**
 * How the web app measures its use for this person: null where it
 * measures nothing, in a session staff act in, through an application,
 * and for an excluded person; otherwise the choice that still stands,
 * `undecided` once it is too old, and the person's excluded workspaces.
 */
export const browserAnalyticsOf = (
  { account, principal }: CurrentAccount,
  measurement: Option.Option<BrowserMeasurementSettings>,
  now: DateTime.Utc
): BrowserAnalytics | null => {
  if (
    Option.isNone(measurement) ||
    Option.isSome(principal.impersonatedBy) ||
    Option.isSome(principal.oauth) ||
    measurement.value.excluded.has(account.id)
  ) {
    return null;
  }

  const { environment, excluded, token } = measurement.value;
  const consent = standingConsent(account.browserAnalyticsConsent, now);

  return {
    consent: Option.match(consent, {
      onNone: () => "undecided" as const,
      onSome: ({ choice }) => choice,
    }),
    decidedAt: consent.pipe(
      Option.map(({ decidedAt }) => decidedAt),
      Option.getOrNull
    ),
    environment,
    excludedWorkspaceIds: account.workspaces
      .map(({ id }) => id)
      .filter((id) => excluded.has(id)),
    token,
  };
};

/**
 * What the support chat names the person with: the signature of the
 * account's own email, only in the person's own session in the web app
 * (never through an application, nor while staff act as them, when the
 * web app opens no chat), and null where the server holds no secret or
 * the address is not confirmed: a signature says the address is the
 * person's, which nobody has shown of one never confirmed.
 */
export const supportChatOf = Effect.fn("session.supportChat")(
  function* supportChatOf({ account, principal }: CurrentAccount) {
    if (
      !account.emailVerified ||
      Option.isSome(principal.impersonatedBy) ||
      Option.isSome(principal.oauth)
    ) {
      return null;
    }

    const { sign } = yield* SupportChatIdentity;

    return Option.match(yield* sign(account.email), {
      onNone: () => null,
      onSome: (emailSignature) => ({ emailSignature }),
    });
  }
);

const toMe = (
  current: CurrentAccount,
  browserAnalytics: BrowserAnalytics | null,
  supportChat: { readonly emailSignature: string } | null
): Me => {
  const { account, principal, workspaces } = current;

  return {
    browserAnalytics,
    impersonatedBy: Option.getOrNull(principal.impersonatedBy),
    supportChat,
    user: {
      email: account.email,
      emailVerified: account.emailVerified,
      hasPassword: account.hasPassword,
      id: account.id,
      image: Option.getOrNull(account.image),
      locale: account.locale,
      name: account.name,
      twoStepEnabled: account.twoStepEnabled,
    },
    workspaces: workspaces.map(
      ({ membership, permissions, twoStepRequired }) => ({
        id: membership.id,
        name: membership.name,
        permissions,
        role: membership.role,
        slug: membership.slug,
        twoStepRequired,
      })
    ),
  };
};

export const SessionHandlers = HttpApiBuilder.group(
  Api,
  "session",
  Effect.fn(function* sessionHandlers(handlers) {
    const accounts = yield* Accounts;
    const { settings } = yield* BrowserMeasurement;
    const identity = yield* SupportChatIdentity;

    return handlers.handleAll({
      me: () =>
        Effect.gen(function* me() {
          const principal = yield* CurrentPrincipal;

          // An API key belongs to a workspace, not to anyone.
          if (principal._tag !== "user") {
            return yield* personRequired();
          }

          // The account is read from the database on every request, never
          // from the session's cached copy, so a choice made a moment ago
          // shows at once.
          const current = yield* accounts
            .current(userPrincipalOf(principal))
            .pipe(
              Effect.catchTags({
                BannedUser: forbidden,
                DirectoryUnavailable: Effect.die,
                NotSignedIn: () => Effect.fail(new Unauthenticated()),
              })
            );

          return toMe(
            current,
            browserAnalyticsOf(current, settings, yield* DateTime.now),
            yield* supportChatOf(current).pipe(
              Effect.provideService(SupportChatIdentity, identity)
            )
          );
        }),
    });
  })
);
