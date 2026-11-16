import { DateTime, Duration, Effect, Layer, Option, Ref } from "effect";

import { ListingLimited } from "#ads/application/listing-limited.ts";
import { ListingPace } from "#ads/application/ports/listing-pace.ts";
import type { AdAccountFacts } from "#ads/domain/ad-account-facts.ts";
import type { AdGrant } from "#ads/domain/ad-grant.ts";
import { traitsOf } from "#ads/domain/network-traits.ts";

/** How often accounts are listed, and how long a listing is kept. */
export interface ListingPaceOptions {
  /** How long a sign-in's listing answers its next steps. */
  readonly keptFor: Duration.Duration;
  /**
   * The operations a day the listings of a network whose allowance is
   * shared may spend (`networkTraits`' `dailyOperations`).
   */
  readonly operationsPerDay: number;
  /** Listings a sign-in may make an hour. */
  readonly perGrantHour: number;
  /** Listings a workspace's sign-ins may make together an hour. */
  readonly perWorkspaceHour: number;
}

/**
 * Peal's defaults: a listing kept five minutes, ten a sign-in and thirty a
 * workspace an hour, and 300 operations a day for Google Ads' listings,
 * about a tenth of what Explorer access gives (2,880): the rest goes to
 * the reads every six hours.
 */
export const listingPaceDefaults: ListingPaceOptions = {
  keptFor: Duration.minutes(5),
  operationsPerDay: 300,
  perGrantHour: 10,
  perWorkspaceHour: 30,
};

interface Window {
  readonly count: number;
  readonly endsAt: number;
}

interface Kept {
  readonly accounts: readonly AdAccountFacts[];
  readonly at: number;
  readonly version: number;
}

const hour = Duration.toMillis(Duration.hours(1));
const day = Duration.toMillis(Duration.days(1));

// A grant renewed by a new sign-in is another listing's.
const versionOf = (grant: AdGrant) => DateTime.toEpochMillis(grant.updatedAt);

/**
 * ListingPace counted in this process, in fixed windows: an hour for the
 * sign-ins and the workspaces, a day for a network's operations. The
 * server runs as one process; a server run as several would count each.
 */
export const memoryListingPace = (options: ListingPaceOptions) =>
  Layer.effect(
    ListingPace,
    Effect.gen(function* MemoryListingPace() {
      const windows = yield* Ref.make(new Map<string, Window>());
      const kept = yield* Ref.make(new Map<string, Kept>());
      const now = DateTime.now.pipe(Effect.map(DateTime.toEpochMillis));

      // The window's count now, and when it ends; a window past its end
      // starts again.
      const windowOf = (
        all: ReadonlyMap<string, Window>,
        key: string,
        at: number,
        length: number
      ) => {
        const found = all.get(key);

        return found === undefined || found.endsAt <= at
          ? { count: 0, endsAt: at + length }
          : found;
      };

      return ListingPace.of({
        recent: (grant) =>
          Effect.gen(function* recent() {
            const at = yield* now;
            const found = (yield* Ref.get(kept)).get(grant.id);

            return Option.fromUndefinedOr(found).pipe(
              Option.filter(
                (entry) =>
                  entry.version === versionOf(grant) &&
                  at - entry.at < Duration.toMillis(options.keptFor)
              ),
              Option.map((entry) => entry.accounts)
            );
          }),
        remember: (grant, accounts) =>
          now.pipe(
            Effect.flatMap((at) =>
              Ref.update(kept, (all) =>
                new Map(all).set(grant.id, {
                  accounts,
                  at,
                  version: versionOf(grant),
                })
              )
            )
          ),
        spent: (network, operations) =>
          traitsOf(network).dailyOperations
            ? now.pipe(
                Effect.flatMap((at) =>
                  Ref.update(windows, (all) => {
                    const key = `operations:${network}`;
                    const current = windowOf(all, key, at, day);

                    return new Map(all).set(key, {
                      count: current.count + operations,
                      endsAt: current.endsAt,
                    });
                  })
                )
              )
            : Effect.void,
        take: (grant) =>
          Effect.gen(function* take() {
            const at = yield* now;
            const all = yield* Ref.get(windows);

            const limits = [
              [`grant:${grant.id}`, hour, options.perGrantHour, 1],
              [
                `workspace:${grant.workspaceId}`,
                hour,
                options.perWorkspaceHour,
                1,
              ],
              ...(traitsOf(grant.network).dailyOperations
                ? ([
                    [
                      `operations:${grant.network}`,
                      day,
                      options.operationsPerDay,
                      0,
                    ],
                  ] as const)
                : []),
            ] as const;

            for (const [key, length, limit] of limits) {
              const current = windowOf(all, key, at, length);

              if (current.count >= limit) {
                return yield* new ListingLimited({
                  retryAfter: Duration.millis(current.endsAt - at),
                });
              }
            }

            yield* Ref.update(windows, (latest) => {
              const next = new Map(latest);

              for (const [key, length, , taken] of limits) {
                const current = windowOf(latest, key, at, length);

                next.set(key, {
                  count: current.count + taken,
                  endsAt: current.endsAt,
                });
              }

              return next;
            });
          }),
      });
    })
  );

/** ListingPace with Peal's defaults. */
export const MemoryListingPace = memoryListingPace(listingPaceDefaults);
