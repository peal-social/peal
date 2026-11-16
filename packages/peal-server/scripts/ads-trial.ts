// The Marketing API trial: runs the ads adapter's own requests against
// Meta from the operator's machine, and prints each request and Meta's
// whole answer, the token, the app secret and the proof masked. Each
// exchange is also appended, masked, to ads-trial.log in the working
// directory (ignored by Git). From the repository root:
//
//   META_APP_ID=… META_APP_SECRET=… PEAL_ADS_TRIAL_TOKEN=… \
//     bun nx run peal-server:ads-trial -- accounts
//
// It reads, from the environment only: META_APP_ID and META_APP_SECRET
// (Meta's main app), PEAL_ADS_TRIAL_TOKEN (a user token, from the app
// dashboard's Marketing API Tools page) and PEAL_ADS_TRIAL_ACTIVATE (to
// activate on the sandbox ad account, today's date in UTC, YYYY-MM-DD).
//
// Everything it makes is paused and named peal-trial-<UTC time>. Only
// `activate` runs something, and only in the account given as
// --sandbox-account, on the day PEAL_ADS_TRIAL_ACTIVATE names.
import { BunDns, BunRuntime, BunServices } from "@effect/platform-bun";
import {
  Config,
  Console,
  Effect,
  FileSystem,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";

import type { PromotedPost } from "#ads/application/ports/ad-network.ts";
import { TrialRefused } from "#ads/infrastructure/meta/trial-refused.ts";
import { makeTrial, printing } from "#ads/infrastructure/meta/trial.ts";
import type { Exchange } from "#ads/infrastructure/meta/trial.ts";
import { metaAppConfig } from "#shared/infrastructure/platforms/meta-apps.ts";
import {
  appSecretProof,
  metaHosts,
} from "#shared/infrastructure/platforms/meta-graph.ts";
import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";

const logFile = "ads-trial.log";

const MacLive = Mac.layerWebCrypto.pipe(
  Layer.provide(SecureRandom.layerWebCrypto)
);

const decodeJson = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Unknown)
);

// An answer's body, indented when it is JSON.
const pretty = (body: string) =>
  Option.match(decodeJson(body), {
    onNone: () => body,
    onSome: (json) => JSON.stringify(json, null, 2),
  });

const failedWith = (code: number) =>
  Effect.sync(() => {
    process.exitCode = code;
  });

const printed = (exchange: Exchange) =>
  [
    `→ ${exchange.method} ${exchange.path}`,
    ...exchange.params.map(([name, value]) => `    ${name}=${value}`),
    ...(exchange.answer._tag === "answer"
      ? [
          `← ${exchange.answer.status}`,
          ...Object.entries(exchange.answer.headers).map(
            ([name, value]) => `    ${name}: ${value}`
          ),
          pretty(exchange.answer.body),
        ]
      : [`← no answer (${exchange.answer.reason})`]),
    "",
  ].join("\n");

const settings = Effect.gen(function* readSettings() {
  const app = yield* metaAppConfig;

  const token = yield* Config.Redacted("PEAL_ADS_TRIAL_TOKEN").pipe(
    Effect.mapError(
      () =>
        new TrialRefused({
          reason:
            "Set PEAL_ADS_TRIAL_TOKEN to a user token from the app dashboard's Marketing API Tools page.",
        })
    )
  );

  if (Option.isNone(app)) {
    return yield* new TrialRefused({
      reason: "Set META_APP_ID and META_APP_SECRET, Meta's main app.",
    });
  }

  return { app: app.value, token };
});

// The trial, its every exchange printed and logged, for one subcommand.
const trialFor = (command: string) =>
  Effect.gen(function* printedTrial() {
    const fs = yield* FileSystem.FileSystem;
    const { app, token } = yield* settings;
    const proof = yield* appSecretProof(token, app.appSecret);

    const http = printing(yield* publicHttpClient, {
      secrets: [
        Redacted.value(token),
        Redacted.value(app.appSecret),
        Redacted.value(proof),
      ],
      seen: (exchange) =>
        Console.log(printed(exchange)).pipe(
          Effect.andThen(
            fs.writeFileString(
              logFile,
              `${JSON.stringify({ command, ...exchange })}\n`,
              { flag: "a" }
            )
          ),
          Effect.orDie
        ),
    });

    return yield* makeTrial({ app, hosts: metaHosts, http, token });
  });

// What a step gave back, or why it failed, after the exchanges.
const reported = <A, E extends { readonly _tag: string }, R>(
  step: Effect.Effect<A, E, R>
) =>
  step.pipe(
    Effect.matchEffect({
      onFailure: (refusal) =>
        Console.error(`Failed: ${JSON.stringify(refusal)}`).pipe(
          Effect.andThen(failedWith(1))
        ),
      onSuccess: (value) =>
        Console.log(`Result: ${JSON.stringify(value, null, 2) ?? "done"}`),
    })
  );

const accountArgument = Argument.String("account-id").pipe(
  Argument.withDescription("The ad account, with or without act_.")
);

const objectArgument = Argument.String("object-id").pipe(
  Argument.withDescription("A campaign, an ad set or an ad.")
);

const accounts = Command.make("accounts", {}, () =>
  reported(
    trialFor("accounts").pipe(Effect.flatMap((trial) => trial.accounts()))
  )
).pipe(Command.withDescription("List the ad accounts the token reaches."));

const account = Command.make("account", { id: accountArgument }, ({ id }) =>
  reported(
    trialFor("account").pipe(Effect.flatMap((trial) => trial.account(id)))
  )
).pipe(Command.withDescription("Read one ad account."));

const snapshot = Command.make(
  "snapshot",
  {
    days: Flag.Int("days").pipe(
      Flag.withDescription("The days of numbers to read, up to today."),
      Flag.withDefault(7)
    ),
    id: accountArgument,
  },
  ({ days, id }) =>
    reported(
      trialFor("snapshot").pipe(
        Effect.flatMap((trial) => trial.snapshot(id, days))
      )
    )
).pipe(
  Command.withDescription(
    "Read what a sync reads: the account, its campaigns, ad sets, ads and days."
  )
);

const minimumBudgets = Command.make(
  "minimum-budgets",
  { id: accountArgument },
  ({ id }) =>
    reported(
      trialFor("minimum-budgets").pipe(
        Effect.flatMap((trial) => trial.minimumBudgets(id))
      )
    )
).pipe(Command.withDescription("Read the account's minimum daily budgets."));

const campaign = Command.make("campaign", { id: accountArgument }, ({ id }) =>
  reported(
    trialFor("campaign").pipe(Effect.flatMap((trial) => trial.campaign(id)))
  )
).pipe(Command.withDescription("Make a paused campaign, as a boost does."));

const adSet = Command.make(
  "ad-set",
  {
    ageMax: Flag.Int("age-max").pipe(Flag.withDefault(65)),
    ageMin: Flag.Int("age-min").pipe(Flag.withDefault(18)),
    beneficiary: Flag.String("beneficiary").pipe(
      Flag.withDescription("Who benefits from the ad, for the EU."),
      Flag.withDefault("Peal")
    ),
    budget: Flag.Int("budget").pipe(
      Flag.withDescription("A daily budget, in the account's minor units.")
    ),
    campaign: Flag.String("campaign").pipe(
      Flag.withDescription("The campaign it goes in.")
    ),
    countries: Flag.String("countries").pipe(
      Flag.withDescription("Countries, as ISO codes, comma-separated."),
      Flag.withDefault("FR")
    ),
    days: Flag.Int("days").pipe(Flag.withDefault(2)),
    id: accountArgument,
    payer: Flag.String("payer").pipe(
      Flag.withDescription("Who pays for the ad, for the EU."),
      Flag.withDefault("Peal")
    ),
  },
  ({ countries, id, ...set }) =>
    reported(
      trialFor("ad-set").pipe(
        Effect.flatMap((trial) =>
          trial.adSet(id, {
            ...set,
            countries: countries.split(",").map((code) => code.trim()),
          })
        )
      )
    )
).pipe(
  Command.withDescription(
    "Make a paused ad set, as a boost does, starting in an hour."
  )
);

const ad = Command.make(
  "ad",
  {
    adSet: Flag.String("ad-set").pipe(
      Flag.withDescription("The ad set it goes in.")
    ),
    id: accountArgument,
    instagramAccount: Flag.String("instagram-account").pipe(
      Flag.withDescription("The Instagram account the media is from."),
      Flag.optional
    ),
    instagramMedia: Flag.String("instagram-media").pipe(
      Flag.withDescription("An Instagram media's id."),
      Flag.optional
    ),
    pagePost: Flag.String("page-post").pipe(
      Flag.withDescription("A Facebook Page post, as <page id>_<post id>."),
      Flag.optional
    ),
  },
  ({ adSet: adSetId, id, instagramAccount, instagramMedia, pagePost }) => {
    const post: Option.Option<PromotedPost> = Option.match(pagePost, {
      onNone: () =>
        Option.all([instagramMedia, instagramAccount]).pipe(
          Option.map(([media, igAccount]) => ({
            accountId: igAccount,
            platform: "instagram" as const,
            platformPostId: media,
          }))
        ),
      onSome: (story) =>
        Option.some({
          accountId: story.split("_")[0] ?? "",
          platform: "facebook" as const,
          platformPostId: story,
        }),
    });

    return Option.match(post, {
      onNone: () =>
        Console.error(
          "Give --page-post, or --instagram-media with --instagram-account."
        ).pipe(Effect.andThen(failedWith(2))),
      onSome: (shown) =>
        reported(
          trialFor("ad").pipe(
            Effect.flatMap((trial) => trial.ad(id, adSetId, shown))
          )
        ),
    });
  }
).pipe(
  Command.withDescription(
    "Make a paused ad showing a Page post or an Instagram media, as a boost does."
  )
);

const status = Command.make("status", { id: objectArgument }, ({ id }) =>
  reported(trialFor("status").pipe(Effect.flatMap((trial) => trial.status(id))))
).pipe(Command.withDescription("Read an object's status and account."));

const find = Command.make(
  "find",
  {
    adSet: Flag.String("ad-set").pipe(
      Flag.withDescription("Look for an ad in this ad set."),
      Flag.optional
    ),
    campaign: Flag.String("campaign").pipe(
      Flag.withDescription("Look for an ad set in this campaign."),
      Flag.optional
    ),
    id: accountArgument,
    name: Flag.String("name").pipe(
      Flag.withDescription("The name the trial gave it.")
    ),
  },
  ({ id, ...wanted }) =>
    reported(
      trialFor("find").pipe(Effect.flatMap((trial) => trial.lookUp(id, wanted)))
    )
).pipe(
  Command.withDescription(
    "Look an object up by name, as after a lost answer: a campaign, an ad set (--campaign) or an ad (--ad-set)."
  )
);

const pause = Command.make("pause", { id: objectArgument }, ({ id }) =>
  reported(trialFor("pause").pipe(Effect.flatMap((trial) => trial.pause(id))))
).pipe(Command.withDescription("Pause an object."));

const activate = Command.make(
  "activate",
  {
    id: objectArgument,
    sandboxAccount: Flag.String("sandbox-account").pipe(
      Flag.withDescription("The sandbox ad account: nothing runs elsewhere.")
    ),
  },
  ({ id, sandboxAccount }) =>
    reported(
      Effect.gen(function* activating() {
        const trial = yield* trialFor("activate");

        const activateOn = yield* Config.option(
          Config.String("PEAL_ADS_TRIAL_ACTIVATE")
        );

        return yield* trial.activate(id, sandboxAccount, activateOn);
      })
    )
).pipe(
  Command.withDescription(
    "Run an object of the sandbox ad account, on the day PEAL_ADS_TRIAL_ACTIVATE names."
  )
);

const deleted = Command.make("delete", { id: objectArgument }, ({ id }) =>
  reported(trialFor("delete").pipe(Effect.flatMap((trial) => trial.delete(id))))
).pipe(Command.withDescription("Delete what the trial made, innermost first."));

const trial = Command.make("ads-trial").pipe(
  Command.withDescription(
    "The Marketing API trial: the ads adapter's requests against Meta, printed."
  ),
  Command.withSubcommands([
    accounts,
    account,
    snapshot,
    minimumBudgets,
    campaign,
    adSet,
    ad,
    status,
    find,
    pause,
    activate,
    deleted,
  ])
);

BunRuntime.runMain(
  Command.run(trial, { version: "0.0.0" }).pipe(
    Effect.provide(
      Layer.mergeAll(
        BunServices.layer,
        MacLive,
        OutboundGuard.layer.pipe(Layer.provide(BunDns.layer)),
        FetchHttpClient.layer
      )
    )
  )
);
