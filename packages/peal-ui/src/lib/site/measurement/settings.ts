import { Schema } from "effect";

import { originOf, present } from "../links";

// The site's, the docs' and the blog's measurement settings, read at build
// (site, docs) or when the server starts (blog). Off unless a project
// token and a host are both set, so a copy that sets neither measures
// nothing; a value that is set but wrong stops the build or the start.

/** What a surface measures with. */
export interface MeasurementSettings {
  /**
   * The parent domain the answer and the visitor cookie are set on, so
   * one answer covers the site, the docs and the blog; `undefined` for
   * host-only cookies.
   */
  readonly cookieDomain: string | undefined;
  /** Every event's `environment`: `production` unless set. */
  readonly environment: string;
  /** Where the SDK sends: a path on the same origin, or an https origin. */
  readonly host: string;
  /** The PostHog project's token, which browsers send. */
  readonly key: string;
}

const loopbackHostnames: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

// A path on the page's own origin, such as /pulse/site, or an https
// origin (http only on a loopback host), without credentials, query or
// fragment.
const isHost = (text: string): boolean => {
  if (text.startsWith("/")) {
    return /^(?:\/(?!\.{1,2}(?:\/|$))[A-Za-z0-9._-]+)+$/u.test(text);
  }

  const url = URL.parse(text);

  return (
    url !== null &&
    (url.protocol === "https:" ||
      (url.protocol === "http:" && loopbackHostnames.has(url.hostname))) &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === "" &&
    (url.pathname === "/" || url.pathname === "")
  );
};

const HostSchema = Schema.String.check(
  Schema.makeFilter(isHost, {
    expected:
      "a path on the same origin such as /pulse/site, or an https origin (http only on a loopback host)",
  })
);

// The project token, as the web app's relay takes it.
const KeySchema = Schema.String.check(
  Schema.isPattern(/^phc_[A-Za-z0-9]+$/u, {
    expected: "a project token, `phc_` then letters and digits",
  })
);

const DomainSchema = Schema.String.check(
  Schema.isPattern(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/u, {
    expected: "a host name such as example.com",
  })
);

const EnvironmentSchema = Schema.String.check(
  Schema.isPattern(/^[a-z0-9_-]{1,32}$/u, {
    expected: "a short lower-case name such as production",
  })
);

const decodeOrThrow =
  <S extends Schema.Decoder<string>>(schema: S, name: string) =>
  (value: string): S["Type"] => {
    try {
      return Schema.decodeUnknownSync(schema)(value);
    } catch (error) {
      throw new Error(`${name}: ${String(error)}`, { cause: error });
    }
  };

/**
 * The settings, or `undefined` while the key or the host is unset or
 * blank. A value that is set but malformed throws, naming the setting.
 */
export const measurementSettings = ({
  cookieDomain,
  environment,
  host,
  key,
  prefix,
}: {
  readonly cookieDomain?: string | undefined;
  readonly environment?: string | undefined;
  readonly host?: string | undefined;
  readonly key?: string | undefined;
  /** The settings' prefix, such as `SITE`, for the errors. */
  readonly prefix: string;
}): MeasurementSettings | undefined => {
  const presentKey = present(key);
  const presentHost = originOf(host);

  if (presentKey === undefined || presentHost === undefined) {
    return undefined;
  }

  const domain = present(cookieDomain)?.toLowerCase();

  return {
    cookieDomain:
      domain === undefined
        ? undefined
        : decodeOrThrow(
            DomainSchema,
            `${prefix}_POSTHOG_COOKIE_DOMAIN`
          )(domain),
    environment: decodeOrThrow(
      EnvironmentSchema,
      `${prefix}_POSTHOG_ENVIRONMENT`
    )(present(environment) ?? "production"),
    host: decodeOrThrow(HostSchema, `${prefix}_POSTHOG_HOST`)(presentHost),
    key: decodeOrThrow(KeySchema, `${prefix}_POSTHOG_KEY`)(presentKey),
  };
};
