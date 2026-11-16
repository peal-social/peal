import { DateTime, Option, Schema } from "effect";

import { AdAccountFacts } from "#ads/domain/ad-account-facts.ts";
import type { AdAccountStatus } from "#ads/domain/ad-account-status.ts";
import type { AdObjectStatus } from "#ads/domain/ad-object.ts";
import { CampaignDay } from "#ads/domain/campaign-day.ts";
import { NetworkObjectIdSchema } from "#ads/domain/ids.ts";
import type { NetworkObjectId } from "#ads/domain/ids.ts";
import { maxCount } from "#ads/domain/insight-day.ts";
import {
  CurrencySchema,
  minorUnitDigits,
  minorUnitsOfMicros,
} from "#ads/domain/money.ts";
import type { Currency } from "#ads/domain/money.ts";
import { SyncedCampaign } from "#ads/domain/synced-campaign.ts";
import { storableLine } from "#shared/domain/platform-text.ts";
import { TimeZoneIdSchema } from "#shared/domain/time-zone.ts";
import type { TimeZoneId } from "#shared/domain/time-zone.ts";
import { fromWallClock, LocalDateSchema } from "#shared/domain/wall-clock.ts";
import type { LocalDate } from "#shared/domain/wall-clock.ts";

import type {
  CampaignRow,
  ClientRow,
  CustomerRow,
  DayRow,
} from "./google-ads-schemas.ts";

// Field references of v26 (read 2026-11-16): `customer.status` and
// `customer_client.status` are ENABLED, CANCELED, SUSPENDED or CLOSED.
const accountStatuses: ReadonlyMap<string, AdAccountStatus> = new Map([
  ["ENABLED", "active"],
  ["CANCELED", "closed"],
  ["CLOSED", "closed"],
  ["SUSPENDED", "disabled"],
]);

// `campaign.status`: ENABLED, PAUSED or REMOVED.
const campaignStatuses: ReadonlyMap<string, AdObjectStatus> = new Map([
  ["ENABLED", "active"],
  ["PAUSED", "paused"],
  ["REMOVED", "deleted"],
]);

const decodeId = Schema.decodeUnknownOption(NetworkObjectIdSchema);
const decodeCurrency = Schema.decodeUnknownOption(CurrencySchema);
const decodeZone = Schema.decodeUnknownOption(TimeZoneIdSchema);
const decodeDay = Schema.decodeUnknownOption(LocalDateSchema);

// An id Google gives a customer or a campaign: an int64, in digits.
const numericIdPattern = /^\d{1,20}$/u;

/** A customer's id from its resource name, `customers/1234567890`. */
export const customerIdOf = (
  resourceName: string
): Option.Option<NetworkObjectId> =>
  Option.fromNullishOr(
    /^customers\/(?<id>\d{1,20})$/u.exec(resourceName)?.groups?.["id"]
  ).pipe(Option.flatMap(decodeId));

const numericId = (written: string | undefined) =>
  Option.fromUndefinedOr(written).pipe(
    Option.filter((value) => numericIdPattern.test(value)),
    Option.flatMap(decodeId)
  );

// Written by whoever runs the account: kept storable, on one line, and
// named by its id when it has no name.
const accountName = (written: string | undefined, id: string) => {
  const name = storableLine(written ?? "", 512);

  return name === "" ? `Account ${id}` : name;
};

const factsFrom = (
  fields: {
    readonly currencyCode?: string;
    readonly descriptiveName?: string;
    readonly id?: string;
    readonly status?: string;
    readonly timeZone?: string;
  },
  reachedThrough: Option.Option<NetworkObjectId>
): Option.Option<AdAccountFacts> =>
  Option.gen(function* mappingAccount() {
    const externalId = yield* numericId(fields.id);

    return new AdAccountFacts({
      // Google Ads gives no account-level cap Peal reads.
      amountSpent: Option.none(),
      currency: yield* decodeCurrency(fields.currencyCode),
      externalId,
      name: accountName(fields.descriptiveName, externalId),
      reachedThrough,
      spendCap: Option.none(),
      status: accountStatuses.get(fields.status ?? "") ?? "unknown",
      // A CLDR zone, which is an IANA id for every zone Google offers;
      // one Peal does not know is none, and the account is then offered
      // as one Peal cannot connect.
      timeZone: Option.fromUndefinedOr(fields.timeZone).pipe(
        Option.flatMap(decodeZone)
      ),
    });
  });

/** A `customer_client` row as an account, reached as the caller says. */
export const clientFactsOf = (
  row: ClientRow,
  reachedThrough: Option.Option<NetworkObjectId>
) => factsFrom(row.customerClient, reachedThrough);

/** The account itself, from the `customer` query. */
export const customerFactsOf = (
  row: CustomerRow,
  reachedThrough: Option.Option<NetworkObjectId>
) => factsFrom(row.customer, reachedThrough);

/** How deep under the manager queried a `customer_client` row is. */
export const levelOf = (row: ClientRow): number => {
  const written = row.customerClient.level ?? "0";

  return /^\d{1,3}$/u.test(written)
    ? Number(written)
    : Number.POSITIVE_INFINITY;
};

const minorUnits = (written: string | undefined, currency: Currency) =>
  Option.fromUndefinedOr(written).pipe(
    Option.flatMapNullishOr((micros) =>
      minorUnitsOfMicros(micros, minorUnitDigits("google", currency))
    ),
    Option.filter((amount) => amount > 0)
  );

const dateTimePattern =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2}) (?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})$/u;

/**
 * The instant a campaign's `start_date_time` or `end_date_time` names:
 * "in the customer's time zone and in yyyy-MM-dd HH:mm:ss format"
 * (`campaign` fields, v26). None when it reads otherwise.
 */
export const instantOf = (
  written: string | undefined,
  timeZone: TimeZoneId
): Option.Option<DateTime.Utc> =>
  Option.fromNullishOr(dateTimePattern.exec(written ?? "")?.groups).pipe(
    Option.flatMap((groups) =>
      decodeDay({
        day: Number(groups["day"]),
        month: Number(groups["month"]),
        year: Number(groups["year"]),
      }).pipe(
        Option.map((date) => ({
          date,
          hour: Number(groups["hour"]),
          minute: Number(groups["minute"]),
          second: Number(groups["second"]),
        }))
      )
    ),
    Option.filter(
      ({ hour, minute, second }) => hour < 24 && minute < 60 && second < 60
    ),
    Option.map(({ date, hour, minute, second }) =>
      DateTime.toUtc(
        DateTime.add(fromWallClock(date, { hour, minute }, timeZone), {
          seconds: second,
        })
      )
    )
  );

/**
 * A campaign as the domain has it; none when its id is not one Peal can
 * keep. Its objective is `other`: Google's campaigns are told apart by
 * their channel, kept as `kind`.
 */
export const campaignOf = (
  row: CampaignRow,
  currency: Currency,
  timeZone: TimeZoneId
): Option.Option<SyncedCampaign> =>
  numericId(row.campaign.id).pipe(
    Option.map((externalId) => {
      const raw = row.campaign.status ?? "";
      const budget = row.campaignBudget;

      return new SyncedCampaign({
        // `period` DAILY (the default) spends `amount_micros` a day on
        // average; CUSTOM_PERIOD spends `total_amount_micros` over the
        // campaign's run (`campaign_budget` fields, v26).
        dailyBudget:
          (budget?.period ?? "DAILY") === "DAILY"
            ? minorUnits(budget?.amountMicros, currency)
            : Option.none(),
        endsAt: instantOf(row.campaign.endDateTime, timeZone),
        externalId,
        kind: Option.fromUndefinedOr(row.campaign.advertisingChannelType).pipe(
          Option.map((kind) => storableLine(kind, 64)),
          Option.filter((kind) => kind !== "")
        ),
        // Written by whoever runs the account: kept storable, on one line.
        name: storableLine(row.campaign.name ?? "", 1024),
        objective: "other",
        rawStatus: storableLine(raw, 64),
        startsAt: instantOf(row.campaign.startDateTime, timeZone),
        status: campaignStatuses.get(raw) ?? "unknown",
        totalBudget:
          budget?.period === "CUSTOM_PERIOD"
            ? minorUnits(budget.totalAmountMicros, currency)
            : Option.none(),
      });
    })
  );

// Micros as Google writes them, a whole number in a string; zero when left
// out, and none past what a number holds exactly.
const microsOf = (written = "0"): Option.Option<number> =>
  /^\d{1,16}$/u.test(written) && Number(written) <= Number.MAX_SAFE_INTEGER
    ? Option.some(Number(written))
    : Option.none();

// A count Google left out is zero.
const count = (written = "0"): Option.Option<number> =>
  /^\d{1,10}$/u.test(written) && Number(written) <= maxCount
    ? Option.some(Number(written))
    : Option.none();

const dayPattern = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u;

/** A `segments.date`, `2026-11-10`, as a day of the account's calendar. */
export const dayOf = (written: string | undefined): Option.Option<LocalDate> =>
  Option.fromNullishOr(dayPattern.exec(written ?? "")?.groups).pipe(
    Option.flatMap((groups) =>
      decodeDay({
        day: Number(groups["day"]),
        month: Number(groups["month"]),
        year: Number(groups["year"]),
      })
    )
  );

/**
 * A day of a campaign's numbers; none when a value cannot be kept as it is
 * written (a count past what the columns hold, an amount past what a number
 * holds exactly), and the row is then left out rather than clamped. Cost
 * is kept in micros of the account's currency, as written.
 */
export const campaignDayOf = (row: DayRow): Option.Option<CampaignDay> =>
  Option.gen(function* mappingDay() {
    return new CampaignDay({
      campaignExternalId: yield* numericId(row.campaign.id),
      clicks: yield* count(row.metrics?.clicks),
      day: yield* dayOf(row.segments.date),
      impressions: yield* count(row.metrics?.impressions),
      spendMicros: yield* microsOf(row.metrics?.costMicros),
    });
  });
