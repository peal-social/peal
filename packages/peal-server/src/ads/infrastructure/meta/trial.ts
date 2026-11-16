import {
  Config,
  DateTime,
  Duration,
  Effect,
  Option,
  Redacted,
  Schema,
} from "effect";
import { Mac } from "effect/crypto";
import { HttpClient } from "effect/http";
import type { HttpClientRequest, HttpClientResponse } from "effect/http";

import type {
  NewObject,
  PromotedPost,
} from "#ads/application/ports/ad-network.ts";
import { Audience } from "#ads/domain/audience.ts";
import type { NetworkObjectId } from "#ads/domain/ids.ts";
import { NetworkObjectIdSchema } from "#ads/domain/ids.ts";
import { TimeZoneIdSchema } from "#shared/domain/time-zone.ts";
import { addDays, localDateOf } from "#shared/domain/wall-clock.ts";
import type { MetaApp } from "#shared/infrastructure/platforms/meta-apps.ts";
import {
  appSecretProof,
  graphUrl,
} from "#shared/infrastructure/platforms/meta-graph.ts";
import type { MetaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";

import { getWith, postForm, read, write } from "./marketing-http.ts";
import type { MarketingHttp } from "./marketing-http.ts";
import { UpdatedSchema } from "./marketing-schemas.ts";
import { metaAdsClient } from "./meta-ads-client.ts";
import { TrialRefused } from "./trial-refused.ts";

// The Marketing API trial (`nx run peal-server:ads-trial`): the operator
// runs the adapter's own requests against Meta from their machine, and
// reads every request and Meta's whole answer on their terminal, which the
// server never logs (a network's message may quote what was sent). The
// token, the app secret and the proof are masked wherever they appear.
//
// Everything the trial makes is paused, as a boost's objects are. The one
// request that runs something, `activate`, exists only on the ad account
// the operator names as the sandbox one (Meta's sandbox ad account, which
// "won't run" ads), and only on the day `PEAL_ADS_TRIAL_ACTIVATE` names.

/** What a masked value reads as. */
export const masked = "‹masked›";

// Parameters whose value is a credential, wherever they appear: in an
// address, a form body or a JSON answer.
const secretNames = [
  "access_token",
  "appsecret_proof",
  "client_secret",
  "fb_exchange_token",
  "input_token",
] as const;

const secretNameSet: ReadonlySet<string> = new Set(secretNames);

const inParams = new RegExp(
  `(?<name>${secretNames.join("|")})=(?<value>[^&\\s"']*)`,
  "gu"
);

const inJson = new RegExp(
  `"(?<name>${secretNames.join("|")})"\\s*:\\s*"(?<value>[^"]*)"`,
  "gu"
);

// A secret shorter than this is not looked for in the text: it would mask
// ordinary words.
const shortestSecret = 8;

/**
 * The text with every credential masked: the values of the parameters
 * that carry one, and each secret given (the token, the app secret, the
 * proof) wherever it appears, as written or encoded for an address.
 */
export const maskText = (text: string, secrets: readonly string[]): string => {
  let current = text;

  for (const secret of secrets) {
    if (secret.length >= shortestSecret) {
      current = current
        .replaceAll(secret, masked)
        .replaceAll(encodeURIComponent(secret), masked);
    }
  }

  return current
    .replaceAll(inParams, `$<name>=${masked}`)
    .replaceAll(inJson, `"$<name>":"${masked}"`);
};

/** A request the trial sent and what came back, credentials masked. */
export interface Exchange {
  readonly answer:
    | {
        readonly _tag: "answer";
        readonly body: string;
        readonly headers: Readonly<Record<string, string>>;
        readonly status: number;
      }
    | { readonly _tag: "noAnswer"; readonly reason: string };
  readonly at: string;
  readonly method: string;
  /** Each parameter, from the address and the form body, in order. */
  readonly params: readonly (readonly [string, string])[];
  readonly path: string;
}

const decoder = new TextDecoder();

const paramsOf = (
  request: HttpClientRequest.HttpClientRequest,
  secrets: readonly string[]
): readonly (readonly [string, string])[] => {
  const fromUrl = request.urlParams.params.map(
    ([name, value]) =>
      [
        name,
        Redacted.isRedacted(value) ? Redacted.value(value) : value,
      ] as const
  );

  const fromBody =
    request.body._tag === "Uint8Array"
      ? [...new URLSearchParams(decoder.decode(request.body.body))]
      : [];

  return [...fromUrl, ...fromBody].map(([name, value]) => [
    name,
    secretNameSet.has(name) ? masked : maskText(value, secrets),
  ]);
};

const headersOf = (
  response: HttpClientResponse.HttpClientResponse,
  secrets: readonly string[]
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(response.headers).flatMap(([name, value]) =>
      name === "set-cookie" ? [] : [[name, maskText(value, secrets)] as const]
    )
  );

/**
 * The Marketing API's client with every request and its answer handed to
 * `seen`, credentials masked, before the adapter reads the answer.
 */
export const printing = (
  http: MarketingHttp,
  options: {
    readonly secrets: readonly string[];
    readonly seen: (exchange: Exchange) => Effect.Effect<void>;
  }
): MarketingHttp =>
  HttpClient.transform(http, (sent, request) => {
    const { secrets, seen } = options;

    const exchange = (answer: Exchange["answer"]) =>
      DateTime.now.pipe(
        Effect.flatMap((now) =>
          seen({
            answer,
            at: DateTime.formatIso(now),
            method: request.method,
            params: paramsOf(request, secrets),
            path: maskText(new URL(request.url).pathname, secrets),
          })
        )
      );

    return sent.pipe(
      Effect.tap((response) =>
        response.text.pipe(
          Effect.orElseSucceed(() => ""),
          Effect.flatMap((body) =>
            exchange({
              _tag: "answer",
              body: maskText(body, secrets),
              headers: headersOf(response, secrets),
              status: response.status,
            })
          )
        )
      ),
      Effect.tapError((failure) =>
        exchange({ _tag: "noAnswer", reason: maskText(failure._tag, secrets) })
      )
    );
  });

/** The start of every name the trial gives what it makes. */
export const trialPrefix = "peal-trial-";

// An ad account's id, once `act_` is taken off: digits, never blank.
const accountIdPattern = /^\d+$/u;

/** An ad account's id without Meta's `act_` prefix. */
export const accountIdOf = (id: string): string =>
  id.trim().replace(/^act_/u, "");

/** Why the day forbids `activate`, when it does: checked before any request. */
export const dayRefusal = (check: {
  /** `PEAL_ADS_TRIAL_ACTIVATE`, when set. */
  readonly activateOn: Option.Option<string>;
  /** Today, in UTC, as YYYY-MM-DD. */
  readonly today: string;
}): Option.Option<string> => {
  if (Option.isNone(check.activateOn)) {
    return Option.some(
      "PEAL_ADS_TRIAL_ACTIVATE is not set: set it to today's date (UTC, YYYY-MM-DD) to activate on the sandbox ad account."
    );
  }

  return check.activateOn.value.trim() === check.today
    ? Option.none()
    : Option.some(
        `PEAL_ADS_TRIAL_ACTIVATE is not today's date (${check.today}, UTC): nothing is activated.`
      );
};

/** Why an object is not the trial's to change, when it is not. */
export const notTrialsRefusal = (name: string): Option.Option<string> =>
  name.startsWith(trialPrefix)
    ? Option.none()
    : Option.some(
        `The object is not named ${trialPrefix}…: the trial changes only what it made.`
      );

/** Why `activate` refuses, when it does. */
export const activationRefusal = (check: {
  readonly activateOn: Option.Option<string>;
  /** The ad account the object is in, as Meta says. */
  readonly objectAccount: string;
  /** The object's name, as Meta says. */
  readonly objectName: string;
  /** The account the operator named as the sandbox ad account. */
  readonly sandboxAccount: string;
  readonly today: string;
}): Option.Option<string> => {
  const object = accountIdOf(check.objectAccount);
  const sandbox = accountIdOf(check.sandboxAccount);

  return dayRefusal(check).pipe(
    Option.orElse(() => notTrialsRefusal(check.objectName)),
    Option.orElse(() =>
      accountIdPattern.test(object) && object === sandbox
        ? Option.none()
        : Option.some(
            "The object is not in the ad account named by --sandbox-account: nothing is activated outside the sandbox ad account."
          )
    )
  );
};

/** The name the trial gives what it makes, from the moment it is made. */
export const trialName = (now: DateTime.Utc): string =>
  `${trialPrefix}${DateTime.formatIso(now).replaceAll(/[-:]|\.\d+/gu, "")}`;

// What an object says of itself: its name and the ad account it is in.
const TrialObjectSchema = Schema.Struct({
  account_id: Schema.String,
  name: Schema.String,
});

/** The most a trial ad set's daily budget may be, in minor units. */
export const maxTrialBudget = 10_000;

/** The longest a trial ad set runs, in days. */
export const maxTrialDays = 7;

/** The most days of numbers a snapshot reads, as a first sync does. */
export const maxSnapshotDays = 90;

const refusedUnless = (holds: boolean, reason: string) =>
  holds ? Effect.void : Effect.fail(new TrialRefused({ reason }));

const isBetween = (value: number, minimum: number, maximum: number) =>
  Number.isInteger(value) && value >= minimum && value <= maximum;

// The token, trimmed, and every form to mask: as given and as trimmed.
const TokenConfig = Config.Redacted("PEAL_ADS_TRIAL_TOKEN");
const ActivateConfig = Config.option(Config.String("PEAL_ADS_TRIAL_ACTIVATE"));

/**
 * What the trial reads from the environment, and only from it: the token
 * (`PEAL_ADS_TRIAL_TOKEN`, trimmed, refused when blank or missing) and the
 * day activation is allowed on (`PEAL_ADS_TRIAL_ACTIVATE`).
 */
export const trialSettings = Effect.gen(function* trialSettings() {
  const blank = new TrialRefused({
    reason:
      "Set PEAL_ADS_TRIAL_TOKEN to a user token from the app dashboard's Marketing API Tools page.",
  });

  const raw = yield* TokenConfig.pipe(Effect.mapError(() => blank));
  const given = Redacted.value(raw);
  const trimmed = given.trim();

  if (trimmed === "") {
    return yield* blank;
  }

  const activateOn = yield* ActivateConfig.pipe(
    Effect.orElseSucceed(() => Option.none<string>())
  );

  return {
    activateOn,
    token: Redacted.make(trimmed),
    tokenForms: [...new Set([given, trimmed])],
  };
});

const decodeObjectId = Schema.decodeUnknownEffect(NetworkObjectIdSchema);
const decodeAudience = Schema.decodeUnknownEffect(Audience);
const utc = TimeZoneIdSchema.make("UTC");

const refusedArgument = (what: string) => () =>
  new TrialRefused({ reason: `${what} is not one Meta could know.` });

const objectIdOf = (id: string, what: string) =>
  decodeObjectId(accountIdOf(id)).pipe(Effect.mapError(refusedArgument(what)));

/** What an ad set of the trial holds. */
export interface TrialAdSet {
  readonly ageMax: number;
  readonly ageMin: number;
  readonly beneficiary: string;
  /** A daily budget, in the account's minor units. */
  readonly budget: number;
  readonly campaign: string;
  readonly countries: readonly string[];
  readonly days: number;
  readonly payer: string;
}

/** What `find` looks for: a campaign, an ad set or an ad, by its name. */
export interface TrialLookUp {
  readonly adSet: Option.Option<string>;
  readonly campaign: Option.Option<string>;
  readonly name: string;
}

/**
 * The trial's steps, each the adapter's own request (or, for what the
 * product never asks, a plain Graph request), against `hosts` with the
 * printed client. Needs Mac for the proof.
 */
export const makeTrial = Effect.fn("MetaAds.trial")(
  function* makeTrial(options: {
    readonly app: MetaApp;
    readonly hosts: MetaHosts;
    readonly http: MarketingHttp;
    readonly token: Redacted.Redacted;
  }) {
    const mac = yield* Mac.Mac;
    const { app, hosts, http, token } = options;

    const client = yield* metaAdsClient({
      app,
      hosts,
      http,
      // The trial makes what a boost makes: the spending requests' shapes.
      mode: "spend",
      publicUrl: "http://localhost",
    });

    const proof = appSecretProof(token, app.appSecret).pipe(
      Effect.provideService(Mac.Mac, mac)
    );

    const graphGet = <A, I>(
      path: string,
      params: Readonly<Record<string, string>>,
      schema: Schema.Codec<A, I>
    ) =>
      proof.pipe(
        Effect.flatMap((signed) =>
          read(
            http,
            getWith(graphUrl(hosts, path), {
              ...params,
              access_token: token,
              appsecret_proof: signed,
            }),
            schema
          )
        ),
        Effect.map(({ value }) => value)
      );

    const graphPost = (
      path: string,
      params: Readonly<Record<string, string>>
    ) =>
      proof.pipe(
        Effect.flatMap((signed) =>
          write(
            http,
            postForm(graphUrl(hosts, path), {
              ...params,
              access_token: token,
              appsecret_proof: signed,
            }),
            UpdatedSchema
          )
        )
      );

    const named = DateTime.now.pipe(Effect.map(trialName));

    // The object, once Meta says the trial made it: its name is the
    // trial's. Anything else is refused before it is changed.
    const trialsOwn = Effect.fn("MetaAds.trial.trialsOwn")(function* trialsOwn(
      objectId: string
    ) {
      const object = yield* objectIdOf(objectId, "The object");

      const { name } = yield* graphGet(
        `/${object}`,
        { fields: "account_id,name" },
        TrialObjectSchema
      );

      const refusal = notTrialsRefusal(name);

      if (Option.isSome(refusal)) {
        return yield* new TrialRefused({ reason: refusal.value });
      }

      return object;
    });

    const created = (accountId: NetworkObjectId, object: NewObject) =>
      client
        .create(token, accountId, object)
        .pipe(Effect.map((id) => ({ id, name: object.name })));

    return {
      accounts: () => client.accounts(token),

      account: (id: string) =>
        objectIdOf(id, "The ad account").pipe(
          Effect.flatMap((accountId) => client.account(token, accountId))
        ),

      /** The account's objects and the days of `days` up to today. */
      snapshot: Effect.fn("MetaAds.trial.snapshot")(function* snapshot(
        id: string,
        days: number
      ) {
        yield* refusedUnless(
          isBetween(days, 1, maxSnapshotDays),
          `--days is a whole number from 1 to ${maxSnapshotDays}.`
        );

        const externalId = yield* objectIdOf(id, "The ad account");
        const facts = yield* client.account(token, externalId);
        const timeZone = Option.getOrElse(facts.timeZone, () => utc);
        const until = localDateOf(yield* DateTime.now, timeZone);

        return yield* client.snapshot(token, {
          currency: facts.currency,
          externalId,
          since: addDays(until, 1 - Math.max(1, days)),
          timeZone,
          until,
        });
      }),

      // "Ad Account Minimum Budgets" of the Marketing API reference.
      minimumBudgets: (id: string) =>
        objectIdOf(id, "The ad account").pipe(
          Effect.flatMap((accountId) =>
            graphGet(`/act_${accountId}/minimum_budgets`, {}, Schema.Unknown)
          )
        ),

      campaign: Effect.fn("MetaAds.trial.campaign")(function* campaign(
        id: string
      ) {
        return yield* created(yield* objectIdOf(id, "The ad account"), {
          _tag: "campaign",
          name: yield* named,
        });
      }),

      /** A paused ad set, starting in an hour, with a daily budget. */
      adSet: Effect.fn("MetaAds.trial.adSet")(function* adSet(
        id: string,
        set: TrialAdSet
      ) {
        // A trial ad set stays small and short, even paused.
        yield* refusedUnless(
          isBetween(set.budget, 1, maxTrialBudget),
          `--budget is a whole number of minor units from 1 to ${maxTrialBudget}.`
        );
        yield* refusedUnless(
          isBetween(set.days, 1, maxTrialDays),
          `--days is a whole number from 1 to ${maxTrialDays}.`
        );

        const accountId = yield* objectIdOf(id, "The ad account");
        const campaignId = yield* objectIdOf(set.campaign, "The campaign");

        const audience = yield* decodeAudience({
          ageMax: set.ageMax,
          ageMin: set.ageMin,
          countries: set.countries,
        }).pipe(
          Effect.mapError(
            () =>
              new TrialRefused({
                reason:
                  "The audience is not one a boost may have: countries as ISO codes, ages 18 to 65.",
              })
          )
        );

        const startsAt = DateTime.addDuration(
          yield* DateTime.now,
          Duration.hours(1)
        );

        return yield* created(accountId, {
          _tag: "adSet",
          audience,
          beneficiary: Option.some(set.beneficiary),
          budget: { _tag: "daily", amount: set.budget },
          campaignId,
          endsAt: DateTime.addDuration(startsAt, Duration.days(set.days)),
          name: yield* named,
          payer: Option.some(set.payer),
          startsAt,
        });
      }),

      /** A paused ad showing a Page post or an Instagram media. */
      ad: Effect.fn("MetaAds.trial.ad")(function* ad(
        id: string,
        adSetId: string,
        post: PromotedPost
      ) {
        return yield* created(yield* objectIdOf(id, "The ad account"), {
          _tag: "ad",
          adSetId: yield* objectIdOf(adSetId, "The ad set"),
          name: yield* named,
          post,
        });
      }),

      status: (objectId: string) =>
        objectIdOf(objectId, "The object").pipe(
          Effect.flatMap((object) =>
            graphGet(
              `/${object}`,
              { fields: "id,name,status,effective_status,account_id" },
              Schema.Unknown
            )
          )
        ),

      /** What the adapter's lookup by name finds, as after a lost answer. */
      lookUp: Effect.fn("MetaAds.trial.lookUp")(function* lookUp(
        id: string,
        wanted: TrialLookUp
      ) {
        const accountId = yield* objectIdOf(id, "The ad account");

        if (Option.isSome(wanted.adSet)) {
          return yield* client.find(token, accountId, {
            _tag: "ad",
            adSetId: yield* objectIdOf(wanted.adSet.value, "The ad set"),
            name: wanted.name,
            // A lookup reads the name and where the ad is, nothing else.
            post: { accountId: "", platform: "facebook", platformPostId: "" },
          });
        }

        if (Option.isSome(wanted.campaign)) {
          const now = yield* DateTime.now;

          return yield* client.find(token, accountId, {
            _tag: "adSet",
            // A lookup reads the name and where the ad set is, nothing else.
            audience: new Audience({
              ageMax: 65,
              ageMin: 18,
              countries: ["FR"],
            }),
            beneficiary: Option.none(),
            budget: { _tag: "daily", amount: 0 },
            campaignId: yield* objectIdOf(
              wanted.campaign.value,
              "The campaign"
            ),
            endsAt: now,
            name: wanted.name,
            payer: Option.none(),
            startsAt: now,
          });
        }

        return yield* client.find(token, accountId, {
          _tag: "campaign",
          name: wanted.name,
        });
      }),

      /** Pauses an object the trial made. */
      pause: Effect.fn("MetaAds.trial.pause")(function* pause(
        objectId: string
      ) {
        const object = yield* trialsOwn(objectId);

        return yield* client.setRunning(token, object, false);
      }),

      /**
       * Runs an object, only in the sandbox ad account and only on the day
       * `activateOn` names: anywhere else nothing is sent but the read of
       * the object's account.
       */
      activate: Effect.fn("MetaAds.trial.activate")(function* activate(
        objectId: string,
        sandboxAccount: string,
        activateOn: Option.Option<string>
      ) {
        const object = yield* objectIdOf(objectId, "The object");
        const today = DateTime.formatIsoDateUtc(yield* DateTime.now);

        // The day first: on another day, Meta is asked nothing.
        const wrongDay = dayRefusal({ activateOn, today });

        if (Option.isSome(wrongDay)) {
          return yield* new TrialRefused({ reason: wrongDay.value });
        }

        const facts = yield* graphGet(
          `/${object}`,
          { fields: "account_id,name" },
          TrialObjectSchema
        );

        const refusal = activationRefusal({
          activateOn,
          objectAccount: facts.account_id,
          objectName: facts.name,
          sandboxAccount,
          today,
        });

        if (Option.isSome(refusal)) {
          return yield* new TrialRefused({ reason: refusal.value });
        }

        return yield* client.setRunning(token, object, true);
      }),

      /**
       * Deletes what the trial made (`status=DELETED`, "Manage Your Ad
       * Object's Status"): the trial's cleaning, which the product never
       * asks.
       */
      delete: Effect.fn("MetaAds.trial.delete")(function* deleteObject(
        objectId: string
      ) {
        const object = yield* trialsOwn(objectId);

        return yield* graphPost(`/${object}`, { status: "DELETED" });
      }),
    };
  }
);
