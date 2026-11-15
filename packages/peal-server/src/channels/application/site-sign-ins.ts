import {
  Context,
  DateTime,
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";

import type { Channel } from "#channels/domain/channel.ts";
import {
  completableBy,
  startAttempt,
  starterOf,
} from "#channels/domain/connect-attempt.ts";
import { InvalidConnectState } from "#channels/domain/invalid-connect-state.ts";
import type { Actor } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import type { OAuthSitePlatform } from "#shared/domain/platform.ts";

import { AuthorizationDenied } from "./authorization-denied.ts";
import { AuthorizationFailed } from "./authorization-failed.ts";
import { ChannelNotFound } from "./channel-not-found.ts";
import { ChannelRepository } from "./channel-repository.ts";
import { ConnectAttempts } from "./connect-attempts.ts";
import { ConnectSite } from "./connect-site.ts";
import type { ConnectSiteFailure } from "./connect-site.ts";
import type { AuthorizationCallback } from "./platform-authorizer.ts";
import { PlatformNotConnectable } from "./platform-not-connectable.ts";
import type { ReconnectAccountMismatch } from "./reconnect-account-mismatch.ts";
import { SiteAuthorizers } from "./site-authorizer.ts";
import { SiteConnectPace } from "./site-connect-pace.ts";
import { connectAttemptContext, TokenCipher } from "./token-cipher.ts";

const decodeChannelId = Schema.decodeUnknownOption(ChannelIdSchema);

export type SiteSignInFailure =
  | AuthorizationDenied
  | AuthorizationFailed
  | ChannelNotFound
  | ConnectSiteFailure
  | InvalidConnectState
  | PlatformNotConnectable
  | ReconnectAccountMismatch;

/**
 * Connects a website by signing in on its platform (WordPress.com), as a
 * social account connects: `start` keeps the attempt, bound to the member
 * and the workspace for 15 minutes (`ConnectAttempts`), and answers where
 * to send the member; `complete` takes it once, exchanges the code for
 * the site and its token, and keeps them as `ConnectSite` keeps any
 * website. A new site needs room in the plan, checked before the member
 * leaves when the workspace has no site of that platform; a reconnect
 * must reach its channel's site again. Tries count with the workspace's
 * other website connections (`SiteConnectPace`). Needs channel:connect.
 */
export class SiteSignIns extends Context.Service<
  SiteSignIns,
  {
    readonly start: (
      actor: Actor,
      platform: OAuthSitePlatform,
      channelId: Option.Option<string>
    ) => Effect.Effect<string, SiteSignInFailure>;
    readonly complete: (
      actor: Actor,
      platform: OAuthSitePlatform,
      returned: AuthorizationCallback
    ) => Effect.Effect<Channel, SiteSignInFailure>;
    /** Whether this server has the platform's app. */
    readonly configured: (platform: OAuthSitePlatform) => boolean;
  }
>()("peal-server/channels/application/SiteSignIns") {
  static readonly layer = Layer.effect(
    SiteSignIns,
    Effect.gen(function* SiteSignInsLive() {
      const authorizers = yield* SiteAuthorizers;
      const attempts = yield* ConnectAttempts;
      const channels = yield* ChannelRepository;
      const cipher = yield* TokenCipher;
      const pace = yield* SiteConnectPace;
      const sites = yield* ConnectSite;

      const authorizerFor = (platform: OAuthSitePlatform) =>
        Option.match(authorizers.for(platform), {
          onNone: () =>
            Effect.fail(
              new PlatformNotConnectable({ platform, reason: "notConfigured" })
            ),
          onSome: Effect.succeed,
        });

      // The workspace's channel of the platform the id names.
      const channelOf = Effect.fn("SiteSignIns.channelOf")(function* channelOf(
        actor: Actor,
        platform: OAuthSitePlatform,
        channelId: string
      ) {
        const id = decodeChannelId(channelId);

        const found = Option.isSome(id)
          ? yield* channels.findById(actor.workspaceId, id.value)
          : Option.none<Channel>();

        if (Option.isNone(found) || found.value.platform !== platform) {
          return yield* new ChannelNotFound({ channelId });
        }

        return found.value;
      });

      const start = Effect.fn("SiteSignIns.start")(function* start(
        actor: Actor,
        platform: OAuthSitePlatform,
        channelId: Option.Option<string>
      ) {
        yield* Effect.fromResult(authorize(actor, "channel:connect"));

        const authorizer = yield* authorizerFor(platform);

        const reconnecting = yield* Effect.transposeOption(
          channelId.pipe(Option.map((id) => channelOf(actor, platform, id)))
        );

        yield* pace.take(actor.workspaceId);

        // A new site needs room: asked before the member signs in, unless
        // the workspace has a site there the sign-in may reach again.
        if (Option.isNone(reconnecting)) {
          const known = (yield* channels.list(actor.workspaceId)).some(
            (channel) => channel.platform === platform
          );

          if (!known) {
            yield* sites.roomFor(actor);
          }
        }

        const pending = yield* authorizer.begin;
        const now = yield* DateTime.now;

        const attempt = startAttempt(
          {
            actor,
            channelId: reconnecting.pipe(Option.map((channel) => channel.id)),
            connection: Option.none(),
            instance: Option.none(),
            platform,
            state: pending.state,
          },
          now
        );

        // The flow keeps no secret: the state, sealed, stands in for one.
        const secret = yield* cipher.encryptSecret(
          Redacted.make(pending.state),
          connectAttemptContext(pending.state)
        );

        yield* attempts.save(attempt, secret);

        return pending.authorizationUrl;
      });

      const complete = Effect.fn("SiteSignIns.complete")(function* complete(
        actor: Actor,
        platform: OAuthSitePlatform,
        returned: AuthorizationCallback
      ) {
        yield* Effect.fromResult(authorize(actor, "channel:connect"));

        const taken = yield* attempts.take(returned.state, {
          platform,
          startedBy: starterOf(actor.subject),
          workspaceId: actor.workspaceId,
        });

        if (Option.isNone(taken)) {
          return yield* new InvalidConnectState();
        }

        const attempt = yield* Effect.fromResult(
          completableBy(
            taken.value.attempt,
            actor,
            platform,
            yield* DateTime.now
          )
        );

        const authorizer = yield* authorizerFor(platform);

        if (Option.isSome(returned.error)) {
          return yield* returned.error.value === "access_denied"
            ? new AuthorizationDenied()
            : new AuthorizationFailed({ reason: returned.error.value });
        }

        if (Option.isNone(returned.code)) {
          return yield* new AuthorizationFailed({
            reason: "the returned has no code",
          });
        }

        const grant = yield* authorizer.complete(returned.code.value);

        const reconnecting = yield* Effect.transposeOption(
          attempt.channelId.pipe(
            Option.map((id) => channelOf(actor, platform, id))
          )
        );

        return yield* sites.connectSigned(actor, platform, grant, reconnecting);
      });

      return SiteSignIns.of({
        complete,
        configured: (platform) => Option.isSome(authorizers.for(platform)),
        start,
      });
    })
  );
}
