import { assert, describe, it } from "@effect/vitest";
import { DateTime, Effect, Layer, Option, Schema, Stream } from "effect";
import { CurrentMember } from "peal-contract";
import type { Member } from "peal-contract";

import { AdConnections } from "#ads/application/ad-connections.ts";
import { AdReports } from "#ads/application/ad-reports.ts";
import { Boosts } from "#ads/application/boosts.ts";
import type { AuthorizedAccount } from "#ads/application/ports/account-store.ts";
import { SpendAuthorizations } from "#ads/application/spend-authorizations.ts";
import { AdAccount } from "#ads/domain/ad-account.ts";
import type { AdNetwork } from "#ads/domain/ad-network.ts";
import {
  AdAccountIdSchema,
  AdGrantIdSchema,
  NetworkObjectIdSchema,
} from "#ads/domain/ids.ts";
import { CurrencySchema } from "#ads/domain/money.ts";
import { AdsToolsLive } from "#app/mcp/ads-handlers.ts";
import { AdsTools } from "#app/mcp/ads-tools.ts";
import { UpgradePaths } from "#shared/application/upgrade-paths.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { TimeZoneIdSchema } from "#shared/domain/time-zone.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// Google Ads accounts are read in the web app, the API and the command
// line, and not offered through MCP, as Google's policy for tools names MCP
// servers that pass its API on: the ads tools list Meta's accounts alone,
// and refuse a Google Ads account in words. The use cases are stand-ins.

const workspaceId = WorkspaceIdSchema.make(
  "0f5b8c1e-2a3d-4e6f-8a9b-1c2d3e4f5a6b"
);

const member: Member = {
  permissions: permissionsFor("owner"),
  principal: {
    _tag: "user",
    impersonatedBy: null,
    userId: "5b1c2d3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e",
  },
  workspaceId,
};

const accountOn = (network: AdNetwork, id: string): AuthorizedAccount => ({
  account: new AdAccount({
    access: "working",
    amountSpent: Option.none(),
    connectedAt: DateTime.makeUnsafe("2026-11-01T00:00:00Z"),
    connectedBy: Option.none(),
    currency: CurrencySchema.make("EUR"),
    externalId: NetworkObjectIdSchema.make(
      network === "meta" ? "1001" : "1111111111"
    ),
    grantId: AdGrantIdSchema.make("019a6b2c-0000-7000-8000-000000000001"),
    id: AdAccountIdSchema.make(id),
    name: `Example on ${network}`,
    network,
    reachedThrough: Option.none(),
    spendCap: Option.none(),
    status: "active",
    syncedAt: Option.none(),
    timeZone: TimeZoneIdSchema.make("Europe/Paris"),
    unreachableSince: Option.none(),
    workspaceId,
  }),
  authorization: { _tag: "off" },
});

const meta = accountOn("meta", "019a6b2c-0000-7000-8000-00000000000a");
const google = accountOn("google", "019a6b2c-0000-7000-8000-00000000000b");

const byId = (accountId: string) =>
  accountId === google.account.id ? google : meta;

const report = (accountId: string) =>
  Effect.succeed({
    account: byId(accountId),
    range: {
      from: { day: 1, month: 11, year: 2026 },
      to: { day: 10, month: 11, year: 2026 },
    },
    rows: [],
  });

const Tools = AdsToolsLive.pipe(
  Layer.provide(
    Layer.mergeAll(
      Layer.mock(AdConnections, {
        account: (_actor, accountId) => Effect.succeed(byId(accountId)),
        accounts: () => Effect.succeed([meta, google]),
        status: () =>
          Effect.succeed({ mode: "read", networks: ["meta", "google"] }),
        untrackedUntil: () => Effect.succeed(Option.none()),
      }),
      Layer.mock(SpendAuthorizations, {
        standing: (_actor, accountId) =>
          Effect.succeed({ account: byId(accountId), committedThisMonth: 0 }),
      }),
      Layer.mock(AdReports, {
        campaigns: (_actor, accountId) => report(accountId),
        days: (_actor, accountId) => report(accountId),
      }),
      // Never reached for a Google Ads account.
      Layer.mock(Boosts, {
        quote: () => Effect.die("a quote was asked"),
        request: () => Effect.die("a boost was asked"),
      }),
      UpgradePaths.layerTest
    )
  )
);

const called = <A, E, R>(
  handled: Effect.Effect<Stream.Stream<A, E, R>, E, R>
) =>
  handled.pipe(
    Effect.flatMap((stream) => Stream.runCollect(stream)),
    Effect.provideService(CurrentMember, member)
  );

const refusalOf = <A, E extends { readonly message: string }, R>(
  handled: Effect.Effect<Stream.Stream<A, E, R>, E, R>
) =>
  called(handled).pipe(
    Effect.flip,
    Effect.map(({ message }) => message)
  );

// What a client reads of an answer.
const decodeStatus = Schema.decodeUnknownSync(
  Schema.Struct({
    accounts: Schema.Array(Schema.Struct({ network: Schema.String })),
    networks: Schema.Array(Schema.String),
  })
);

const decodeAccount = Schema.decodeUnknownSync(
  Schema.Struct({ account: Schema.Struct({ network: Schema.String }) })
);

const noBoostOnGoogle =
  "Google Ads accounts are read only in Peal: nothing is boosted on Google Ads, and nothing was reserved or sent. Tell the user so; a post can be boosted on a Meta ad account.";

const notOffered =
  "Google Ads accounts are read in the web app, the API and the command line; they are not offered through MCP. Nothing was read. Tell the user so, and that they can see the account's campaigns and numbers there.";

describe("the ads tools and Google Ads", () => {
  it.effect("list the networks, and Meta's accounts alone", () =>
    Effect.gen(function* listing() {
      const tools = yield* AdsTools;
      const [answer] = yield* called(tools.handle("get_ads_status", {}));
      const status = decodeStatus(answer?.encodedResult);

      assert.deepStrictEqual(status.networks, ["meta", "google"]);
      assert.deepStrictEqual(
        status.accounts.map(({ network }) => network),
        ["meta"]
      );
    }).pipe(Effect.provide(Tools))
  );

  it.effect("read a Meta account", () =>
    Effect.gen(function* reading() {
      const tools = yield* AdsTools;

      const [answer] = yield* called(
        tools.handle("get_ad_account", { accountId: meta.account.id })
      );

      assert.strictEqual(
        decodeAccount(answer?.encodedResult).account.network,
        "meta"
      );
    }).pipe(Effect.provide(Tools))
  );

  it.effect("refuse a Google Ads account's spending, in words", () =>
    Effect.gen(function* refusing() {
      const tools = yield* AdsTools;

      assert.strictEqual(
        yield* refusalOf(
          tools.handle("get_ad_account", { accountId: google.account.id })
        ),
        notOffered
      );
    }).pipe(Effect.provide(Tools))
  );

  it.effect("refuse a Google Ads account's campaigns, in words", () =>
    Effect.gen(function* refusing() {
      const tools = yield* AdsTools;

      assert.strictEqual(
        yield* refusalOf(
          tools.handle("list_ad_campaigns", { accountId: google.account.id })
        ),
        notOffered
      );
    }).pipe(Effect.provide(Tools))
  );

  it.effect("refuse a Google Ads account's days, in words", () =>
    Effect.gen(function* refusing() {
      const tools = yield* AdsTools;

      assert.strictEqual(
        yield* refusalOf(
          tools.handle("get_ad_insights", { accountId: google.account.id })
        ),
        notOffered
      );
    }).pipe(Effect.provide(Tools))
  );

  const asked = {
    accountId: String(google.account.id),
    audience: { ageMax: 65, ageMin: 18, countries: ["US"] },
    budget: { amount: 5000, kind: "total" as const },
    channelId: "019a6b2c-0000-7000-8000-0000000000c1",
    currency: "EUR",
    endsAt: "2026-12-01T00:00:00Z",
    postId: "019a6b2c-0000-7000-8000-0000000000d1",
    specialAdCategory: "none" as const,
  };

  it.effect(
    "refuse a boost or a quote on a Google Ads account, as read only",
    () =>
      Effect.gen(function* boosting() {
        const tools = yield* AdsTools;

        for (const refused of [
          yield* refusalOf(
            tools.handle("boost_post", {
              ...asked,
              idempotencyKey: "synthetic-key-1",
            })
          ),
          yield* refusalOf(tools.handle("quote_boost", asked)),
        ]) {
          assert.strictEqual(refused, noBoostOnGoogle);
        }
      }).pipe(Effect.provide(Tools))
  );
});
