import { Cause, Exit, Option, Schema } from "effect";
import { Atom } from "effect/reactivity";
import {
  ChatNotConnectedReasonSchema,
  ConnectFailureReasonSchema,
  SiteNotConnectedReasonSchema,
  forWorkspace,
} from "peal-contract";
import type {
  ChatNotConnectedReason,
  ConnectFailureReason,
  SiteNotConnectedReason,
} from "peal-contract";

import { PealApi } from "#api/client.ts";

// What refreshes a workspace's channel list once a change lands.
const channelsKey = (workspaceId: string) => `channels:${workspaceId}`;

// What the composer, the calendar and the reports read their channels
// under (`workspaceChannels`): a change here shows there too.
const everyChannelList = "channels";

export const channelsChanged = (workspaceId: string) => [
  channelsKey(workspaceId),
  everyChannelList,
];

/** The workspace's channels, fetched through /api with the visitor's cookies. */
export const channelsOf = Atom.family((workspaceId: string) =>
  PealApi.query("channels", "list", {
    headers: forWorkspace(workspaceId),
    reactivityKeys: channelsChanged(workspaceId),
  })
);

/**
 * The platforms this server connects, in Peal's order, fetched with the
 * visitor's cookies.
 */
export const connectablePlatformsOf = Atom.family((workspaceId: string) =>
  PealApi.query("channels", "platforms", { headers: forWorkspace(workspaceId) })
);

export const connectChannel = PealApi.mutation("channels", "connect");

export const completeConnection = PealApi.mutation(
  "channels",
  "completeConnect"
);

export const chooseAccounts = PealApi.mutation("channels", "chooseAccounts");

/** Connects a website by its address, a user and an application password. */
export const connectSite = PealApi.mutation("channels", "connectSite");

/** Connects an account on a publishing platform with a key made there. */
export const connectSiteWithKey = PealApi.mutation(
  "channels",
  "connectSiteWithKey"
);

/** Connects a chat with the secret its member pastes. */
export const connectChat = PealApi.mutation("channels", "connectChat");

/** Starts signing in to a website's platform (WordPress.com). */
export const startSiteSignIn = PealApi.mutation("channels", "startSiteSignIn");

export const completeSiteSignIn = PealApi.mutation(
  "channels",
  "completeSiteSignIn"
);

export const reconnectChannel = PealApi.mutation("channels", "reconnect");

export const disconnectChannel = PealApi.mutation("channels", "disconnect");

/** Gives a channel the workspace's own name for it, or takes it back. */
export const renameChannel = PealApi.mutation("channels", "update");

/** Turns a channel off: nothing goes out on it until it is turned back on. */
export const disableChannel = PealApi.mutation("channels", "disable");

export const enableChannel = PealApi.mutation("channels", "enable");

/**
 * The message explaining why a channel action failed: a ChannelsPage error,
 * or `planLimit`, which Billing explains.
 */
export type ChannelErrorKey =
  | ConnectFailureReason
  | SiteNotConnectedReason
  // A chat's refusals, apart from a website's of the same name.
  | `chat.${ChatNotConnectedReason}`
  | "chatTooManyTries"
  | "forbidden"
  | "notFound"
  | "planLimit"
  | "tooManyTries"
  | "unknown"
  | "unreachable"
  | "xPaymentFailed"
  | "xPaymentMethod"
  | "xPerAccountPricing";

// Several errors give a `reason`, each from its own list.
interface Tagged {
  readonly _tag: string;
  readonly reason?: string;
}

const isConnectFailure = Schema.is(ConnectFailureReasonSchema);

const isSiteRefusal = Schema.is(SiteNotConnectedReasonSchema);

const isChatRefusal = Schema.is(ChatNotConnectedReasonSchema);

// The contract's errors, told apart by tag; anything else, such as the
// server being down, is unknown.
const keyOf = (error: Tagged): ChannelErrorKey => {
  switch (error._tag) {
    case "ConnectFailed": {
      return isConnectFailure(error.reason) ? error.reason : "unknown";
    }

    case "SiteNotConnected": {
      return isSiteRefusal(error.reason) ? error.reason : "unknown";
    }

    case "PlatformUnreachable": {
      return "unreachable";
    }

    case "Forbidden": {
      return "forbidden";
    }

    case "ChannelNotFound": {
      return "notFound";
    }

    case "PlanLimitReached": {
      return "planLimit";
    }

    case "SiteConnectLimited": {
      return "tooManyTries";
    }

    case "ChatNotConnected": {
      return isChatRefusal(error.reason) ? `chat.${error.reason}` : "unknown";
    }

    case "ChatConnectLimited": {
      return "chatTooManyTries";
    }

    // X, billed at its rates, needs per-account pricing that pays: told
    // as the standing it lacks.
    case "UsageAllowanceReached": {
      if (error.reason === "paymentFailed") {
        return "xPaymentFailed";
      }

      return error.reason === "planAllowance"
        ? "xPerAccountPricing"
        : "xPaymentMethod";
    }

    default: {
      return "unknown";
    }
  }
};

/** The message key for what a mutation ended with, or none if it worked. */
export const failureOf = <A, E extends Tagged>(
  exit: Exit.Exit<A, E>
): Option.Option<ChannelErrorKey> =>
  Exit.isFailure(exit)
    ? Option.some(
        Cause.findErrorOption(exit.cause).pipe(
          Option.match({
            onNone: (): ChannelErrorKey => "unknown",
            onSome: keyOf,
          })
        )
      )
    : Option.none();
