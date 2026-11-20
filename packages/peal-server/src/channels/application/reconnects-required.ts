import { Effect, Metric } from "effect";

import type { Channel } from "#channels/domain/channel.ts";

/**
 * Why a channel was marked to reconnect: the platform refused its token
 * when it was used (`tokenRefused`), the token sweep could not renew it
 * (`renewalRefused`), it expired with no way to renew it (`expired`), or
 * the account removed the app on the platform (`deauthorized`).
 */
export type ReconnectCause =
  | "deauthorized"
  | "expired"
  | "renewalRefused"
  | "tokenRefused";

/**
 * Channels marked to reconnect, by platform and cause, counted once as
 * each leaves `active`. Nothing names a workspace or an account. Many at
 * once mean the platform or the app, not the accounts:
 * `peal-channels-reconnect-wave` watches it.
 */
export const reconnectsRequired = Metric.counter(
  "peal.channels.reconnect_required",
  {
    description: "Channels marked to reconnect, by platform and cause",
    incremental: true,
  }
);

/** Counts `marked` when marking changed what `before` was. */
export const countReconnect = (
  before: Channel,
  marked: Channel,
  cause: ReconnectCause
) =>
  before.status._tag === marked.status._tag
    ? Effect.void
    : Metric.update(
        Metric.withAttributes(reconnectsRequired, {
          cause,
          platform: marked.platform,
        }),
        1
      );
