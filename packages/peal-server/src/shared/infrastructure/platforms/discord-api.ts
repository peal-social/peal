import { Duration, Effect, Option, Redacted, Schema } from "effect";
import { HttpClientResponse } from "effect/http";

// What the channels and publishing contexts share of Discord's webhooks
// (docs.discord.com/developers/resources/webhook, read 2026-11-16): where
// the API is, how a webhook's secret becomes its address, and how Discord's
// errors look.
//
// A webhook's token is in its address's path: whatever writes an outgoing
// request's address (an HTTP client's span keeps `url.full`, an HTTP
// client error's message the address) would keep it. So the address is
// built from the `Redacted` secret only as the request is made, the
// client's spans are off (`untraced`, `./public-http.ts`), and every HTTP client error is
// turned into a typed failure where it happens, before it can be logged
// or stored.

/** Where Discord's API is: `https://discord.com` in production. */
export interface DiscordHosts {
  readonly api: string;
}

export const discordHosts: DiscordHosts = { api: "https://discord.com" };

/**
 * The User-Agent Discord asks of API clients, "DiscordBot ($url,
 * $versionNumber)" (docs.discord.com/developers/reference, User Agent).
 */
export const discordUserAgent =
  "DiscordBot (https://github.com/peal-social/peal, 1.0)";

/**
 * A webhook's id and token, as the channel keeps them: `<id>/<token>`, the
 * token Redacted.
 */
export interface DiscordWebhook {
  readonly id: string;
  readonly token: Redacted.Redacted;
}

// An id is a snowflake, digits; a token Discord's URL-safe letters.
const webhookSecret = /^(?<id>\d{1,20})\/(?<token>[\w-]{1,256})$/u;

/** The webhook a channel's secret names, if it is one. */
export const webhookOf = (
  secret: Redacted.Redacted
): Option.Option<DiscordWebhook> => {
  const groups = webhookSecret.exec(Redacted.value(secret))?.groups;
  const id = groups?.["id"];
  const token = groups?.["token"];

  return id === undefined || token === undefined
    ? Option.none()
    : Option.some({ id, token: Redacted.make(token) });
};

// A webhook's address as Discord hands it out (a channel's settings,
// Integrations, Webhooks, "Copy Webhook URL"): `https://discord.com/api/
// webhooks/<id>/<token>`, on the older `discordapp.com` too, from the test
// builds (`canary.`, `ptb.`), with or without the API's version, scheme
// and host in any case. Every call still goes to Discord's API host. Nothing else: no user, port, query or other
// host, so the token never goes anywhere but Discord.
const webhookAddress =
  /^https:\/\/(?:(?:canary|ptb)\.)?(?:discord\.com|discordapp\.com)\/api(?:\/v\d{1,2})?\/webhooks\/(?<id>\d{1,20})\/(?<token>[\w-]{1,256})\/?$/iu;

/** The webhook an address a member pasted names, if it is one. */
export const webhookOfAddress = (
  address: Redacted.Redacted
): Option.Option<DiscordWebhook> => {
  const groups = webhookAddress.exec(Redacted.value(address).trim())?.groups;
  const id = groups?.["id"];
  const token = groups?.["token"];

  return id === undefined || token === undefined
    ? Option.none()
    : Option.some({ id, token: Redacted.make(token) });
};

/** The secret a channel keeps for a webhook: `<id>/<token>`. */
export const webhookSecretOf = (webhook: DiscordWebhook): Redacted.Redacted =>
  Redacted.make(`${webhook.id}/${Redacted.value(webhook.token)}`);

/**
 * The address of the webhook, or of `path` under it (`/messages/<id>`),
 * on API v10, with `query`. Built only as the request is made.
 */
export const webhookUrl = (
  hosts: DiscordHosts,
  webhook: DiscordWebhook,
  path = "",
  query: Readonly<Record<string, string>> = {}
): URL => {
  const url = new URL(
    `/api/v10/webhooks/${webhook.id}/${Redacted.value(webhook.token)}${path}`,
    hosts.api
  );

  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, value);
  }

  return url;
};

/**
 * Discord's JSON error codes Peal tells apart
 * (docs.discord.com/developers/topics/opcodes-and-status-codes).
 */
export const discordCodes = {
  // "Maximum number of attachments in a message reached (10)".
  attachmentsTooMany: 30_015,
  // "Message blocked by harmful links filter".
  blockedLinks: 240_000,
  // "Message was blocked by automatic moderation".
  blockedModeration: 200_000,
  // "Cannot send an empty message".
  emptyMessage: 50_006,
  // "File uploaded exceeds the maximum size".
  fileTooLarge: 50_045,
  // "Webhooks posted to forum channels must have a thread_name or
  // thread_id".
  forumNeedsThread: 220_001,
  // "Invalid webhook token provided".
  invalidWebhookToken: 50_027,
  // "Request entity too large. Try sending something smaller in size".
  requestTooLarge: 40_005,
  // "Webhooks can only create threads in forum channels".
  threadsOnlyInForums: 220_003,
  // "Unknown message".
  unknownMessage: 10_008,
  // "Unknown webhook".
  unknownWebhook: 10_015,
} as const;

/** An error as Discord answers one: `{ "code": 10015, "message": "…" }`. */
const DiscordErrorSchema = Schema.Struct({
  code: Schema.Int,
  message: Schema.String,
});

// A 429's body: "The number of seconds to wait before submitting another
// request", a float (docs.discord.com/developers/topics/rate-limits).
const RateLimitSchema = Schema.Struct({
  retry_after: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
});

/** Discord's own error code in the answer, if the answer is Discord's. */
export const discordCodeOf = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<Option.Option<number>> =>
  HttpClientResponse.schemaBodyJson(DiscordErrorSchema)(response).pipe(
    Effect.map(({ code }) => code),
    Effect.option
  );

/** How long a 429 asked to wait, from its body, if it says. */
export const discordRetryAfterOf = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<Option.Option<Duration.Duration>> =>
  HttpClientResponse.schemaBodyJson(RateLimitSchema)(response).pipe(
    Effect.map(({ retry_after: seconds }) =>
      Duration.millis(Math.ceil(seconds * 1000))
    ),
    Effect.option
  );

/**
 * Whether a refusal says the webhook is gone or its token is no longer
 * good: 10015 or 50027, on a 401, 403 or 404. Discord asks that such a
 * webhook is never called again ("If a webhook returns a 404 status you
 * should not attempt to use it again", the rate limits page).
 */
export const isWebhookGone = (status: number, code: Option.Option<number>) =>
  (status === 401 || status === 403 || status === 404) &&
  Option.exists(
    code,
    (found) =>
      found === discordCodes.unknownWebhook ||
      found === discordCodes.invalidWebhookToken
  );
