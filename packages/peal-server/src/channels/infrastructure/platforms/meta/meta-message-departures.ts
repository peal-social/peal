import { Duration, Effect, Layer, Option, Schema } from "effect";
import { Mac } from "effect/crypto";
import { HttpClientRequest, HttpClientResponse } from "effect/http";

import { ChannelDepartures } from "#channels/application/channel-departures.ts";
import type { DepartureOutcome } from "#channels/application/channel-departures.ts";
import { ChannelDirectory } from "#channels/application/channel-directory.ts";
import type { StoredTokens } from "#channels/application/platform-authorizer.ts";
import type { Channel } from "#channels/domain/channel.ts";
import { EngagementRecords } from "#engagement/application/engagement-records.ts";
import type { ChannelId } from "#shared/domain/ids.ts";
import {
  facebookMessageScopes,
  instagramLoginMessageScope,
  instagramPageMessageScopes,
} from "#shared/domain/inbox-message-platform.ts";
import type { InboxMessagePlatforms } from "#shared/domain/inbox-message-platform.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { MetaApp } from "#shared/infrastructure/platforms/meta-apps.ts";
import {
  appSecretProof,
  graphUrl,
  instagramUrl,
} from "#shared/infrastructure/platforms/meta-graph.ts";
import type { MetaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";

import type { MetaHttp } from "./meta-exchange.ts";

/** How long a departure waits on Meta at most. */
export const departureWait = Duration.seconds(10);

// The permissions that name messages: a channel that granted none was
// never subscribed to their events by Peal.
const messaging: ReadonlySet<string> = new Set([
  ...facebookMessageScopes,
  ...instagramPageMessageScopes,
  instagramLoginMessageScope,
]);

const NodeSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  instagram_business_account: Schema.optionalKey(
    Schema.Struct({ id: Schema.NonEmptyString })
  ),
});

const nodeOf = HttpClientResponse.schemaBodyJson(NodeSchema);

/** An account whose events a subscription carries. */
interface Carried {
  readonly accountId: string;
  /** The app whose subscription carries it. */
  readonly connection: "facebookLogin" | "instagramLogin";
  readonly platform: "facebook" | "instagram";
}

/**
 * Meta's subscription to a disconnected channel's message events, stopped
 * (`DELETE /me/subscribed_apps`, the Graph reference of
 * `/{page-id}/subscribed_apps`, read 2026-11-16: "You can dissociate an
 * Application from a Page by making a DELETE request") with the tokens the
 * channel held, once no other channel of Peal's reads the messages of an
 * account it carries: through Facebook Login the Page's subscription
 * carries the Page and the Instagram account linked to it, read with the
 * Page's token (`/me?fields=id,instagram_business_account`); through
 * Instagram Login the account's own, on graph.instagram.com without
 * proof. Only where the inbox reads the platform's messages, and for a
 * channel that granted their permissions: elsewhere nothing is called.
 * Needs ChannelDirectory, EngagementRecords and Mac.
 */
export const metaMessageDepartures = (settings: {
  readonly hosts: MetaHosts;
  readonly http: MetaHttp;
  /** Meta's main app, whose proof Facebook Login's calls carry. */
  readonly mainApp: Option.Option<MetaApp>;
  readonly messages: InboxMessagePlatforms;
}) =>
  Layer.effect(
    ChannelDepartures,
    Effect.gen(function* MetaMessageDepartures() {
      const directory = yield* ChannelDirectory;
      const records = yield* EngagementRecords;
      const mac = yield* Mac.Mac;
      const { hosts, http } = settings;

      // A call as the account: on Instagram Login's host without proof,
      // on the Graph with the main app's proof otherwise.
      const call = Effect.fnUntraced(function* call(
        viaInstagramLogin: boolean,
        tokens: StoredTokens,
        method: "DELETE" | "GET",
        path: string,
        params: Readonly<Record<string, string>> = {}
      ) {
        // Both stay Redacted, so a trace of the call shows neither.
        const proof =
          viaInstagramLogin || Option.isNone(settings.mainApp)
            ? {}
            : {
                appsecret_proof: yield* appSecretProof(
                  tokens.accessToken,
                  settings.mainApp.value.appSecret
                ).pipe(Effect.provideService(Mac.Mac, mac)),
              };

        const url = viaInstagramLogin
          ? instagramUrl(hosts, path)
          : graphUrl(hosts, path);

        return yield* http.execute(
          HttpClientRequest.make(method)(url).pipe(
            HttpClientRequest.setUrlParams({
              ...params,
              ...proof,
              access_token: tokens.accessToken,
            })
          )
        );
      });

      const carriedBy = Effect.fnUntraced(function* carriedBy(
        channel: Channel,
        tokens: StoredTokens,
        viaInstagramLogin: boolean
      ) {
        if (viaInstagramLogin) {
          const own: readonly Carried[] = [
            {
              accountId: channel.accountId,
              connection: "instagramLogin",
              platform: "instagram",
            },
          ];

          return own;
        }

        const response = yield* call(false, tokens, "GET", "/me", {
          fields: "id,instagram_business_account{id}",
        });

        const page = yield* nodeOf(response);

        const linked = Option.fromUndefinedOr(
          page.instagram_business_account?.id
        );

        const carried: readonly Carried[] =
          channel.platform === "facebook"
            ? [
                {
                  accountId: channel.accountId,
                  connection: "facebookLogin",
                  platform: "facebook",
                },
                ...Option.toArray(linked).map((accountId) => ({
                  accountId,
                  connection: "facebookLogin" as const,
                  platform: "instagram" as const,
                })),
              ]
            : [
                {
                  accountId: channel.accountId,
                  connection: "facebookLogin",
                  platform: "instagram",
                },
                {
                  accountId: page.id,
                  connection: "facebookLogin",
                  platform: "facebook",
                },
              ];

        return carried;
      });

      // The other channels whose events come through the subscription of
      // one of the accounts, by its app: neither the one leaving nor those
      // leaving with it.
      const othersOf = (
        leaving: ReadonlySet<string>,
        carried: readonly Carried[]
      ) =>
        Effect.all(
          carried.map((account) =>
            directory
              .withAccount(account.platform, account.accountId)
              .pipe(
                Effect.map((found) =>
                  found.filter(
                    (other) =>
                      !leaving.has(other.channelId) &&
                      (account.platform === "facebook" ||
                        Option.getOrElse(
                          other.connection,
                          () => "facebookLogin"
                        ) === account.connection)
                  )
                )
              )
          )
        ).pipe(
          Effect.map((found) => found.flat().map(({ channelId }) => channelId))
        );

      const departing = Effect.fnUntraced(function* departing(
        channel: Channel,
        tokens: StoredTokens,
        leavingWith: readonly ChannelId[]
      ) {
        const { platform } = channel;

        if (
          (platform !== "facebook" && platform !== "instagram") ||
          !settings.messages.has(platform) ||
          !channel.scopes.some((scope) => messaging.has(scope))
        ) {
          return;
        }

        const viaInstagramLogin =
          platform === "instagram" &&
          Option.contains(channel.connection, "instagramLogin");

        const carried = yield* carriedBy(channel, tokens, viaInstagramLogin);
        const leaving = new Set<string>([channel.id, ...leavingWith]);

        if (yield* records.readsMessages(yield* othersOf(leaving, carried))) {
          return;
        }

        const stopped = yield* call(
          viaInstagramLogin,
          tokens,
          "DELETE",
          "/me/subscribed_apps"
        );

        yield* stopped.status >= 200 && stopped.status < 300
          ? Effect.void
          : Effect.fail(new PlatformUnavailable());

        // A channel of those accounts turned on since the check followed a
        // subscription that is now gone: it follows again at its next read.
        yield* records.refollow(yield* othersOf(leaving, carried));
      });

      return ChannelDepartures.of({
        departed: (channel, tokens, leaving = []) =>
          departing(channel, tokens, leaving).pipe(
            Effect.timeout(departureWait),
            Effect.as<DepartureOutcome>("done"),
            // Logged by the channel's id alone: an answer may name others.
            Effect.catch(() =>
              Effect.logWarning(
                "Meta did not stop a disconnected channel's message events"
              ).pipe(
                Effect.annotateLogs({ channelId: channel.id }),
                Effect.as<DepartureOutcome>("failed")
              )
            ),
            Effect.catchDefect(() => Effect.succeed<DepartureOutcome>("failed"))
          ),
      });
    })
  );
