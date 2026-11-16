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
  /** How many sign-ins' listings are kept at most. */
  readonly keptListings: number;
  /**
   * The operations a day the listings of a network whose allowance is
   * shared may spend (`networkTraits`' `dailyOperations`).
   */
  readonly operationsPerDay: number;
  /** The share of those one workspace's listings may spend a day. */
  readonly operationsPerWorkspaceDay: number;
  /** Listings a sign-in may make an hour. */
  readonly perGrantHour: number;
  /** Listings a workspace's sign-ins may make together an hour. */
  readonly perWorkspaceHour: number;
}

/**
 * Peal's defaults: a listing kept five minutes, a thousand sign-ins' at
 * most, ten listings a sign-in and thirty a workspace an hour, and 300
 * operations a day for Google Ads' listings, about a tenth of what
 * Explorer access gives (2,880), of which one workspace may spend 100: the
 * rest goes to the reads every six hours.
 */
export const listingPaceDefaults: ListingPaceOptions = {
  keptFor: Duration.minutes(5),
  keptListings: 1000,
  operationsPerDay: 300,
  operationsPerWorkspaceDay: 100,
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

/** A count, its window's length, and its limit. */
interface Limit {
  readonly key: string;
  readonly length: number;
  readonly limit: number;
}

const hour = Duration.toMillis(Duration.hours(1));
const day = Duration.toMillis(Duration.days(1));

// A grant renewed by a new sign-in is another listing's.
const versionOf = (grant: AdGrant) => DateTime.toEpochMillis(grant.updatedAt);

// The window's count at `at`, and when it ends; a window past its end
// starts again.
const windowOf = (
  all: ReadonlyMap<string, Window>,
  key: string,
  at: number,
  length: number
): Window => {
  const found = all.get(key);

  return found === undefined || found.endsAt <= at
    ? { count: 0, endsAt: at + length }
    : found;
};

// The windows still open at `at`: those past their end go.
const stillOpen = (all: ReadonlyMap<string, Window>, at: number) =>
  new Map([...all].filter(([, window]) => window.endsAt > at));

/**
 * ListingPace counted in this process, in fixed windows: an hour for the
 * sign-ins and the workspaces, a day for a network's operations, the
 * server's and each workspace's share of them. A check and its count are
 * one update, and every write drops the windows that ended and the
 * listings past their time. The server runs as one process; a server run
 * as several would count each.
 */
export const memoryListingPace = (options: ListingPaceOptions) =>
  Layer.effect(
    ListingPace,
    Effect.gen(function* MemoryListingPace() {
      const windows = yield* Ref.make(new Map<string, Window>());
      const kept = yield* Ref.make(new Map<string, Kept>());
      const now = DateTime.now.pipe(Effect.map(DateTime.toEpochMillis));
      const keptMillis = Duration.toMillis(options.keptFor);

      // The day's operations of the network: the server's, then the
      // workspace's share.
      const operationsOf = (grant: AdGrant): readonly Limit[] =>
        traitsOf(grant.network).dailyOperations
          ? [
              {
                key: `operations:${grant.network}`,
                length: day,
                limit: options.operationsPerDay,
              },
              {
                key: `operations:${grant.network}:${grant.workspaceId}`,
                length: day,
                limit: options.operationsPerWorkspaceDay,
              },
            ]
          : [];

      return ListingPace.of({
        recent: (grant) =>
          Effect.gen(function* recent() {
            const at = yield* now;
            const found = (yield* Ref.get(kept)).get(grant.id);

            return Option.fromUndefinedOr(found).pipe(
              Option.filter(
                (entry) =>
                  entry.version === versionOf(grant) &&
                  at - entry.at < keptMillis
              ),
              Option.map((entry) => entry.accounts)
            );
          }),
        remember: (grant, accounts) =>
          keptMillis <= 0
            ? Effect.void
            : now.pipe(
                Effect.flatMap((at) =>
                  Ref.update(kept, (all) => {
                    // Those past their time go, then the oldest past the
                    // bound: a map keeps the order it was written in.
                    const fresh = [...all].filter(
                      ([id, entry]) =>
                        id !== grant.id && at - entry.at < keptMillis
                    );

                    return new Map([
                      ...fresh.slice(
                        Math.max(0, fresh.length - options.keptListings + 1)
                      ),
                      [
                        grant.id,
                        { accounts, at, version: versionOf(grant) },
                      ] as const,
                    ]);
                  })
                )
              ),
        spent: (grant, operations) =>
          now.pipe(
            Effect.flatMap((at) =>
              Ref.update(windows, (all) => {
                const next = stillOpen(all, at);

                for (const { key, length } of operationsOf(grant)) {
                  const current = windowOf(next, key, at, length);

                  next.set(key, {
                    count: current.count + operations,
                    endsAt: current.endsAt,
                  });
                }

                return next;
              })
            )
          ),
        take: (grant) =>
          Effect.gen(function* take() {
            const at = yield* now;

            const counted: readonly Limit[] = [
              {
                key: `grant:${grant.id}`,
                length: hour,
                limit: options.perGrantHour,
              },
              {
                key: `workspace:${grant.workspaceId}`,
                length: hour,
                limit: options.perWorkspaceHour,
              },
            ];

            const limits = [...counted, ...operationsOf(grant)];

            // Checked and counted in one update: two listings at once
            // never both take the last place.
            const refusedFor = yield* Ref.modify(windows, (all) => {
              const next = stillOpen(all, at);

              const reached = limits.find(
                ({ key, length, limit }) =>
                  windowOf(next, key, at, length).count >= limit
              );

              if (reached !== undefined) {
                return [
                  Option.some(
                    windowOf(next, reached.key, at, reached.length).endsAt - at
                  ),
                  next,
                ] as const;
              }

              for (const { key, length } of counted) {
                const current = windowOf(next, key, at, length);

                next.set(key, {
                  count: current.count + 1,
                  endsAt: current.endsAt,
                });
              }

              return [Option.none<number>(), next] as const;
            });

            yield* Option.match(refusedFor, {
              onNone: () => Effect.void,
              onSome: (wait) =>
                Effect.fail(
                  new ListingLimited({ retryAfter: Duration.millis(wait) })
                ),
            });
          }),
      });
    })
  );

/** ListingPace with Peal's defaults. */
export const MemoryListingPace = memoryListingPace(listingPaceDefaults);
