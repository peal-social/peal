import { Effect, Match, Option, Redacted, Schema } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";
import {
  Api,
  ChannelNotFound,
  ChatConnectLimited,
  ChatNotConnected,
  ConnectFailed,
  CurrentMember,
  defaultChannelPageSize,
  OAuthClientNotPublished,
  PlatformUnreachable,
  SiteConnectLimited,
  SiteNotConnected,
} from "peal-contract";
import type {
  PlanLimitReached,
  UsageAllowanceReached,
  ConnectCallback,
  ConnectFailureReason,
  ConnectOutcome as ConnectOutcomeView,
  Forbidden,
} from "peal-contract";

import { ChannelSettings } from "#channels/application/channel-settings.ts";
import { ConnectChannel } from "#channels/application/connect-channel.ts";
import type {
  ChooseFailure,
  CompleteConnectFailure,
  ConnectOutcome,
  ReconnectFailure,
  StartFailure,
} from "#channels/application/connect-channel.ts";
import { ConnectChat } from "#channels/application/connect-chat.ts";
import type { ConnectChatFailure } from "#channels/application/connect-chat.ts";
import { ConnectSite } from "#channels/application/connect-site.ts";
import type { ConnectSiteFailure } from "#channels/application/connect-site.ts";
import { DisconnectChannel } from "#channels/application/disconnect-channel.ts";
import { ListChannels } from "#channels/application/list-channels.ts";
import { OAuthClientDocuments } from "#channels/application/oauth-client-documents.ts";
import type { AuthorizationCallback } from "#channels/application/platform-authorizer.ts";
import { SiteSignIns } from "#channels/application/site-sign-ins.ts";
import type { SiteSignInFailure } from "#channels/application/site-sign-ins.ts";
import { actorOf } from "#shared/api/actor.ts";
import { allowanceRefusal } from "#shared/api/allowance-reached.ts";
import type { AllowanceRefusal } from "#shared/api/allowance-reached.ts";
import { forbidden } from "#shared/api/forbidden.ts";
import { limitRefusal } from "#shared/api/limit-reached.ts";
import type { LimitRefusal } from "#shared/api/limit-reached.ts";
import { isConnectionOf } from "#shared/domain/channel-connection.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import type { ChannelId } from "#shared/domain/ids.ts";

import { toChannelView } from "./channel-view.ts";

const refused = (reason: ConnectFailureReason) =>
  Effect.fail(new ConnectFailed({ reason }));

const callbackOf = (payload: ConnectCallback): AuthorizationCallback => ({
  code: Option.fromUndefinedOr(payload.code),
  error: Option.fromUndefinedOr(payload.error),
  issuer: Option.fromUndefinedOr(payload.iss),
  state: payload.state,
});

// How starting fails, whether to connect an account or to reconnect one.
type BeginRefusal = Exclude<
  StartFailure,
  { readonly _tag: "AllowanceReached" | "PlanLimitReached" }
>;

// Every way starting a connection can fail but the plan, as the contract
// tells clients. A failure that is the server's own (the database, a bug)
// is a defect: 500.
const beginFailure = (failure: BeginRefusal) =>
  Match.valueTags(failure, {
    AuthorizationFailed: ({ reason }) =>
      Effect.logWarning("A platform did not authorize an account").pipe(
        Effect.annotateLogs({ reason }),
        Effect.andThen(refused("authorizationFailed"))
      ),
    DatabaseError: Effect.die,
    InstanceNotAllowed: () => refused("instanceNotAllowed"),
    InvalidHandle: () => refused("invalidHandle"),
    InvalidInstance: () => refused("invalidInstance"),
    MissingPermission: forbidden,
    MissingTokenKey: () =>
      Effect.logError(
        "A channel was not connected: PEAL_TOKEN_KEYS is not set"
      ).pipe(Effect.andThen(refused("notConfigured"))),
    PlatformNotConnectable: ({ reason }) =>
      refused(
        reason === "notConfigured" ? "notConfigured" : "platformNotSupported"
      ),
    PlatformUnavailable: () => Effect.fail(new PlatformUnreachable()),
  });

// Connecting a new account also needs room in the plan, and, for a
// platform passed through at its rates (X), per-account pricing.
const startFailureWith =
  (limitReached: LimitRefusal, allowanceReached: AllowanceRefusal) =>
  (
    failure: StartFailure
  ): Effect.Effect<
    never,
    | ConnectFailed
    | Forbidden
    | PlanLimitReached
    | PlatformUnreachable
    | UsageAllowanceReached,
    CurrentMember
  > => {
    if (failure._tag === "PlanLimitReached") {
      return limitReached(failure);
    }

    return failure._tag === "AllowanceReached"
      ? allowanceReached(failure)
      : beginFailure(failure);
  };

// Reconnecting adds no channel, so the plan never refuses it.
const reconnectFailure = (
  failure: ReconnectFailure
): Effect.Effect<
  never,
  ChannelNotFound | ConnectFailed | Forbidden | PlatformUnreachable
> =>
  failure._tag === "ChannelNotFound"
    ? Effect.fail(new ChannelNotFound())
    : beginFailure(failure);

type Refusal = Effect.Effect<
  never,
  | ChannelNotFound
  | ConnectFailed
  | Forbidden
  | PlanLimitReached
  | PlatformUnreachable
  | UsageAllowanceReached,
  CurrentMember
>;

// Completing fails as starting does, and also on the callback itself.
const completeFailureWith =
  (startFailure: ReturnType<typeof startFailureWith>) =>
  (failure: CompleteConnectFailure): Refusal =>
    Match.valueTags(failure, {
      AllowanceReached: startFailure,
      AuthorizationDenied: () => refused("denied"),
      AuthorizationFailed: startFailure,
      ChannelNotFound: () => Effect.fail(new ChannelNotFound()),
      DatabaseError: startFailure,
      InstanceNotAllowed: startFailure,
      InvalidConnectState: () => refused("invalidState"),
      MissingPermission: startFailure,
      MissingTokenKey: startFailure,
      NoAccountsToConnect: () => refused("noAccounts"),
      PlanLimitReached: startFailure,
      PlatformNotConnectable: startFailure,
      PlatformUnavailable: startFailure,
      ReconnectAccountMismatch: () => refused("accountMismatch"),
    });

// Choosing fails as completing does: the choice, like the attempt, is the
// member's own and is used once.
const chooseFailureWith =
  (startFailure: ReturnType<typeof startFailureWith>) =>
  (failure: ChooseFailure): Refusal =>
    Match.valueTags(failure, {
      AllowanceReached: startFailure,
      AuthorizationFailed: startFailure,
      ChannelNotFound: () => Effect.fail(new ChannelNotFound()),
      DatabaseError: startFailure,
      InvalidConnectState: () => refused("invalidState"),
      MissingPermission: startFailure,
      MissingTokenKey: startFailure,
      PlanLimitReached: startFailure,
      PlatformNotConnectable: startFailure,
      ReconnectAccountMismatch: () => refused("accountMismatch"),
    });

const outcomeView = (outcome: ConnectOutcome): ConnectOutcomeView =>
  outcome._tag === "connected"
    ? { _tag: "connected", channel: toChannelView(outcome.channel) }
    : {
        _tag: "choose",
        accounts: outcome.accounts.map((account) => ({
          accountId: account.accountId,
          avatarUrl: Option.getOrNull(account.avatarUrl),
          connected: account.connected,
          displayName: Option.getOrNull(account.displayName),
          handle: account.handle,
        })),
        connection: Option.getOrNull(outcome.connection),
        expiresAt: outcome.expiresAt,
        selection: outcome.selection,
      };

const decodeChannelId = Schema.decodeUnknownOption(ChannelIdSchema);

// How naming a channel, or turning it off or on, fails.
const settingFailures = {
  ChannelNotFound: () => Effect.fail(new ChannelNotFound()),
  DatabaseError: Effect.die,
  MissingPermission: forbidden,
} as const;

// How connecting a website fails, as the contract tells clients.
const siteFailureWith =
  (limitReached: LimitRefusal) => (failure: ConnectSiteFailure) =>
    Match.valueTags(failure, {
      DatabaseError: Effect.die,
      MissingPermission: forbidden,
      MissingTokenKey: () =>
        Effect.logError(
          "A website was not connected: PEAL_TOKEN_KEYS is not set"
        ).pipe(Effect.andThen(refused("notConfigured"))),
      PlanLimitReached: limitReached,
      PlatformUnavailable: () =>
        Effect.logWarning("A website did not answer while connecting").pipe(
          Effect.andThen(Effect.fail(new PlatformUnreachable()))
        ),
      SiteConnectLimited: () => Effect.fail(new SiteConnectLimited()),
      SiteRefused: ({ reason }) =>
        Effect.fail(new SiteNotConnected({ reason })),
    });

// How connecting a chat fails, as the contract tells clients. The
// platform's refusal keeps its reason, never its words.
const chatFailureWith =
  (limitReached: LimitRefusal) => (failure: ConnectChatFailure) =>
    Match.valueTags(failure, {
      ChannelNotFound: () => Effect.fail(new ChannelNotFound()),
      ChatConnectLimited: () => Effect.fail(new ChatConnectLimited()),
      ChatRefused: ({ reason }) =>
        Effect.fail(new ChatNotConnected({ reason })),
      DatabaseError: Effect.die,
      MissingPermission: forbidden,
      MissingTokenKey: () =>
        Effect.logError(
          "A chat was not connected: PEAL_TOKEN_KEYS is not set"
        ).pipe(Effect.andThen(refused("notConfigured"))),
      PlanLimitReached: limitReached,
      PlatformUnavailable: () =>
        Effect.logWarning(
          "A chat's platform did not answer while connecting"
        ).pipe(Effect.andThen(Effect.fail(new PlatformUnreachable()))),
      ReconnectAccountMismatch: () => refused("accountMismatch"),
    });

// How a website sign-in fails, as the contract tells clients.
const signInFailureWith =
  (
    siteFailure: (
      failure: ConnectSiteFailure
    ) => ReturnType<ReturnType<typeof siteFailureWith>>
  ) =>
  (failure: SiteSignInFailure) =>
    Match.valueTags(failure, {
      AuthorizationDenied: () => refused("denied"),
      AuthorizationFailed: ({ reason }) =>
        Effect.logWarning("A website's platform did not authorize a site").pipe(
          Effect.annotateLogs({ reason }),
          Effect.andThen(refused("authorizationFailed"))
        ),
      ChannelNotFound: () => Effect.fail(new ChannelNotFound()),
      DatabaseError: siteFailure,
      InvalidConnectState: () => refused("invalidState"),
      MissingPermission: siteFailure,
      MissingTokenKey: siteFailure,
      PlanLimitReached: siteFailure,
      PlatformNotConnectable: () => refused("notConfigured"),
      PlatformUnavailable: siteFailure,
      ReconnectAccountMismatch: () => refused("accountMismatch"),
      SiteConnectLimited: siteFailure,
      SiteRefused: siteFailure,
    });

export const ChannelsHandlers = HttpApiBuilder.group(
  Api,
  "channels",
  Effect.fn(function* channelsHandlers(handlers) {
    const listChannels = yield* ListChannels;
    const disconnectChannel = yield* DisconnectChannel;
    const settings = yield* ChannelSettings;
    const connectChannel = yield* ConnectChannel;
    const connectSite = yield* ConnectSite;
    const connectChat = yield* ConnectChat;
    const siteSignIns = yield* SiteSignIns;

    const startFailure = startFailureWith(
      yield* limitRefusal,
      yield* allowanceRefusal
    );

    const siteFailure = siteFailureWith(yield* limitRefusal);
    const chatFailure = chatFailureWith(yield* limitRefusal);
    const signInFailure = signInFailureWith(siteFailure);
    const completeFailure = completeFailureWith(startFailure);
    const chooseFailure = chooseFailureWith(startFailure);

    return handlers.handleAll({
      chooseAccounts: ({ params, payload }) =>
        Effect.gen(function* chooseAccounts() {
          const actor = actorOf(yield* CurrentMember);

          const channels = yield* connectChannel
            .choose(actor, params.platform, payload)
            .pipe(Effect.catch(chooseFailure));

          return channels.map(toChannelView);
        }),
      completeConnect: ({ params, payload }) =>
        Effect.gen(function* completeConnect() {
          const actor = actorOf(yield* CurrentMember);

          const outcome = yield* connectChannel
            .complete(actor, params.platform, callbackOf(payload))
            .pipe(Effect.catch(completeFailure));

          return outcomeView(outcome);
        }),
      connect: ({ params, payload }) =>
        Effect.gen(function* connect() {
          const actor = actorOf(yield* CurrentMember);

          const authorizationUrl = yield* connectChannel
            .start(actor, params.platform, {
              // A way in names its own platform's, and others have one.
              connection: Option.fromUndefinedOr(payload.connection).pipe(
                Option.filter((connection) =>
                  isConnectionOf(params.platform, connection)
                )
              ),
              handle: Option.fromUndefinedOr(payload.handle),
              instance: Option.fromUndefinedOr(payload.instance),
            })
            .pipe(Effect.catch(startFailure));

          return { authorizationUrl };
        }),
      connectChat: ({ payload }) =>
        Effect.gen(function* connectChatHandler() {
          const actor = actorOf(yield* CurrentMember);

          // A channel id that is no channel's is no channel of the
          // workspace.
          const reconnecting = Option.fromUndefinedOr(payload.channelId);
          const channelId = reconnecting.pipe(Option.flatMap(decodeChannelId));

          if (Option.isSome(reconnecting) && Option.isNone(channelId)) {
            return yield* new ChannelNotFound();
          }

          const channel = yield* connectChat
            .connect(
              actor,
              payload.platform === "discord"
                ? {
                    platform: "discord",
                    webhookUrl: Redacted.make(payload.webhookUrl),
                  }
                : {
                    botToken: Redacted.make(payload.botToken),
                    chat: payload.chat,
                    platform: "telegram",
                  },
              channelId
            )
            .pipe(Effect.catch(chatFailure));

          return toChannelView(channel);
        }),
      connectSite: ({ payload }) =>
        Effect.gen(function* connectSiteHandler() {
          const actor = actorOf(yield* CurrentMember);

          const channel = yield* connectSite
            .connect(actor, {
              address: payload.address,
              applicationPassword: Redacted.make(payload.applicationPassword),
              platform: payload.platform,
              userName: payload.userName,
            })
            .pipe(Effect.catch(siteFailure));

          return toChannelView(channel);
        }),
      connectSiteWithKey: ({ payload }) =>
        Effect.gen(function* connectSiteWithKeyHandler() {
          const actor = actorOf(yield* CurrentMember);

          const channel = yield* connectSite
            .connectWithKey(actor, {
              apiKey: Redacted.make(payload.apiKey),
              platform: payload.platform,
              publication: Option.fromUndefinedOr(payload.publication),
            })
            .pipe(Effect.catch(siteFailure));

          return toChannelView(channel);
        }),
      startSiteSignIn: ({ params, payload }) =>
        Effect.gen(function* startSiteSignInHandler() {
          const actor = actorOf(yield* CurrentMember);

          const authorizationUrl = yield* siteSignIns
            .start(
              actor,
              params.platform,
              Option.fromUndefinedOr(payload.channelId)
            )
            .pipe(Effect.catch(signInFailure));

          return { authorizationUrl };
        }),
      completeSiteSignIn: ({ params, payload }) =>
        Effect.gen(function* completeSiteSignInHandler() {
          const actor = actorOf(yield* CurrentMember);

          const channel = yield* siteSignIns
            .complete(actor, params.platform, {
              code: Option.fromUndefinedOr(payload.code),
              error: Option.fromUndefinedOr(payload.error),
              issuer: Option.none(),
              state: payload.state,
            })
            .pipe(Effect.catch(signInFailure));

          return toChannelView(channel);
        }),
      disable: ({ params }) =>
        Effect.gen(function* disable() {
          const actor = actorOf(yield* CurrentMember);

          return yield* settings
            .turnOff(actor, params.channelId)
            .pipe(Effect.map(toChannelView), Effect.catchTags(settingFailures));
        }),
      disconnect: ({ params }) =>
        Effect.gen(function* disconnect() {
          const actor = actorOf(yield* CurrentMember);

          yield* disconnectChannel.disconnect(actor, params.channelId).pipe(
            Effect.catchTags({
              ChannelNotFound: () => Effect.fail(new ChannelNotFound()),
              DatabaseError: Effect.die,
              MissingPermission: forbidden,
            })
          );
        }),
      enable: ({ params }) =>
        Effect.gen(function* enable() {
          const actor = actorOf(yield* CurrentMember);

          return yield* settings
            .turnOn(actor, params.channelId)
            .pipe(Effect.map(toChannelView), Effect.catchTags(settingFailures));
        }),
      find: ({ query }) =>
        Effect.gen(function* find() {
          const actor = actorOf(yield* CurrentMember);

          // A cursor is the id of the page's last channel: one that is no
          // channel id is none a page gave.
          const after = yield* Option.match(
            Option.fromUndefinedOr(query.cursor),
            {
              onNone: () => Effect.succeed(Option.none<ChannelId>()),
              onSome: (cursor) =>
                Option.match(decodeChannelId(cursor), {
                  onNone: () => Effect.fail(new HttpApiError.BadRequest()),
                  onSome: (id) => Effect.succeed(Option.some(id)),
                }),
            }
          );

          const page = yield* listChannels
            .search(actor, {
              after,
              limit: query.limit ?? defaultChannelPageSize,
              platform: Option.fromUndefinedOr(query.platform),
              query: Option.fromUndefinedOr(query.q),
              status: Option.fromUndefinedOr(query.status),
            })
            .pipe(
              Effect.catchTags({
                DatabaseError: Effect.die,
                MissingPermission: forbidden,
              })
            );

          return {
            counts: page.counts,
            items: page.items.map(toChannelView),
            nextCursor: Option.getOrNull(page.next),
          };
        }),
      list: () =>
        Effect.gen(function* list() {
          const actor = actorOf(yield* CurrentMember);

          const channels = yield* listChannels.list(actor).pipe(
            Effect.catchTags({
              DatabaseError: Effect.die,
              MissingPermission: forbidden,
            })
          );

          return channels.map(toChannelView);
        }),
      platforms: () =>
        Effect.gen(function* platforms() {
          const actor = actorOf(yield* CurrentMember);

          const connectable = yield* connectChannel
            .connectable(actor)
            .pipe(Effect.catchTag("MissingPermission", forbidden));

          return {
            instagramConnections: connectable.instagramConnections,
            linkedinConnections: connectable.linkedinConnections,
            // Both chats need no setting: they connect with the member's
            // own secret.
            chats: ["discord" as const, "telegram" as const],
            platforms: connectable.platforms,
            sites: [
              "wordpress" as const,
              "devto" as const,
              "hashnode" as const,
              ...(siteSignIns.configured("wordpressCom")
                ? ["wordpressCom" as const]
                : []),
            ],
          };
        }),
      reconnect: ({ params, query }) =>
        Effect.gen(function* reconnect() {
          const actor = actorOf(yield* CurrentMember);

          const authorizationUrl = yield* connectChannel
            .reconnect(actor, params.channelId, {
              messages: query.messages === "true",
              reposts: query.reposts === "true",
            })
            .pipe(Effect.catch(reconnectFailure));

          return { authorizationUrl };
        }),
      update: ({ params, payload }) =>
        Effect.gen(function* update() {
          const actor = actorOf(yield* CurrentMember);

          return yield* settings
            .rename(actor, params.channelId, Option.fromNullOr(payload.label))
            .pipe(Effect.map(toChannelView), Effect.catchTags(settingFailures));
        }),
    });
  })
);

const notPublished = () => Effect.fail(new OAuthClientNotPublished());

/** The documents that identify Peal's OAuth clients, served to anyone. */
export const ChannelOAuthHandlers = HttpApiBuilder.group(
  Api,
  "channelOAuth",
  Effect.fn(function* channelOAuthHandlers(handlers) {
    const documents = yield* OAuthClientDocuments;

    return handlers.handleAll({
      blueskyClientMetadata: () =>
        Option.match(documents.bluesky, {
          onNone: notPublished,
          onSome: ({ metadata }) => Effect.succeed(metadata),
        }),
      blueskyJwks: () =>
        Option.match(documents.bluesky, {
          onNone: notPublished,
          onSome: ({ jwks }) => Effect.succeed(jwks),
        }),
    });
  })
);
