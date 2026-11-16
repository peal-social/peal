import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Option } from "effect";

import { ListingPace } from "#ads/application/ports/listing-pace.ts";
import { AdGrant } from "#ads/domain/ad-grant.ts";
import { AdGrantIdSchema } from "#ads/domain/ids.ts";
import {
  listingPaceDefaults,
  memoryListingPace,
} from "#ads/infrastructure/memory-listing-pace.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";

const grantOf = (index: number) =>
  new AdGrant({
    access: "working",
    createdAt: DateTime.makeUnsafe("2026-11-16T08:00:00Z"),
    expiresAt: Option.none(),
    grantedBy: Option.none(),
    id: AdGrantIdSchema.make(`019a6b2c-0000-7000-8000-00000000000${index}`),
    network: "google",
    platformUserId: `synthetic-user-${index}`,
    scopes: ["openid"],
    updatedAt: DateTime.makeUnsafe("2026-11-16T08:00:00Z"),
    workspaceId: WorkspaceIdSchema.make("0f5b8c1e-2a3d-4e6f-8a9b-1c2d3e4f5a6b"),
  });

describe("the listings kept in process", () => {
  it.live("keeps as many sign-ins' listings as its bound, the latest", () =>
    Effect.gen(function* bounded() {
      const pace = yield* ListingPace;

      yield* pace.remember(grantOf(1), []);
      yield* pace.remember(grantOf(2), []);
      yield* pace.remember(grantOf(3), []);

      assert.deepStrictEqual(
        [
          Option.isSome(yield* pace.recent(grantOf(1))),
          Option.isSome(yield* pace.recent(grantOf(2))),
          Option.isSome(yield* pace.recent(grantOf(3))),
        ],
        [false, true, true]
      );
    }).pipe(
      Effect.provide(
        memoryListingPace({ ...listingPaceDefaults, keptListings: 2 })
      )
    )
  );
});
