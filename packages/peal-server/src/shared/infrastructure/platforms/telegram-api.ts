import { Duration, Effect, Option, Redacted, Schema } from "effect";
import { HttpClientResponse } from "effect/http";

// What the channels and publishing contexts share of Telegram's Bot API
// (core.telegram.org/bots/api, Bot API 10.4, read 2026-11-16): where it is,
// how a bot's token becomes a method's address, and how its answers look.
//
// "All queries to the Telegram Bot API must be served over HTTPS and need
// to be presented in this form: https://api.telegram.org/bot<token>/
// METHOD_NAME": the bot's token is in the path. Whatever writes an
// outgoing request's address would keep it, so the address is built from
// the Redacted token only as the request is made, the client makes no
// span (`untraced`, `./public-http.ts`), and every HTTP client error is
// turned into a typed failure where it happens.
//
// Answers are `{ ok, result }`, or `{ ok: false, error_code, description,
// parameters }`. The page documents no error's description ("a
// human-readable description of the result"), and says "its contents are
// subject to change" of `error_code`: Peal decides on `error_code` and
// `parameters` (`retry_after`, `migrate_to_chat_id`), never on words.

/** Where Telegram's Bot API is: `https://api.telegram.org` in production. */
export interface TelegramHosts {
  readonly api: string;
}

export const telegramHosts: TelegramHosts = {
  api: "https://api.telegram.org",
};

/** The address of a Bot API method for the bot, built as it is called. */
export const telegramMethodUrl = (
  hosts: TelegramHosts,
  token: Redacted.Redacted,
  method: string
): URL => new URL(`/bot${Redacted.value(token)}/${method}`, hosts.api);

// "The group has been migrated to a supergroup with the specified
// identifier", and "In case of exceeding flood control, the number of
// seconds left to wait before the request can be repeated".
const ResponseParametersSchema = Schema.Struct({
  migrate_to_chat_id: Schema.optionalKey(Schema.Int),
  retry_after: Schema.optionalKey(Schema.Int),
});

const TelegramErrorSchema = Schema.Struct({
  error_code: Schema.Int,
  ok: Schema.Literal(false),
  parameters: Schema.optionalKey(ResponseParametersSchema),
});

/** A refusal as Telegram answers one: its code and its parameters. */
export interface TelegramError {
  readonly code: number;
  /** The supergroup a group became, by its new id. */
  readonly migratedTo: Option.Option<number>;
  readonly retryAfter: Option.Option<Duration.Duration>;
}

/** Telegram's own refusal in the answer, if the answer is Telegram's. */
export const telegramErrorOf = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<Option.Option<TelegramError>> =>
  HttpClientResponse.schemaBodyJson(TelegramErrorSchema)(response).pipe(
    Effect.map(({ error_code: code, parameters }): TelegramError => ({
      code,
      migratedTo: Option.fromUndefinedOr(parameters?.migrate_to_chat_id),
      retryAfter: Option.fromUndefinedOr(parameters?.retry_after).pipe(
        Option.map((seconds) => Duration.seconds(seconds))
      ),
    })),
    Effect.option
  );

/** A successful answer's `result`, read with `schema`. */
export const telegramResult = <A, I>(schema: Schema.Codec<A, I>) =>
  HttpClientResponse.schemaBodyJson(
    Schema.Struct({ ok: Schema.Literal(true), result: schema })
  );

/** Whether the token is one a bot of Telegram's could have. */
export const isBotToken = (token: string): boolean =>
  /^\d{1,20}:[\w-]{1,100}$/u.test(token);
