import { Config, Option, Redacted, Schema, SchemaTransformation } from "effect";

import { isProduction } from "#shared/infrastructure/environment.ts";

// Users and workspaces are both Better Auth's lowercase UUIDs.
const ExcludedIdSchema = Schema.String.check(
  Schema.isUUID(),
  Schema.isLowercased()
);

/** Where PostHog's EU Cloud takes events. */
export const defaultPostHogHost = "https://eu.i.posthog.com";

/** Where PostHog's EU Cloud deletes persons. */
export const defaultPostHogAppHost = "https://eu.posthog.com";

/** What deleting persons at PostHog needs: off without it. */
export interface PostHogErasure {
  /** The project's numeric id. */
  readonly projectId: string;
  /** A personal API key with the scope `person:write` on the project. */
  readonly personalKey: Redacted.Redacted;
  /** Where persons are deleted, without a trailing slash. */
  readonly appHost: string;
}

/** Product analytics, sent to a PostHog project. */
export interface PostHogSettings {
  /** The project token (`phc_…`). */
  readonly key: Redacted.Redacted;
  /** Where events go, without a trailing slash. */
  readonly host: string;
  /** The `environment` property of every event. */
  readonly environment: string;
  readonly erasure: Option.Option<PostHogErasure>;
  /** Users and workspaces nothing is ever sent about, by id. */
  readonly excluded: ReadonlySet<string>;
  /** Whether the web app measures its use too (PEAL_POSTHOG_WEB). */
  readonly web: boolean;
  /**
   * Whether a sign-up links the site's visitor to the new account
   * (PEAL_POSTHOG_SITE), and where the visitor's cookie is set.
   */
  readonly site: Option.Option<PostHogSite>;
}

/** The site's measurement, as a sign-up links its visitor. */
export interface PostHogSite {
  /**
   * The parent domain the site's visitor cookie is set on
   * (PEAL_POSTHOG_SITE_COOKIE_DOMAIN), where a sign-up expires it: none
   * for a cookie of the host alone.
   */
  readonly cookieDomain: Option.Option<string>;
}

// A setting that is set: unset and empty both read as none.
const optionalSecret = (name: string) =>
  Config.option(Config.String(name)).pipe(
    Config.map(
      Option.flatMap((value) =>
        value.trim() === "" ? Option.none() : Option.some(value.trim())
      )
    ),
    Config.map(Option.map((value) => Redacted.make(value)))
  );

const loopbackHostnames: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

// https, or http on this machine (tests, a local instance), with no
// credentials, query or fragment.
const isHost = (text: string): boolean => {
  const url = URL.parse(text);

  return (
    url !== null &&
    (url.protocol === "https:" ||
      (url.protocol === "http:" && loopbackHostnames.has(url.hostname))) &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === ""
  );
};

const HostSchema = Schema.Trim.check(
  Schema.makeFilter(isHost, {
    expected:
      "an https URL without a query or fragment (http only on a loopback host)",
  })
);

const host = (name: string, byDefault: string) =>
  Config.schema(HostSchema, name).pipe(
    Config.withDefault(byDefault),
    Config.map((url) => url.replace(/\/+$/u, ""))
  );

const EnvironmentSchema = Schema.String.check(
  Schema.isPattern(/^[a-z][a-z0-9-]{0,31}$/u, {
    expected: "1 to 32 lowercase letters, digits and dashes, a letter first",
  })
);

const ProjectIdSchema = Schema.String.check(
  Schema.isPattern(/^\d{1,20}$/u, { expected: "the project's numeric id" })
);

const ExcludedUsersSchema = Schema.String.pipe(
  Schema.decodeTo(
    Schema.Array(ExcludedIdSchema),
    SchemaTransformation.transform({
      decode: (value: string): readonly string[] =>
        value
          .split(",")
          .map((id) => id.trim())
          .filter((id) => id !== ""),
      encode: (ids: readonly string[]) => ids.join(","),
    })
  )
);

// `on` or `off`, `off` by default: anything else stops the server.
const webConfig = Config.schema(
  Schema.Literals(["on", "off"]),
  "PEAL_POSTHOG_WEB"
).pipe(
  Config.withDefault<"off" | "on">("off"),
  Config.map((value) => value === "on")
);

// A host name, lowercase, with at least one dot: what a cookie's Domain
// takes, and nothing that would add an attribute.
const CookieDomainSchema = Schema.Trim.check(
  Schema.isPattern(
    /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/u,
    { expected: "a host name, such as peal.example.com" }
  )
);

// Unset or empty: a cookie of the host alone.
const cookieDomainConfig = Config.option(
  Config.String("PEAL_POSTHOG_SITE_COOKIE_DOMAIN")
).pipe(
  Config.flatMap((domain) =>
    Option.isSome(domain) && domain.value.trim() !== ""
      ? Config.schema(
          CookieDomainSchema,
          "PEAL_POSTHOG_SITE_COOKIE_DOMAIN"
        ).pipe(Config.map(Option.some))
      : Config.succeed(Option.none<string>())
  )
);

// `on` or `off`, `off` by default, and, when on, the cookie's domain.
const siteConfig = Config.schema(
  Schema.Literals(["on", "off"]),
  "PEAL_POSTHOG_SITE"
).pipe(
  Config.withDefault<"off" | "on">("off"),
  Config.flatMap((value) =>
    value === "on"
      ? cookieDomainConfig.pipe(
          Config.map((cookieDomain) =>
            Option.some<PostHogSite>({ cookieDomain })
          )
        )
      : Config.succeed(Option.none<PostHogSite>())
  )
);

// The web app sends the token from the browser: only a project token
// (`phc_…`), public by design, may go there, never a personal key.
const ProjectTokenSchema = Schema.Trim.check(
  Schema.isPattern(/^phc_[A-Za-z0-9]+$/u, {
    expected: "a project token, `phc_` then letters and digits",
  })
);

const environmentConfig = isProduction.pipe(
  Config.flatMap((production) =>
    Config.schema(EnvironmentSchema, "PEAL_POSTHOG_ENVIRONMENT").pipe(
      Config.withDefault(production ? "production" : "development")
    )
  )
);

// The personal key and the project's id go together: one without the
// other stops the server.
const erasureConfig = Config.all({
  personalKey: optionalSecret("PEAL_POSTHOG_PERSONAL_API_KEY"),
  projectId: Config.option(
    Config.schema(ProjectIdSchema, "PEAL_POSTHOG_PROJECT_ID")
  ),
}).pipe(
  Config.flatMap(({ personalKey, projectId }) => {
    if (Option.isSome(personalKey) && Option.isSome(projectId)) {
      return host("PEAL_POSTHOG_APP_HOST", defaultPostHogAppHost).pipe(
        Config.map((appHost) =>
          Option.some<PostHogErasure>({
            appHost,
            personalKey: personalKey.value,
            projectId: projectId.value,
          })
        )
      );
    }

    if (Option.isSome(personalKey)) {
      return Config.schema(ProjectIdSchema, "PEAL_POSTHOG_PROJECT_ID").pipe(
        Config.map(() => Option.none<PostHogErasure>())
      );
    }

    if (Option.isSome(projectId)) {
      return Config.NonEmptyString("PEAL_POSTHOG_PERSONAL_API_KEY").pipe(
        Config.map(() => Option.none<PostHogErasure>())
      );
    }

    return Config.succeed(Option.none<PostHogErasure>());
  })
);

/**
 * Product analytics, when PEAL_POSTHOG_KEY is set; off, and nothing else
 * read, when it is unset or empty:
 *
 * - PEAL_POSTHOG_KEY: the project token (`phc_…`).
 * - PEAL_POSTHOG_HOST: where events go, `https://eu.i.posthog.com` by
 *   default; https, or http on a loopback host.
 * - PEAL_POSTHOG_ENVIRONMENT: the `environment` of every event,
 *   `production` under NODE_ENV=production, `development` otherwise.
 * - PEAL_POSTHOG_PERSONAL_API_KEY and PEAL_POSTHOG_PROJECT_ID, together: a
 *   personal API key with `person:write` and the project's numeric id, so
 *   closing an account deletes its persons at PostHog. Without them,
 *   each erasure is logged for the operator to delete by hand.
 * - PEAL_POSTHOG_APP_HOST: where persons are deleted,
 *   `https://eu.posthog.com` by default.
 * - PEAL_POSTHOG_EXCLUDED_IDS: user and workspace ids, separated by
 *   commas: nothing is sent about an excluded user, nor about an excluded
 *   workspace, its service identity included, whoever acts in it.
 * - PEAL_POSTHOG_WEB: `on` or `off` (the default): whether the web app
 *   measures its use too, in the browser, asking each person before
 *   anything is linked to their account or recorded; it then requires a
 *   project token (`phc_…`), which browsers send. A switch of its own,
 *   as measuring browsers needs the privacy policy to say so first.
 * - PEAL_POSTHOG_SITE: `on` or `off` (the default): whether a sign-up
 *   links the visitor that the site, the docs and the blog followed, once
 *   they allowed it, to the new account, then expires the visitor's
 *   cookie; it then requires a project token, which names that cookie.
 * - PEAL_POSTHOG_SITE_COOKIE_DOMAIN: the parent domain that cookie is set
 *   on, such as `peal.example.com`, where a sign-up expires it; unset for
 *   a cookie of the host alone.
 */
export const postHogConfig: Config.Config<Option.Option<PostHogSettings>> =
  optionalSecret("PEAL_POSTHOG_KEY").pipe(
    Config.flatMap(
      Option.match({
        onNone: () => Config.succeed(Option.none<PostHogSettings>()),
        onSome: (key) =>
          Config.all({
            environment: environmentConfig,
            erasure: erasureConfig,
            excluded: Config.schema(
              ExcludedUsersSchema,
              "PEAL_POSTHOG_EXCLUDED_IDS"
            ).pipe(Config.withDefault<readonly string[]>([])),
            host: host("PEAL_POSTHOG_HOST", defaultPostHogHost),
            site: siteConfig,
            web: webConfig,
          }).pipe(
            Config.flatMap((settings) =>
              settings.web || Option.isSome(settings.site)
                ? Config.schema(ProjectTokenSchema, "PEAL_POSTHOG_KEY").pipe(
                    Config.map(() => settings)
                  )
                : Config.succeed(settings)
            ),
            Config.map(({ excluded, ...settings }) =>
              Option.some<PostHogSettings>({
                ...settings,
                excluded: new Set(excluded),
                key,
              })
            )
          ),
      })
    )
  );
