import { Config, Effect, Option, Redacted } from "effect";

import { InvalidMetaSettings } from "./invalid-meta-settings.ts";

/** An app of Meta's developer dashboard: its id and its secret. */
export interface MetaApp {
  readonly appId: string;
  readonly appSecret: Redacted.Redacted;
}

const nonBlank = (name: string) =>
  Config.option(Config.String(name)).pipe(
    Config.map(Option.filter((value) => value.trim() !== ""))
  );

const nonBlankRedacted = (name: string) =>
  Config.option(Config.Redacted(name)).pipe(
    Config.map(Option.filter((value) => Redacted.value(value).trim() !== ""))
  );

const appIdPattern = /^\d{1,32}$/u;

// Both settings, or neither: one without the other is a mistake that would
// only show when a member tries to connect, so the server refuses to start.
const appConfig = (prefix: string) =>
  Effect.gen(function* readApp() {
    const appId = yield* nonBlank(`${prefix}_APP_ID`);
    const appSecret = yield* nonBlankRedacted(`${prefix}_APP_SECRET`);

    if (Option.isNone(appId) && Option.isNone(appSecret)) {
      return Option.none<MetaApp>();
    }

    if (Option.isNone(appId) || Option.isNone(appSecret)) {
      return yield* new InvalidMetaSettings({
        reason: `${prefix}_APP_ID and ${prefix}_APP_SECRET go together`,
      });
    }

    if (!appIdPattern.test(appId.value.trim())) {
      return yield* new InvalidMetaSettings({
        reason: `${prefix}_APP_ID is not an app id`,
      });
    }

    const app: MetaApp = {
      appId: appId.value.trim(),
      appSecret: appSecret.value,
    };

    return Option.some(app);
  });

/**
 * Meta's main app (`META_APP_ID`, `META_APP_SECRET`): Facebook Login, which
 * connects Facebook Pages and the Instagram professional accounts linked to
 * them. None when unset: the server then connects neither.
 */
export const metaAppConfig = appConfig("META");

/**
 * The app's Threads credentials (`THREADS_APP_ID`, `THREADS_APP_SECRET`),
 * which the dashboard's Threads use case gives apart from the main ones.
 * None when unset: the server then connects no Threads account.
 */
export const threadsAppConfig = appConfig("THREADS");

/**
 * The app's Instagram credentials (`INSTAGRAM_APP_ID`,
 * `INSTAGRAM_APP_SECRET`), which the dashboard's Instagram use case gives
 * apart from the main ones, for Business Login for Instagram. None when
 * unset: the server then connects Instagram accounts through Facebook Login
 * only, with Meta's main app.
 */
export const instagramAppConfig = appConfig("INSTAGRAM");

/** The fewest characters of META_WEBHOOK_VERIFY_TOKEN: too long to guess. */
export const minVerifyTokenLength = 32;

/**
 * `META_WEBHOOK_VERIFY_TOKEN`: what the operator types in Meta's dashboard
 * as the events' "Verify Token", which Meta sends back once to check the
 * callback address is the server's. None when unset or blank: the server
 * then takes no event of Meta's. Shorter than `minVerifyTokenLength`
 * characters, it stops the server.
 */
export const metaWebhookVerifyTokenConfig = Effect.gen(
  function* readVerifyToken() {
    const token = yield* nonBlankRedacted("META_WEBHOOK_VERIFY_TOKEN");

    if (
      Option.isSome(token) &&
      Redacted.value(token.value).trim().length < minVerifyTokenLength
    ) {
      return yield* new InvalidMetaSettings({
        reason: `META_WEBHOOK_VERIFY_TOKEN takes ${String(minVerifyTokenLength)} characters at least`,
      });
    }

    // Read as Meta's dashboard is given it: without the spaces around.
    return Option.map(token, (value) =>
      Redacted.make(Redacted.value(value).trim())
    );
  }
);

/**
 * Where Meta sends the events of one of its apps (`facebook`, the main
 * app's Pages and Instagram through a Page, or `instagram`, Instagram
 * Login's): a route outside the contract, as its body is read raw.
 */
export const metaEventsPath = "/api/platform-events/meta/:app";
