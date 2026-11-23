import { Option, Schema, SchemaIssue } from "effect";

import {
  ChannelIdSchema,
  MediaAssetIdSchema,
  PostIdSchema,
  UserIdSchema,
  Uuid7Schema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import { LocaleSchema } from "#shared/domain/locale.ts";
import { MeterSchema } from "#shared/domain/meter.ts";
import { PaidPlanSchema, PlanSchema } from "#shared/domain/plan.ts";
import {
  ChannelPlatformSchema,
  PlatformSchema,
  SitePlatformSchema,
} from "#shared/domain/platform.ts";

// What product analytics may say of what people do in Peal: ids, names
// Peal chose (operations, tools, reasons, plans), numbers and booleans.
// Never a text someone wrote, a name, an address, a URL or anything a
// platform answered. The names of events and properties are persisted
// for whoever queries them: add, never rename.

/**
 * A free string an event may carry (an operation, an error's code, a
 * tool's name, a failure reason, an id, an instant): 1 to 120 of letters,
 * digits and `_.:/-`. No space, `@`, `?`, `=`, `&` or `#`, so an address,
 * a sentence or a URL's query cannot pass.
 */
export const AnalyticsTokenSchema = Schema.String.check(
  Schema.isBetweenLength(1, 120),
  Schema.isPattern(/^[A-Za-z0-9_.:/-]+$/u)
);

export type AnalyticsToken = typeof AnalyticsTokenSchema.Type;

/** How a person signed up: a password, or a sign-in provider. */
export const SignUpMethodSchema = Schema.Literals([
  "password",
  "google",
  "oidc",
  "other",
]);

export type SignUpMethod = typeof SignUpMethodSchema.Type;

/** How a request that changed something authenticated, the MCP endpoint's aside. */
export const OperationViaSchema = Schema.Literals([
  "session",
  "apiKey",
  "oauth",
  "partnerKey",
]);

/** The code a tool call that did not do what was asked ended with. */
export const ToolErrorTypeSchema = Schema.Literals([
  "tool_refused",
  "tool_failed",
]);

/** Whose a billing account is: a person's, a partner's, or nobody's. */
export const BillingAccountKindSchema = Schema.Literals([
  "person",
  "partner",
  "unowned",
]);

export type BillingAccountKind = typeof BillingAccountKindSchema.Type;

// What an event says of its billing account, when the caller read it.
const billingAccountFacts = {
  freeTier: Schema.optionalKey(Schema.Boolean),
  kind: Schema.optionalKey(BillingAccountKindSchema),
  standalone: Schema.optionalKey(Schema.Boolean),
};

const event = <
  const Name extends string,
  const Fields extends Schema.Struct.Fields,
>(
  name: Name,
  fields: Fields
) =>
  Schema.Struct({
    name: Schema.Literal(name),
    properties: Schema.Struct(fields),
  });

/**
 * Every event Peal's server sends, with its own properties, written in
 * camelCase here and sent in snake_case (`wireProperties`).
 */
export const ProductEventSchema = Schema.Union([
  // A change the activity journal recorded, but through the MCP endpoint.
  event("api_operation", {
    errorCode: Schema.optionalKey(AnalyticsTokenSchema),
    operation: AnalyticsTokenSchema,
    status: Schema.optionalKey(Schema.Int),
    succeeded: Schema.Boolean,
    via: OperationViaSchema,
  }),
  // The API or the MCP endpoint answered a key or an application on `day`
  // (UTC), reads included: a key's as its workspace, an application's as
  // its person, in the workspace its token is bound to when it is. Once
  // each a day for each run of the server, so readers take one per
  // workspace or person, `via` and `day`. Never a partner key's.
  event("api_used", {
    day: AnalyticsTokenSchema,
    via: Schema.Literals(["apiKey", "oauth"]),
  }),
  // A tool of the MCP endpoint that ran, reading or changing.
  event("mcp_tool_called", {
    changes: Schema.Boolean,
    durationMs: Schema.Int,
    errorType: Schema.optionalKey(ToolErrorTypeSchema),
    isError: Schema.Boolean,
    tool: AnalyticsTokenSchema,
  }),
  event("user_signed_up", {
    locale: LocaleSchema,
    method: SignUpMethodSchema,
  }),
  // The billing account's facts, when it was read, beside its group's:
  // a project without group analytics queries them from the event.
  event("workspace_created", billingAccountFacts),
  // A workspace's state at the end of a UTC day, from billing's daily
  // usage snapshot, for a workspace with a connected account: what it
  // holds as the snapshot runs, and the day's assistant requests. A rerun
  // of the day sends it again: readers take one per workspace and day.
  // Beside the state, the day's counters of the usage ledger, when it
  // could be read: the posts that went out, and the units of the billing
  // meters the workspace claimed (none on a server that does not bill).
  event("workspace_snapshot", {
    assistantImages: Schema.optionalKey(Schema.Int),
    assistantRequests: Schema.Int,
    channels: Schema.Int,
    // The day (UTC) the state is of, `YYYY-MM-DD`.
    day: AnalyticsTokenSchema,
    managedAds: Schema.optionalKey(Schema.Int),
    mediaStorageBytes: Schema.Int,
    members: Schema.Int,
    outboundMessages: Schema.optionalKey(Schema.Int),
    publishedPosts: Schema.optionalKey(Schema.Int),
  }),
  // A billing account without a payment method used the `allowed` units
  // of `meter` its month includes: the meter pauses until next month.
  // Sent as the billing workspace's service identity, with the notice its
  // billing managers get: once a meter and month, but for a unit given
  // back and claimed again. The notice names the billing workspace alone,
  // so the event carries no `billing_account_id`.
  event("allowance_reached", {
    allowed: Schema.Int,
    meter: MeterSchema,
  }),
  // A Stripe subscription's state, as recorded: Stripe's status and the
  // billing interval are billing's vocabulary, tokens here. Beside it, the
  // workspace's plan now and the billing account's facts, as its groups
  // get them, so a workspace's latest state is a query over these events.
  event("subscription_changed", {
    ...billingAccountFacts,
    cancelAtPeriodEnd: Schema.Boolean,
    // Absent for a price this server no longer lists (a legacy one).
    interval: Schema.optionalKey(AnalyticsTokenSchema),
    plan: Schema.optionalKey(PaidPlanSchema),
    status: AnalyticsTokenSchema,
    subscriptionStatus: AnalyticsTokenSchema,
    workspacePlan: Schema.optionalKey(PlanSchema),
  }),
  event("channel_connected", {
    channelId: ChannelIdSchema,
    platform: ChannelPlatformSchema,
    reconnected: Schema.Boolean,
  }),
  event("channel_disconnected", {
    channelId: ChannelIdSchema,
    platform: ChannelPlatformSchema,
  }),
  // The channel's authorization stopped working, or ends soon and cannot
  // be renewed: nothing goes out there until someone reconnects it. Told
  // when it happens and with each daily reminder while it lasts, a week
  // at most: readers count channels, never events.
  event("channel_reconnect_needed", {
    channelId: ChannelIdSchema,
    platform: ChannelPlatformSchema,
  }),
  event("channel_expiring", {
    channelId: ChannelIdSchema,
    platform: ChannelPlatformSchema,
  }),
  // An article and its website, as posts and their channels above:
  // `siteStatus` is what the site made of it, `reason` Peal's own code.
  event("article_published", {
    articleId: Uuid7Schema,
    channelId: ChannelIdSchema,
    platform: Schema.optionalKey(SitePlatformSchema),
    siteStatus: Schema.Literals(["publish", "draft", "future"]),
  }),
  event("article_failed", {
    articleId: Uuid7Schema,
    channelId: ChannelIdSchema,
    platform: Schema.optionalKey(SitePlatformSchema),
    reason: AnalyticsTokenSchema,
  }),
  // An uploaded file Peal refused or could not probe, by its reason's
  // code. A probe tried again tells it again: readers take one per
  // `mediaId` and `reason`.
  event("media_failed", {
    mediaId: MediaAssetIdSchema,
    reason: AnalyticsTokenSchema,
  }),
  event("post_scheduled", {
    postId: PostIdSchema,
    targetCount: Schema.Int,
  }),
  event("post_published", {
    channelId: ChannelIdSchema,
    platform: Schema.optionalKey(PlatformSchema),
    postId: PostIdSchema,
    round: Schema.Int,
  }),
  event("post_failed", {
    channelId: ChannelIdSchema,
    platform: Schema.optionalKey(PlatformSchema),
    postId: PostIdSchema,
    reason: AnalyticsTokenSchema,
    round: Schema.Int,
  }),
]);

export type ProductEvent = typeof ProductEventSchema.Type;

/** The name of an event of the catalogue. */
export type ProductEventName = ProductEvent["name"];

/** A scalar a property may hold. */
export type SafeScalar = boolean | number | string;

const snakeCase = (key: string) =>
  key.replaceAll(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);

/** An event's own properties, under the names they are sent with. */
export const wireProperties = (
  productEvent: ProductEvent
): Readonly<Record<string, SafeScalar>> =>
  Object.fromEntries(
    Object.entries(productEvent.properties).map(([key, value]) => [
      snakeCase(key),
      value,
    ])
  );

/** Who an event is about: a person, or a workspace's service identity. */
export const AnalyticsSubjectSchema = Schema.Union([
  Schema.TaggedStruct("user", { userId: UserIdSchema }),
  Schema.TaggedStruct("workspace", { workspaceId: WorkspaceIdSchema }),
]);

export type AnalyticsSubject = typeof AnalyticsSubjectSchema.Type;

/** A person. */
export const userSubject = (userId: UserId): AnalyticsSubject => ({
  _tag: "user",
  userId,
});

/** A workspace's service identity: what a job or a key does there. */
export const workspaceSubject = (
  workspaceId: WorkspaceId
): AnalyticsSubject => ({ _tag: "workspace", workspaceId });

/** The id an event is sent under: the user's, or `workspace:<id>`. */
export const distinctIdOf = (subject: AnalyticsSubject): string =>
  subject._tag === "user" ? subject.userId : `workspace:${subject.workspaceId}`;

/**
 * PostHog's own properties Peal sets: no other, so neither an address
 * (`$ip`), a page (`$current_url`) nor a browser (`$user_agent`) is sent.
 */
export const postHogKeys: ReadonlySet<string> = new Set([
  "$geoip_disable",
  "$session_id",
  "$groups",
  "$set",
  "$set_once",
  "$group_type",
  "$group_key",
  "$group_set",
]);

// A key in snake_case, or one of PostHog's that Peal sets. (A record keyed
// by literals would require every one of them.)
/**
 * Words no key may hold, whatever its value: what would name or reach a
 * person (an address, a name, a phone, an IP), what someone wrote, or a
 * credential.
 */
export const refusedKeyWords: ReadonlySet<string> = new Set([
  "address",
  "content",
  "email",
  "ip",
  "mail",
  "message",
  "name",
  "password",
  "phone",
  "secret",
  "text",
  "token",
  "uri",
  "url",
]);

const holdsRefusedWord = (key: string) =>
  key.split(/[_$]/u).some((word) => refusedKeyWords.has(word));

const PropertyKeySchema = Schema.String.check(
  Schema.makeFilter(
    (key) =>
      (postHogKeys.has(key) || /^[a-z][a-z0-9_]*$/u.test(key)) &&
      !holdsRefusedWord(key),
    {
      expected:
        "a key in snake_case, or one of PostHog's Peal sets, naming no address, name or text",
    }
  )
);

/**
 * The person properties Peal sets, and no other: `kind` and `locale`
 * replaced (a service identity's `kind` set once, with each of its
 * events), `signed_up_at` and `signup_method` set once, `internal` for
 * staff.
 */
export const PersonPropertiesSchema = Schema.Struct({
  internal: Schema.optionalKey(Schema.Literal(true)),
  kind: Schema.optionalKey(Schema.Literals(["user", "service"])),
  locale: Schema.optionalKey(LocaleSchema),
  signed_up_at: Schema.optionalKey(AnalyticsTokenSchema),
  signup_method: Schema.optionalKey(SignUpMethodSchema),
});

/** The group properties Peal sets, and no other. */
export const GroupPropertiesSchema = Schema.Struct({
  billing_account_id: Schema.optionalKey(AnalyticsTokenSchema),
  created_at: Schema.optionalKey(AnalyticsTokenSchema),
  free_tier: Schema.optionalKey(Schema.Boolean),
  kind: Schema.optionalKey(BillingAccountKindSchema),
  plan: Schema.optionalKey(PlanSchema),
  standalone: Schema.optionalKey(Schema.Boolean),
  subscription_status: Schema.optionalKey(AnalyticsTokenSchema),
});

export type GroupPropertiesInput = typeof GroupPropertiesSchema.Type;

/**
 * What the alias event (`$create_alias`) carries beside what every event
 * does, and no other: the account's id, as PostHog's capture API takes it
 * (`distinct_id`), and the site's visitor it merges into it (`alias`), a
 * version 7 UUID as the site's SDK makes them, never an account's or a
 * workspace's id.
 */
export const AliasPropertiesSchema = Schema.Struct({
  alias: Uuid7Schema,
  distinct_id: UserIdSchema,
});

export type AliasPropertiesInput = typeof AliasPropertiesSchema.Encoded;

export type PersonPropertiesInput = typeof PersonPropertiesSchema.Type;

// Every declared key and no other: an undeclared one is refused, not left
// out.
const strictly = { onExcessProperty: "error" } as const;

const encodeEvent = Schema.encodeUnknownResult(ProductEventSchema, strictly);

const encodePerson = Schema.encodeUnknownResult(
  PersonPropertiesSchema,
  strictly
);

const encodeGroup = Schema.encodeUnknownResult(GroupPropertiesSchema, strictly);

/** Whether an event is one of the catalogue's, with only its own keys. */
export const isDeclaredEvent = (productEvent: ProductEvent): boolean =>
  encodeEvent(productEvent)._tag === "Success";

/** Whether person properties are only those Peal sets. */
export const isDeclaredPerson = (properties: PersonPropertiesInput): boolean =>
  encodePerson(properties)._tag === "Success";

/** Whether group properties are only those Peal sets. */
export const isDeclaredGroup = (properties: GroupPropertiesInput): boolean =>
  encodeGroup(properties)._tag === "Success";

const decodeAlias = Schema.decodeUnknownResult(AliasPropertiesSchema, strictly);

/** Whether an alias event's own properties are only those it may carry. */
export const isDeclaredAlias = (properties: AliasPropertiesInput): boolean =>
  decodeAlias(properties)._tag === "Success";

const ScalarSchema = Schema.Union([
  Schema.Boolean,
  Schema.Finite,
  AnalyticsTokenSchema,
]);

const isScalar = Schema.is(ScalarSchema);

/** The properties that hold an object of scalars, one level deep. */
export const nestingKeys: ReadonlySet<string> = new Set([
  "$groups",
  "$set",
  "$set_once",
  "$group_set",
]);

/**
 * What leaves the server for any event: keys in snake_case (`$` first for
 * PostHog's own), values a boolean, a finite number or an
 * `AnalyticsToken`, and, under `$groups`, `$set`, `$set_once` and
 * `$group_set` only, an object of such values. Every outgoing event is
 * checked against it.
 */
export const SafePropertiesSchema = Schema.Record(
  PropertyKeySchema,
  Schema.Union([ScalarSchema, Schema.Record(PropertyKeySchema, ScalarSchema)])
).check(
  Schema.makeFilter((properties) =>
    Object.entries(properties)
      .filter(([key, value]) => !nestingKeys.has(key) && !isScalar(value))
      .map(([key]) => ({ issue: "a scalar only", path: [key] }))
  )
);

export type SafeProperties = typeof SafePropertiesSchema.Type;

// A key the record's key does not take is an issue, not one left out.
const decodeSafe = Schema.decodeUnknownResult(SafePropertiesSchema, {
  onExcessProperty: "error",
});

const issuesOf = SchemaIssue.makeFormatterStandardSchemaV1();

/** A value as code could write it into an event, before it is checked. */
export type PropertyValue =
  | SafeScalar
  | null
  | readonly PropertyValue[]
  | { readonly [key: string]: PropertyValue };

/** An event's properties as built, before they are checked. */
export interface UncheckedProperties {
  readonly [key: string]: PropertyValue;
}

/**
 * The properties when they may leave, or the first key that may not:
 * never its value, which may be what must not leave.
 */
export const checkedProperties = (
  properties: UncheckedProperties
):
  | { readonly _tag: "safe"; readonly properties: SafeProperties }
  | { readonly _tag: "unsafe"; readonly key: string } => {
  const decoded = decodeSafe(properties);

  if (decoded._tag === "Success") {
    return { _tag: "safe", properties: decoded.success };
  }

  const [first] = issuesOf(decoded.failure.issue).issues;

  return {
    _tag: "unsafe",
    key: Option.fromNullishOr(first?.path?.[0]).pipe(
      Option.map(String),
      Option.getOrElse(() => "?")
    ),
  };
};

/** Whether these properties may leave, as `checkedProperties` decides. */
export const isSafeProperties = (properties: UncheckedProperties): boolean =>
  checkedProperties(properties)._tag === "safe";
