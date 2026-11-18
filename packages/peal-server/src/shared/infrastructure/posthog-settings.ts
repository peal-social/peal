import { Config, Option, Redacted, Schema, SchemaTransformation } from "effect";

import { UserIdSchema } from "#shared/domain/ids.ts";
import type { UserId } from "#shared/domain/ids.ts";
import { isProduction } from "#shared/infrastructure/environment.ts";

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
  /** Users nothing is ever sent about. */
  readonly excludedUsers: ReadonlySet<UserId>;
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
    Schema.Array(UserIdSchema),
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
 * - PEAL_POSTHOG_EXCLUDED_USERS: user ids, separated by commas, nothing is
 *   ever sent about (a person who objected).
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
            excludedUsers: Config.schema(
              ExcludedUsersSchema,
              "PEAL_POSTHOG_EXCLUDED_USERS"
            ).pipe(Config.withDefault<readonly UserId[]>([])),
            host: host("PEAL_POSTHOG_HOST", defaultPostHogHost),
          }).pipe(
            Config.map(({ excludedUsers, ...settings }) =>
              Option.some<PostHogSettings>({
                ...settings,
                excludedUsers: new Set(excludedUsers),
                key,
              })
            )
          ),
      })
    )
  );
