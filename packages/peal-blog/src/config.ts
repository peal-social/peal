import { Schema } from "effect";
import {
  originOf,
  plausibleScript,
  present,
  siteLink,
} from "peal-ui/lib/site/links";
import type { PlausibleScript } from "peal-ui/lib/site/links";
import type { Locale } from "peal-ui/lib/site/locales";
import { measurementSettings } from "peal-ui/lib/site/measurement/settings";
import type { MeasurementSettings } from "peal-ui/lib/site/measurement/settings";

// The blog's own settings, read from the environment when the server
// starts (the image carries none). Each is optional: unset or empty turns
// its feature off, as the site's SITE_* settings do at its build.

const SettingsSchema = Schema.Struct({
  BLOG_APP_URL: Schema.optional(Schema.String),
  BLOG_DISCORD_URL: Schema.optional(Schema.String),
  BLOG_DOCS_URL: Schema.optional(Schema.String),
  BLOG_PLAUSIBLE_DOMAIN: Schema.optional(Schema.String),
  BLOG_PLAUSIBLE_HOST: Schema.optional(Schema.String),
  BLOG_POSTHOG_COOKIE_DOMAIN: Schema.optional(Schema.String),
  BLOG_POSTHOG_ENVIRONMENT: Schema.optional(Schema.String),
  BLOG_POSTHOG_HOST: Schema.optional(Schema.String),
  BLOG_POSTHOG_KEY: Schema.optional(Schema.String),
  BLOG_SITE_URL: Schema.optional(Schema.String),
});

export interface BlogSettings {
  /** A page of the web app in a language, when BLOG_APP_URL is set. */
  readonly app: (locale: Locale, path: string) => string | undefined;
  /** The Discord server's invitation, when BLOG_DISCORD_URL is set. */
  readonly discord: string | undefined;
  /** A page of the docs in a language, when BLOG_DOCS_URL is set. */
  readonly docs: (locale: Locale, path: string) => string | undefined;
  /**
   * Measurement with PostHog and its consent notice, as the site has them,
   * when BLOG_POSTHOG_KEY and BLOG_POSTHOG_HOST are both set.
   */
  readonly measurement: MeasurementSettings | undefined;
  readonly plausible: PlausibleScript | undefined;
  /**
   * The site's origin, such as https://peal.social, for the links to its
   * pages and its icons: "" (the same origin) when BLOG_SITE_URL is unset.
   */
  readonly site: string;
}

export type BlogEnvironment = typeof SettingsSchema.Type;

/** The blog's variables in an environment, such as `process.env`. */
export const blogEnvironment = (
  env: Readonly<Record<string, string | undefined>>
): BlogEnvironment =>
  Schema.decodeUnknownSync(SettingsSchema)(env, {
    onExcessProperty: "ignore",
  });

/** The settings the blog's variables give. */
export const blogSettings = (values: BlogEnvironment): BlogSettings => {
  const app = originOf(values.BLOG_APP_URL);
  const docs = originOf(values.BLOG_DOCS_URL);

  return {
    app: (locale, path) => siteLink(app, locale, path),
    discord: present(values.BLOG_DISCORD_URL),
    docs: (locale, path) => siteLink(docs, locale, path),
    measurement: measurementSettings({
      cookieDomain: values.BLOG_POSTHOG_COOKIE_DOMAIN,
      environment: values.BLOG_POSTHOG_ENVIRONMENT,
      host: values.BLOG_POSTHOG_HOST,
      key: values.BLOG_POSTHOG_KEY,
      prefix: "BLOG",
    }),
    plausible: plausibleScript(
      values.BLOG_PLAUSIBLE_DOMAIN,
      values.BLOG_PLAUSIBLE_HOST
    ),
    site: originOf(values.BLOG_SITE_URL) ?? "",
  };
};

let settings: BlogSettings | undefined;

/** The server's settings, read from its environment once. */
export const serverSettings = (): BlogSettings => {
  settings ??= blogSettings(blogEnvironment(process.env));

  return settings;
};
