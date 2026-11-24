import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import {
  AdNetworkSchema as ContractNetworkSchema,
  Api,
  forWorkspace,
} from "peal-contract";
import type { Member, NewBoost, Permission } from "peal-contract";

import { AdsHandlers } from "#ads/api/ads.ts";
import { BoostOperations } from "#ads/application/boost-operations.ts";
import { SyncAccount } from "#ads/application/sync-account.ts";
import { AdNetworkSchema } from "#ads/domain/ad-network.ts";
import { AdAccountIdSchema, BoostIdSchema } from "#ads/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { yenAccount, euroAccount } from "#test/ads/fakes/fake-marketing-api.ts";
import { TestPosts } from "#test/ads/fakes/test-posts.ts";
import { AdsTest, onGoogle, onMeta } from "#test/ads/support.ts";
import { freshWorkspace } from "#test/channels/support.ts";
import { securityTest } from "#workspace/api/security.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

const userId = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

// A client of the ads endpoints whose every request acts as the member,
// as the WorkspaceAccess middleware would hand them to the handlers.
const clientAs = (member: Member) =>
  HttpApiTest.groups(Api, ["ads"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        AdsHandlers.pipe(Layer.provideMerge(securityTest(member))),
        HttpServer.layerServices
      )
    )
  );

// A person in their own session, with a role.
const person = (
  workspaceId: WorkspaceId,
  role: "admin" | "editor" | "owner" | "viewer"
): Member => ({
  permissions: permissionsFor(role),
  principal: { _tag: "user", impersonatedBy: null, userId },
  workspaceId,
});

// An API key of the workspace, with some permissions.
const key = (
  workspaceId: WorkspaceId,
  permissions: readonly Permission[]
): Member => ({
  permissions,
  principal: {
    _tag: "apiKey",
    apiKeyId: "synthetic-key",
    permissions,
    workspaceId,
  },
  workspaceId,
});

const failureOf = <E, R>(effect: Effect.Effect<unknown, E, R>) =>
  effect.pipe(Effect.flip);

const stateOf = (url: string) => new URL(url).searchParams.get("state") ?? "";

// The owner signs in, connects the euro account and allows it to spend.
const ready = (workspaceId: WorkspaceId, ceiling = 20_000) =>
  Effect.gen(function* signingIn() {
    const owner = yield* clientAs(person(workspaceId, "owner"));
    const headers = forWorkspace(workspaceId);

    const { authorizationUrl } = yield* owner.ads.connect({
      headers,
      params: { network: "meta" },
    });

    const signedIn = yield* owner.ads.completeConnect({
      headers,
      params: { network: "meta" },
      payload: { code: "good-code", state: stateOf(authorizationUrl) },
    });

    const [account] = yield* owner.ads.connectAccounts({
      headers,
      params: { connectionId: signedIn.connection.id },
      payload: { externalIds: ["1001"] },
    });

    const accountId = account?.id ?? "";

    yield* owner.ads.setSpending({
      headers,
      params: { accountId },
      payload: {
        enabled: true,
        monthlyCeiling: { amount: ceiling, currency: "EUR" },
      },
    });

    return { accountId, owner, signedIn };
  });

const boostOf = (
  accountId: string,
  post: { channelId: string; postId: string }
) =>
  DateTime.now.pipe(
    Effect.map((now): NewBoost => ({
      accountId,
      audience: { ageMax: 65, ageMin: 18, countries: ["US"] },
      budget: { amount: 5000, kind: "total" },
      channelId: post.channelId,
      currency: "EUR",
      endsAt: DateTime.add(now, { days: 7 }),
      postId: post.postId,
      specialAdCategory: "none",
    }))
  );

layer(AdsTest, { excludeTestServices: true })("the ads endpoints", (it) => {
  it.effect("name the networks the domain knows", () =>
    Effect.sync(() => {
      assert.deepStrictEqual(
        [...ContractNetworkSchema.literals],
        [...AdNetworkSchema.literals]
      );
    })
  );

  it.effect(
    "show a Google Ads account with what it allows, its manager, and its campaigns' kind",
    () =>
      Effect.gen(function* google() {
        const workspaceId = yield* freshWorkspace;
        const owner = yield* clientAs(person(workspaceId, "owner"));
        const headers = forWorkspace(workspaceId);

        yield* onGoogle(
          {
            accessible: ["2222222222"],
            campaigns: [
              {
                advertisingChannelType: "SEARCH",
                customerId: "3333333333",
                id: "931",
                name: "Client campaign",
                status: "ENABLED",
              },
            ],
            customers: [
              {
                clients: ["3333333333"],
                currencyCode: "EUR",
                descriptiveName: "Example Agency",
                id: "2222222222",
                manager: true,
                timeZone: "Europe/Paris",
              },
              {
                currencyCode: "EUR",
                descriptiveName: "Example Client",
                id: "3333333333",
                timeZone: "Europe/Paris",
              },
            ],
          },
          "spend",
          true
        );

        const { authorizationUrl } = yield* owner.ads.connect({
          headers,
          params: { network: "google" },
        });

        const signedIn = yield* owner.ads.completeConnect({
          headers,
          params: { network: "google" },
          payload: { code: "good-code", state: stateOf(authorizationUrl) },
        });

        assert.strictEqual(signedIn.connection.network, "google");
        assert.isFalse(signedIn.connection.maySpend);

        const [account] = yield* owner.ads.connectAccounts({
          headers,
          params: { connectionId: signedIn.connection.id },
          payload: { externalIds: ["3333333333"] },
        });

        assert.deepStrictEqual(
          [account?.network, account?.reachedThrough, account?.capabilities],
          [
            "google",
            "2222222222",
            { ads: false, boosts: false, reach: false, results: false },
          ]
        );

        const accountId = account?.id ?? "";

        yield* SyncAccount.use((sync) =>
          sync.run(AdAccountIdSchema.make(accountId))
        );

        const campaigns = yield* owner.ads.listCampaigns({
          headers,
          params: { accountId },
          query: {},
        });

        assert.deepStrictEqual(
          campaigns.rows.map(({ kind, name }) => [name, kind]),
          [["Client campaign", "SEARCH"]]
        );

        const ads = yield* owner.ads.listAds({
          headers,
          params: { accountId },
          query: {},
        });

        assert.lengthOf(ads.rows, 0);
        assert.strictEqual(
          (yield* failureOf(
            owner.ads.setSpending({
              headers,
              params: { accountId },
              payload: {
                enabled: true,
                monthlyCeiling: { amount: 1000, currency: "EUR" },
              },
            })
          ))._tag,
          "AdSpendingUnavailable"
        );
      }).pipe(Effect.scoped)
  );

  it.effect(
    "say what the server offers, and nothing more when ads are off",
    () =>
      Effect.gen(function* status() {
        const workspaceId = yield* freshWorkspace;
        const owner = yield* clientAs(person(workspaceId, "owner"));
        const headers = forWorkspace(workspaceId);

        yield* onMeta({}, "off");

        assert.deepStrictEqual(yield* owner.ads.status({ headers }), {
          mode: "off",
          networks: [],
        });
        assert.strictEqual(
          (yield* failureOf(
            owner.ads.connect({ headers, params: { network: "meta" } })
          ))._tag,
          "AdsUnavailable"
        );

        yield* onMeta({}, "read");

        assert.deepStrictEqual(yield* owner.ads.status({ headers }), {
          mode: "read",
          networks: ["meta"],
        });
      }).pipe(Effect.scoped)
  );

  it.effect(
    "sign in, list what the sign-in reaches, connect and allow an account to spend",
    () =>
      Effect.gen(function* connecting() {
        const workspaceId = yield* freshWorkspace;
        const headers = forWorkspace(workspaceId);

        yield* onMeta({ accounts: [euroAccount(), yenAccount()] });

        const { accountId, owner, signedIn } = yield* ready(workspaceId);

        assert.deepStrictEqual(
          signedIn.accounts.map(({ currency, externalId, spendCap }) => [
            externalId,
            currency,
            spendCap,
          ]),
          [
            ["1001", "EUR", null],
            ["1002", "JPY", 500_000],
          ]
        );
        assert.isTrue(signedIn.connection.maySpend);

        const spending = yield* owner.ads.getAccount({
          headers,
          params: { accountId },
        });

        assert.strictEqual(spending.account.monthlyCeiling, 20_000);
        assert.isTrue(spending.account.spendingEnabled);
        assert.strictEqual(spending.account.minorUnitDigits, 2);
        assert.deepStrictEqual(
          [spending.account.reachedThrough, spending.account.capabilities],
          [null, { ads: true, boosts: true, reach: true, results: true }]
        );
        assert.strictEqual(spending.committedThisMonth, 0);

        // An admin reads, and manages accounts, but does not decide what
        // they may spend; nor does a key, whatever it holds.
        const admin = yield* clientAs(person(workspaceId, "admin"));

        const robot = yield* clientAs(
          key(workspaceId, permissionsFor("owner"))
        );

        const decision = {
          headers,
          params: { accountId },
          payload: {
            enabled: true,
            monthlyCeiling: { amount: 90_000, currency: "EUR" },
          },
        };

        const byAdmin = yield* failureOf(admin.ads.setSpending(decision));
        const byKey = yield* failureOf(robot.ads.setSpending(decision));

        assert.strictEqual(byAdmin._tag, "Forbidden");
        assert.strictEqual(byKey._tag, "Forbidden");
        assert.strictEqual(
          byKey._tag === "Forbidden" ? byKey.reason : "",
          "personRequired"
        );
        assert.strictEqual(
          (yield* failureOf(
            robot.ads.connect({ headers, params: { network: "meta" } })
          ))._tag,
          "Forbidden"
        );

        // The ceiling is in the account's currency.
        assert.strictEqual(
          (yield* failureOf(
            owner.ads.setSpending({
              ...decision,
              payload: {
                enabled: true,
                monthlyCeiling: { amount: 1000, currency: "USD" },
              },
            })
          ))._tag,
          "CeilingCurrencyMismatch"
        );
      }).pipe(Effect.scoped)
  );

  it.effect(
    "quote a boost, accept it once under its key, and show it with its journal",
    () =>
      Effect.gen(function* boosting() {
        const workspaceId = yield* freshWorkspace;
        const headers = forWorkspace(workspaceId);
        const api = yield* onMeta();
        const { accountId, owner } = yield* ready(workspaceId);

        const post = yield* TestPosts.use((posts) =>
          posts.publish(workspaceId)
        );

        const payload = yield* boostOf(accountId, post);
        const quote = yield* owner.ads.quoteBoost({ headers, payload });

        assert.strictEqual(quote.commitment, 5000);
        assert.strictEqual(quote.ceiling, 20_000);
        assert.strictEqual(quote.committed, 0);
        assert.strictEqual(quote.days, 8);
        assert.isNull(quote.capRoom);

        const withKey = { ...headers, "idempotency-key": "api-key-1" };

        const boost = yield* owner.ads.createBoost({
          headers: withKey,
          payload,
        });

        const again = yield* owner.ads.createBoost({
          headers: withKey,
          payload,
        });

        assert.strictEqual(boost.state, "requested");
        assert.strictEqual(again.id, boost.id);
        assert.strictEqual(
          (yield* failureOf(
            owner.ads.createBoost({
              headers: withKey,
              payload: { ...payload, budget: { amount: 9000, kind: "total" } },
            })
          ))._tag,
          "BoostKeyReused"
        );
        // Nothing left for the network until the job runs.
        assert.lengthOf(api.writes(), 0);

        yield* BoostOperations.use((operations) =>
          operations.place(BoostIdSchema.make(boost.id))
        );

        const detail = yield* owner.ads.getBoost({
          headers,
          params: { boostId: boost.id },
        });

        assert.strictEqual(detail.boost.state, "active");
        assert.deepStrictEqual(
          detail.steps.map(({ outcome, step }) => [step, outcome]),
          [
            ["createCampaign", "done"],
            ["createAdSet", "done"],
            ["createAd", "done"],
            ["activateAd", "done"],
            ["activateAdSet", "done"],
            ["activateCampaign", "done"],
          ]
        );

        const listed = yield* owner.ads.listBoosts({
          headers,
          query: { postId: post.postId },
        });

        assert.deepStrictEqual(
          listed.boosts.map(({ id }) => id),
          [boost.id]
        );

        const performance = yield* owner.ads.postPerformance({
          headers,
          params: { postId: post.postId },
        });

        assert.lengthOf(performance.boosts, 1);

        const trail = yield* owner.ads.auditTrail({ headers, query: {} });

        assert.deepStrictEqual(
          trail.entries.map(({ action }) => action),
          ["boostStarted", "boostRequested", "spendingEnabled"]
        );
        assert.deepStrictEqual(trail.entries[1]?.by, {
          id: userId,
          kind: "user",
          viaClient: null,
        });
      }).pipe(Effect.scoped)
  );

  it.effect(
    "list the accounts with their new ads tracked, where no billing pauses them",
    () =>
      Effect.gen(function* listed() {
        yield* onMeta();

        const workspaceId = yield* freshWorkspace;
        const { owner } = yield* ready(workspaceId);

        const accounts = yield* owner.ads.listAccounts({
          headers: forWorkspace(workspaceId),
        });

        assert.isAbove(accounts.length, 0);
        assert.deepStrictEqual(
          accounts.map(({ newAdsUntrackedUntil }) => newAdsUntrackedUntil),
          accounts.map(() => null)
        );
      }).pipe(Effect.scoped)
  );

  it.effect("refuse a boost with what a client needs to explain it", () =>
    Effect.gen(function* refusing() {
      const workspaceId = yield* freshWorkspace;
      const headers = forWorkspace(workspaceId);

      yield* onMeta();

      const { accountId, owner } = yield* ready(workspaceId, 6000);
      const post = yield* TestPosts.use((posts) => posts.publish(workspaceId));
      const payload = yield* boostOf(accountId, post);

      const send = (under: string, changed: typeof payload) =>
        failureOf(
          owner.ads.createBoost({
            headers: { ...headers, "idempotency-key": under },
            payload: changed,
          })
        );

      const invalid = yield* send("invalid", {
        ...payload,
        audience: { ageMax: 20, ageMin: 30, countries: ["FR"] },
        currency: "USD",
        specialAdCategory: "housing",
      });

      assert.deepStrictEqual(
        invalid._tag === "BoostInvalid" ? invalid.violations : [],
        [
          "currencyMismatch",
          "ageRange",
          "specialCategory",
          "beneficiaryRequired",
        ]
      );

      yield* owner.ads.createBoost({
        headers: { ...headers, "idempotency-key": "first" },
        payload,
      });

      const over = yield* send("second", payload);

      assert.deepStrictEqual(
        over._tag === "SpendCeilingExceeded"
          ? [over.ceiling, over.committed, over.requested, over.currency]
          : [],
        [6000, 5000, 5000, "EUR"]
      );
      assert.strictEqual(
        (yield* send("elsewhere", { ...payload, postId: "not-a-post" }))._tag,
        "PostNotPromotable"
      );
      assert.strictEqual(
        (yield* send("nowhere", { ...payload, accountId: "not-an-account" }))
          ._tag,
        "AdAccountNotFound"
      );

      // A member who reads ads does not spend; a key needs the permission.
      const editor = yield* clientAs(person(workspaceId, "editor"));
      const reader = yield* clientAs(key(workspaceId, ["ads:read"]));

      for (const client of [editor, reader]) {
        const refused = yield* failureOf(
          client.ads.createBoost({
            headers: { ...headers, "idempotency-key": "no" },
            payload,
          })
        );

        assert.strictEqual(refused._tag, "Forbidden");
        assert.strictEqual(
          refused._tag === "Forbidden" ? refused.permission : "",
          "ads:spend"
        );
      }
    }).pipe(Effect.scoped)
  );

  it.effect("pause, resume and stop a boost, each asked twice as once", () =>
    Effect.gen(function* controlling() {
      const workspaceId = yield* freshWorkspace;
      const headers = forWorkspace(workspaceId);
      const api = yield* onMeta();
      const { accountId, owner } = yield* ready(workspaceId);
      const post = yield* TestPosts.use((posts) => posts.publish(workspaceId));

      const boost = yield* owner.ads.createBoost({
        headers: { ...headers, "idempotency-key": "control" },
        payload: yield* boostOf(accountId, post),
      });

      yield* BoostOperations.use((operations) =>
        operations.place(BoostIdSchema.make(boost.id))
      );

      const on = { headers, params: { boostId: boost.id } };
      const writes = api.writes().length;

      assert.strictEqual((yield* owner.ads.pauseBoost(on)).state, "paused");
      assert.strictEqual((yield* owner.ads.pauseBoost(on)).state, "paused");
      assert.lengthOf(api.writes(), writes + 1);
      assert.strictEqual((yield* owner.ads.resumeBoost(on)).state, "active");
      assert.strictEqual((yield* owner.ads.stopBoost(on)).state, "stopped");
      assert.strictEqual((yield* owner.ads.stopBoost(on)).state, "stopped");

      const conflict = yield* failureOf(owner.ads.resumeBoost(on));

      assert.strictEqual(conflict._tag, "BoostStateConflict");
      assert.strictEqual(
        (yield* failureOf(
          owner.ads.pauseBoost({ headers, params: { boostId: "nope" } })
        ))._tag,
        "BoostNotFound"
      );
      // The account can go once nothing of it may spend.
      yield* owner.ads.removeAccount({ headers, params: { accountId } });
      assert.lengthOf(yield* owner.ads.listAccounts({ headers }), 0);
    }).pipe(Effect.scoped)
  );
});
