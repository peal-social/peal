import { Duration, Effect, Match } from "effect";
import { CurrentMember } from "peal-contract";

import { CapabilityTools } from "#app/mcp/capabilities-tools.ts";
import { notAllowed, refuse } from "#app/mcp/refusals.ts";
import { channelCapabilitiesView } from "#publishing/api/capabilities-view.ts";
import { lookupResultView } from "#publishing/api/lookup-view.ts";
import { ChannelLookups } from "#publishing/application/channel-lookups.ts";
import { PostingCapabilities } from "#publishing/application/posting-capabilities.ts";
import {
  channelRefusalOf,
  readRefusedCode,
} from "#publishing/domain/own-refusals.ts";
import { actorOf } from "#shared/api/actor.ts";
import type { RateLimited } from "#shared/domain/rate-limited.ts";

const notAChannel = () =>
  refuse(
    "This is not one of the workspace's channels: list_channels answers them."
  );

const reconnect = () =>
  refuse(
    "The channel must be reconnected, in the web app, before its platform answers."
  );

const turnedOff = () =>
  refuse(
    "This channel is turned off: enable_channel turns it back on, to use it."
  );

const unanswered = () =>
  refuse("The platform did not answer: try again in a few minutes.");

// A refusal that may come back the same each time: an agent must not loop.
const repeated = () =>
  refuse(
    "The platform refused this lookup, or this server would not reach it: trying again may not help. If it keeps failing, the server's operator must look at the server's logs."
  );

const slowDown = ({ retryAfter }: RateLimited) =>
  refuse(
    retryAfter === undefined
      ? "The platform asked to slow down, or its allowance for today is spent: try again later."
      : `The platform asked to slow down: try again in ${String(Math.ceil(Duration.toSeconds(retryAfter)))} seconds.`
  );

/**
 * What the capability tools do, through the publishing context's use
 * cases.
 */
export const CapabilityToolsLive = CapabilityTools.toLayer(
  Effect.gen(function* capabilityTools() {
    const capabilities = yield* PostingCapabilities;
    const lookups = yield* ChannelLookups;

    const actor = CurrentMember.pipe(Effect.map(actorOf));

    return CapabilityTools.of({
      get_channel_capabilities: ({ channelId }) =>
        actor.pipe(
          Effect.flatMap((member) => capabilities.channel(member, channelId)),
          Effect.map(channelCapabilitiesView),
          Effect.catchTags({
            DatabaseError: Effect.die,
            MissingPermission: notAllowed("read what a channel takes"),
            UnknownChannels: notAChannel,
          })
        ),
      run_channel_lookup: ({ channelId, input, name }) =>
        actor.pipe(
          Effect.flatMap((member) =>
            lookups.run(member, channelId, name, input ?? {})
          ),
          Effect.map((result) => ({ result: lookupResultView(result) })),
          Effect.catchTags({
            BadRequest: ({ code }) =>
              Match.value(channelRefusalOf(code)).pipe(
                Match.when("disabled", turnedOff),
                Match.when("disconnected", notAChannel),
                Match.when("other", repeated),
                Match.exhaustive
              ),
            DatabaseError: Effect.die,
            LookupInputRejected: () =>
              refuse(
                `The lookup ${name} does not take this input: get_channel_capabilities lists the fields it takes, and the values each allows. A cursor must be one a page before answered.`
              ),
            MissingPermission: notAllowed("ask a channel's platform"),
            PlatformUnavailable: ({ code }) =>
              code === readRefusedCode ? repeated() : unanswered(),
            RateLimited: slowDown,
            TokenExpired: reconnect,
            UnknownChannels: notAChannel,
            UnknownLookup: () =>
              refuse(
                `This channel's platform has no lookup named ${name}: get_channel_capabilities lists those it has.`
              ),
          })
        ),
    });
  })
);
