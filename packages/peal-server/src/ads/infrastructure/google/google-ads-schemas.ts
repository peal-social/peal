import { Schema } from "effect";

// What the Google Ads API answers, as its REST interface writes it (read
// 2026-11-16): lowerCamelCase keys ("JSON Mappings"), int64 values as
// strings, and, as protocol buffers' JSON mapping does, a field at its
// default (zero, false, empty) left out. Every field is optional: what is
// missing is read as its default, or the row is left out.

const optional = Schema.optionalKey;

/** `customers:listAccessibleCustomers` ("Listing accessible accounts"). */
export const AccessibleSchema = Schema.Struct({
  resourceNames: optional(Schema.Array(Schema.String)),
});

/** One page of `googleAds:search` ("Search & SearchStream", "Paging"). */
export const pageOf = <A, I>(row: Schema.Codec<A, I>) =>
  Schema.Struct({
    nextPageToken: optional(Schema.String),
    results: optional(Schema.Array(row)),
  });

/** A row of the `customer_client` query ("Get account hierarchy"). */
export const ClientRowSchema = Schema.Struct({
  customerClient: Schema.Struct({
    currencyCode: optional(Schema.String),
    descriptiveName: optional(Schema.String),
    id: optional(Schema.String),
    level: optional(Schema.String),
    manager: optional(Schema.Boolean),
    status: optional(Schema.String),
    testAccount: optional(Schema.Boolean),
    timeZone: optional(Schema.String),
  }),
});

export type ClientRow = typeof ClientRowSchema.Type;

/** A row of the `customer` query: the account itself. */
export const CustomerRowSchema = Schema.Struct({
  customer: Schema.Struct({
    currencyCode: optional(Schema.String),
    descriptiveName: optional(Schema.String),
    id: optional(Schema.String),
    status: optional(Schema.String),
    testAccount: optional(Schema.Boolean),
    timeZone: optional(Schema.String),
  }),
});

export type CustomerRow = typeof CustomerRowSchema.Type;

/** A row of the campaigns' query, with the campaign's budget. */
export const CampaignRowSchema = Schema.Struct({
  campaign: Schema.Struct({
    advertisingChannelType: optional(Schema.String),
    endDateTime: optional(Schema.String),
    id: optional(Schema.String),
    name: optional(Schema.String),
    startDateTime: optional(Schema.String),
    status: optional(Schema.String),
  }),
  campaignBudget: optional(
    Schema.Struct({
      amountMicros: optional(Schema.String),
      period: optional(Schema.String),
      totalAmountMicros: optional(Schema.String),
    })
  ),
});

export type CampaignRow = typeof CampaignRowSchema.Type;

/** A row of the days' query: one campaign on one day. */
export const DayRowSchema = Schema.Struct({
  campaign: Schema.Struct({ id: optional(Schema.String) }),
  metrics: optional(
    Schema.Struct({
      clicks: optional(Schema.String),
      costMicros: optional(Schema.String),
      impressions: optional(Schema.String),
    })
  ),
  segments: Schema.Struct({ date: optional(Schema.String) }),
});

export type DayRow = typeof DayRowSchema.Type;

/** The token endpoint's answer ("Using OAuth 2.0 for Web Server Applications"). */
export const TokenAnswerSchema = Schema.Struct({
  access_token: Schema.NonEmptyString,
  id_token: optional(Schema.String),
  refresh_token: optional(Schema.NonEmptyString),
  scope: optional(Schema.String),
});

/** The token endpoint's refusal (RFC 6749, section 5.2). */
export const OAuthErrorSchema = Schema.Struct({
  error: optional(Schema.String),
});

/** What Peal reads of an ID token's payload: the account's `sub`. */
export const IdTokenClaimsSchema = Schema.Struct({
  sub: Schema.NonEmptyString,
});
