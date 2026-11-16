import { createHmac } from "node:crypto";

import { assert, describe, expect, it } from "@effect/vitest";
import {
  ConfigProvider,
  DateTime,
  Effect,
  Layer,
  Option,
  Redacted,
} from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";

import {
  activationRefusal,
  makeTrial,
  masked,
  maskText,
  printing,
  trialSettings,
} from "#ads/infrastructure/meta/trial.ts";
import type { Exchange } from "#ads/infrastructure/meta/trial.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import {
  adsApp,
  fakeMarketingApi,
} from "#test/ads/fakes/fake-marketing-api.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import { dropped, json } from "#test/publishing/fakes/platform-server.ts";

const trialToken = "EAA-synthetic-trial-token-for-the-loopback-fake-only";
const secret = Redacted.value(adsApp.appSecret);

const proof = createHmac("sha256", secret).update(trialToken).digest("hex");

const secrets = [trialToken, secret, proof];

const HttpTest = Layer.mergeAll(FetchHttpClient.layer, OpenOutboundGuard);

const MacTest = Mac.layerWebCrypto.pipe(
  Layer.provide(SecureRandom.layerWebCrypto)
);

// The trial against the fake on loopback, with what it printed.
const trialAgainstFake = Effect.fn("test.trialAgainstFake")(
  function* trialAgainstFake() {
    const api = yield* fakeMarketingApi({
      pages: [{ id: "700", instagram: "17840000000000001" }],
    });

    api.expectToken(trialToken);

    const printed: Exchange[] = [];

    const http = printing(
      yield* publicHttpClient.pipe(Effect.provide(HttpTest)),
      {
        secrets,
        seen: (exchange) =>
          Effect.sync(() => {
            printed.push(exchange);
          }),
      }
    );

    const trial = yield* makeTrial({
      app: adsApp,
      hosts: api.hosts,
      http,
      token: Redacted.make(trialToken),
    }).pipe(Effect.provide(MacTest));

    return { api, printed, trial };
  }
);

const today = () =>
  DateTime.now.pipe(Effect.map((now) => DateTime.formatIsoDateUtc(now)));

describe("the trial's printer", () => {
  it("masks the token, the proof and the app secret in an address", () => {
    const text = maskText(
      `https://graph.facebook.com/v27.0/me/adaccounts?fields=id&access_token=${trialToken}&appsecret_proof=${proof}&client_secret=${encodeURIComponent(secret)}&fb_exchange_token=synthetic-short-lived`,
      secrets
    );

    for (const value of secrets) {
      expect(text).not.toContain(value);
      expect(text).not.toContain(encodeURIComponent(value));
    }

    expect(text).toBe(
      `https://graph.facebook.com/v27.0/me/adaccounts?fields=id&access_token=${masked}&appsecret_proof=${masked}&client_secret=${masked}&fb_exchange_token=${masked}`
    );
  });

  it("masks them in a form body and in an answer, wherever they appear", () => {
    const form = maskText(
      `name=peal-trial&status=PAUSED&access_token=${trialToken}&appsecret_proof=${proof}`,
      secrets
    );

    const answer = maskText(
      `{"access_token":"${trialToken}","note":"echoed ${secret} and ${proof}"}`,
      secrets
    );

    for (const value of secrets) {
      expect(form).not.toContain(value);
      expect(answer).not.toContain(value);
    }

    expect(form).toBe(
      `name=peal-trial&status=PAUSED&access_token=${masked}&appsecret_proof=${masked}`
    );
    expect(answer).toBe(
      `{"access_token":"${masked}","note":"echoed ${masked} and ${masked}"}`
    );
  });

  it.live(
    "prints each request and Meta's whole answer, and no credential",
    () =>
      Effect.gen(function* printingRequests() {
        const { printed, trial } = yield* trialAgainstFake();

        yield* trial.accounts();
        yield* trial.campaign("act_1001");

        const [listing, creation] = printed;
        const all = JSON.stringify(printed);

        for (const value of secrets) {
          assert.notInclude(all, value);
        }

        assert.strictEqual(listing?.method, "GET");
        assert.strictEqual(listing?.path, "/v27.0/me/adaccounts");
        assert.deepInclude(listing?.params ?? [], ["access_token", masked]);
        assert.deepInclude(listing?.params ?? [], ["appsecret_proof", masked]);
        assert.include(
          listing?.answer._tag === "answer" ? listing.answer.body : "",
          "act_1001"
        );

        // A form body's parameters, as sent.
        assert.strictEqual(creation?.method, "POST");
        assert.strictEqual(creation?.path, "/v27.0/act_1001/campaigns");
        assert.deepInclude(creation?.params ?? [], ["status", "PAUSED"]);
        assert.deepInclude(creation?.params ?? [], ["access_token", masked]);
      }).pipe(Effect.scoped)
  );

  it.live(
    "masks a credential in an answer's headers and in a paging address",
    () =>
      Effect.gen(function* inAnswers() {
        const { api, printed, trial } = yield* trialAgainstFake();

        api.script({
          answer: json(
            {
              data: [],
              paging: {
                next: `https://graph.facebook.com/v27.0/me/adaccounts?access_token=${trialToken}&after=x`,
              },
            },
            200,
            {
              location: `https://graph.facebook.com/v27.0/me?access_token=${encodeURIComponent(trialToken)}`,
            }
          ),
          when: ({ path }) => path === "/v27.0/me/adaccounts",
        });

        yield* trial.accounts();

        const all = JSON.stringify(printed);

        for (const value of secrets) {
          assert.notInclude(all, value);
          assert.notInclude(all, encodeURIComponent(value));
        }

        const [answer] = printed;

        assert.include(
          answer?.answer._tag === "answer"
            ? (answer.answer.headers["location"] ?? "")
            : "",
          masked
        );
      }).pipe(Effect.scoped)
  );

  it.live("prints a request that got no answer, masked", () =>
    Effect.gen(function* noAnswer() {
      const { api, printed, trial } = yield* trialAgainstFake();

      api.script({ answer: dropped, when: () => true });

      yield* Effect.flip(trial.accounts());

      const [exchange] = printed;

      assert.strictEqual(exchange?.answer._tag, "noAnswer");
      assert.deepInclude(exchange?.params ?? [], ["access_token", masked]);
      assert.notInclude(JSON.stringify(printed), trialToken);
    }).pipe(Effect.scoped)
  );
});

const settingsFrom = (env: Readonly<Record<string, string>>) =>
  trialSettings.pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env)))
  );

describe("the trial's settings", () => {
  it.effect("trims the token, and masks it as given and as trimmed", () =>
    Effect.gen(function* trimmed() {
      const settings = yield* settingsFrom({
        PEAL_ADS_TRIAL_TOKEN: ` ${trialToken}\n`,
      });

      assert.strictEqual(Redacted.value(settings.token), trialToken);
      assert.include(settings.tokenForms, trialToken);
      assert.include(settings.tokenForms, ` ${trialToken}\n`);
      assert.isTrue(Option.isNone(settings.activateOn));
      assert.notInclude(
        maskText(`Malformed access token ${trialToken}`, settings.tokenForms),
        trialToken
      );
    })
  );

  it.effect("refuses a blank or missing token", () =>
    Effect.gen(function* blank() {
      for (const env of [{ PEAL_ADS_TRIAL_TOKEN: "  \n" }, {}]) {
        const refused = yield* Effect.flip(settingsFrom(env));

        assert.strictEqual(refused._tag, "TrialRefused");
      }
    })
  );

  it.effect("reads the activation day from the environment", () =>
    Effect.gen(function* day() {
      const settings = yield* settingsFrom({
        PEAL_ADS_TRIAL_ACTIVATE: "2026-11-16",
        PEAL_ADS_TRIAL_TOKEN: trialToken,
      });

      assert.deepStrictEqual(settings.activateOn, Option.some("2026-11-16"));
    })
  );
});

describe("what the trial makes", () => {
  it.live("makes everything paused, under a name of the trial's", () =>
    Effect.gen(function* making() {
      const { api, trial } = yield* trialAgainstFake();

      const campaign = yield* trial.campaign("1001");

      const adSet = yield* trial.adSet("1001", {
        ageMax: 65,
        ageMin: 18,
        beneficiary: "Peal",
        budget: 200,
        campaign: campaign.id,
        countries: ["FR"],
        days: 2,
        payer: "Peal",
      });

      yield* trial.ad("1001", adSet.id, {
        accountId: "700",
        platform: "facebook",
        platformPostId: "700_900",
      });

      assert.lengthOf(api.objects(), 3);
      assert.isTrue(api.objects().every(({ status }) => status === "PAUSED"));
      assert.match(campaign.name, /^peal-trial-\d{8}T\d{6}Z$/u);

      // Found again by its name, as after a lost answer.
      assert.deepStrictEqual(
        yield* trial.lookUp("1001", {
          adSet: Option.none(),
          campaign: Option.some(campaign.id),
          name: adSet.name,
        }),
        { _tag: "found", value: adSet.id }
      );

      // The trial's cleaning, innermost first.
      for (const object of api.objects().toReversed()) {
        yield* trial.delete(object.id);
      }

      assert.isTrue(api.objects().every(({ status }) => status === "DELETED"));
    }).pipe(Effect.scoped)
  );

  it.live("deletes and pauses only what the trial made", () =>
    Effect.gen(function* notTrials() {
      const { api, trial } = yield* trialAgainstFake();

      const own = api.hold(
        "campaign",
        "1001",
        { name: "Spring sale" },
        "PAUSED"
      );

      for (const step of [trial.delete(own.id), trial.pause(own.id)]) {
        const refused = yield* Effect.flip(step);

        assert.strictEqual(refused._tag, "TrialRefused");
      }

      assert.lengthOf(api.writes(), 0);
      assert.strictEqual(own.status, "PAUSED");
    }).pipe(Effect.scoped)
  );

  it.live("refuses a budget or a run out of bounds, before any request", () =>
    Effect.gen(function* bounds() {
      const { api, trial } = yield* trialAgainstFake();

      const set = {
        ageMax: 65,
        ageMin: 18,
        beneficiary: "Peal",
        budget: 200,
        campaign: "5001",
        countries: ["FR"],
        days: 2,
        payer: "Peal",
      };

      for (const wrong of [
        { budget: 0 },
        { budget: 10_001 },
        { days: 0 },
        { days: 8 },
      ]) {
        const refused = yield* Effect.flip(
          trial.adSet("1001", { ...set, ...wrong })
        );

        assert.strictEqual(refused._tag, "TrialRefused");
      }

      for (const days of [0, 91]) {
        const refused = yield* Effect.flip(trial.snapshot("1001", days));

        assert.strictEqual(refused._tag, "TrialRefused");
      }

      assert.lengthOf(api.requests(), 0);
    }).pipe(Effect.scoped)
  );
});

describe("activating during the trial", () => {
  const sandbox = {
    objectAccount: "1001",
    objectName: "peal-trial-20261116T143000Z",
    sandboxAccount: "act_1001",
    today: "2026-11-16",
  };

  it("refuses without the day's value", () => {
    expect(
      Option.isSome(
        activationRefusal({ ...sandbox, activateOn: Option.none() })
      )
    ).toBeTruthy();
  });

  it("refuses with yesterday's value", () => {
    expect(
      Option.isSome(
        activationRefusal({ ...sandbox, activateOn: Option.some("2026-11-15") })
      )
    ).toBeTruthy();
  });

  it("refuses on an account that is not the sandbox one", () => {
    expect(
      Option.isSome(
        activationRefusal({
          ...sandbox,
          activateOn: Option.some("2026-11-16"),
          objectAccount: "1002",
        })
      )
    ).toBeTruthy();
  });

  it("refuses an object the trial did not make", () => {
    expect(
      Option.isSome(
        activationRefusal({
          ...sandbox,
          activateOn: Option.some("2026-11-16"),
          objectName: "Spring sale",
        })
      )
    ).toBeTruthy();
  });

  it("refuses blank accounts, which would compare equal", () => {
    expect(
      Option.isSome(
        activationRefusal({
          ...sandbox,
          activateOn: Option.some("2026-11-16"),
          objectAccount: "",
          sandboxAccount: "act_",
        })
      )
    ).toBeTruthy();
  });

  it.live("asks Meta nothing when the day is not today's", () =>
    Effect.gen(function* noRequest() {
      const { api, trial } = yield* trialAgainstFake();

      const own = api.hold(
        "campaign",
        "1001",
        { name: "peal-trial-x" },
        "PAUSED"
      );

      const refused = yield* Effect.flip(
        trial.activate(own.id, "1001", Option.none())
      );

      assert.strictEqual(refused._tag, "TrialRefused");
      assert.lengthOf(api.requests(), 0);
    }).pipe(Effect.scoped)
  );

  it.live(
    "runs nothing in the sandbox account that the trial did not make",
    () =>
      Effect.gen(function* notOurs() {
        const { api, trial } = yield* trialAgainstFake();

        const own = api.hold(
          "campaign",
          "1001",
          { name: "Spring sale" },
          "PAUSED"
        );

        const refused = yield* Effect.flip(
          trial.activate(own.id, "1001", Option.some(yield* today()))
        );

        assert.strictEqual(refused._tag, "TrialRefused");
        assert.lengthOf(api.writes(), 0);
        assert.strictEqual(own.status, "PAUSED");
      }).pipe(Effect.scoped)
  );

  it("allows the sandbox account on the day named", () => {
    expect(
      activationRefusal({ ...sandbox, activateOn: Option.some("2026-11-16") })
    ).toStrictEqual(Option.none());
  });

  it.live("sends nothing that runs an object outside the sandbox account", () =>
    Effect.gen(function* elsewhere() {
      const { api, trial } = yield* trialAgainstFake();
      const campaign = yield* trial.campaign("1001");

      const refused = yield* Effect.flip(
        trial.activate(campaign.id, "1002", Option.some(yield* today()))
      );

      assert.strictEqual(refused._tag, "TrialRefused");
      assert.lengthOf(api.writes(), 1);
      assert.strictEqual(api.objects()[0]?.status, "PAUSED");
    }).pipe(Effect.scoped)
  );

  it.live("sends nothing without the day's value, nor with yesterday's", () =>
    Effect.gen(function* notToday() {
      const { api, trial } = yield* trialAgainstFake();
      const campaign = yield* trial.campaign("1001");

      const yesterday = DateTime.formatIsoDateUtc(
        DateTime.subtract(yield* DateTime.now, { days: 1 })
      );

      for (const activateOn of [Option.none(), Option.some(yesterday)]) {
        const refused = yield* Effect.flip(
          trial.activate(campaign.id, "1001", activateOn)
        );

        assert.strictEqual(refused._tag, "TrialRefused");
      }

      assert.lengthOf(api.writes(), 1);
    }).pipe(Effect.scoped)
  );

  it.live("runs an object of the sandbox account on the day named", () =>
    Effect.gen(function* activating() {
      const { api, trial } = yield* trialAgainstFake();
      const campaign = yield* trial.campaign("1001");

      yield* trial.activate(
        campaign.id,
        "act_1001",
        Option.some(yield* today())
      );

      assert.strictEqual(api.objects()[0]?.status, "ACTIVE");

      yield* trial.pause(campaign.id);

      assert.strictEqual(api.objects()[0]?.status, "PAUSED");
    }).pipe(Effect.scoped)
  );
});
