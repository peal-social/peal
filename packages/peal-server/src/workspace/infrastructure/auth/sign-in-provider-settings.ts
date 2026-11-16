import { Config, Option, Redacted, Schema } from "effect";

import { storableLine } from "#shared/domain/platform-text.ts";

/** An OAuth client the operator registered at a sign-in provider. */
export interface SignInProviderClient {
  readonly clientId: string;
  readonly clientSecret: Redacted.Redacted;
  /**
   * Google's only: another issuer than Google's, such as a fake in tests
   * (`GOOGLE_SIGN_IN_ISSUER`).
   */
  readonly issuer?: string;
}

/** The OpenID Connect provider a self-hoster chose, and its client there. */
export interface OidcProviderSettings extends SignInProviderClient {
  /** `<issuer>/.well-known/openid-configuration`. */
  readonly discoveryUrl: string;
  readonly issuer: string;
  /** What the sign-in and sign-up pages' button names it. */
  readonly name: string;
  readonly scopes: readonly string[];
}

/** The providers people may sign in with, besides their password. */
export interface SignInProviderSettings {
  readonly google: Option.Option<SignInProviderClient>;
  readonly oidc: Option.Option<OidcProviderSettings>;
}

/** The most characters the provider's name takes on its button. */
export const maxProviderNameLength = 40;

const defaultProviderName = "Single sign-on";

const defaultScopes = "openid email profile";

// A setting that is set: unset and blank both read as none.
const optionalString = (name: string) =>
  Config.option(Config.String(name)).pipe(
    Config.map(Option.map((value) => value.trim())),
    Config.map(Option.filter((value) => value !== ""))
  );

const requiredString = (name: string) =>
  Config.schema(Schema.Trim.check(Schema.isNonEmpty()), name);

const requiredSecret = (name: string) =>
  Config.schema(Schema.Redacted(Schema.NonEmptyString), name).pipe(
    Config.map((secret) => Redacted.make(Redacted.value(secret).trim()))
  );

const loopbackHostnames: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

const parsedUrl = (text: string): URL | undefined => {
  try {
    return new URL(text);
  } catch {
    return undefined;
  }
};

// An issuer is an https URL with no query or fragment (OpenID Connect
// Discovery 1.0, section 3), plain http only on a loopback host, for tests
// and trials on one machine.
const isIssuer = (text: string): boolean => {
  const url = parsedUrl(text);

  return (
    url !== undefined &&
    (url.protocol === "https:" ||
      (url.protocol === "http:" && loopbackHostnames.has(url.hostname))) &&
    url.username === "" &&
    url.password === "" &&
    url.search === "" &&
    url.hash === "" &&
    !text.includes("?") &&
    !text.includes("#")
  );
};

const IssuerSchema = Schema.Trim.check(
  Schema.makeFilter(isIssuer, {
    expected:
      "an https URL without a query or fragment (http only on a loopback host)",
  })
);

// Tests' alone: a fake Google on this machine. Any other issuer behind
// "Continue with Google" would vouch for Gmail addresses, and Google's
// identities are kept by subject alone.
const LoopbackIssuerSchema = IssuerSchema.check(
  Schema.makeFilter(
    (text: string) => {
      const url = parsedUrl(text);

      return url !== undefined && url.protocol === "http:";
    },
    { expected: "an http URL on a loopback host, for tests" }
  )
);

const isStorableName = (name: string): boolean =>
  name.length <= maxProviderNameLength &&
  storableLine(name, maxProviderNameLength) === name;

const ProviderNameSchema = Schema.Trim.check(
  Schema.isNonEmpty(),
  Schema.makeFilter(isStorableName, {
    expected: `a name on one line, ${String(maxProviderNameLength)} characters at most, without control characters`,
  })
);

const scopeList = (text: string): readonly string[] => [
  ...new Set(text.split(/\s+/u).filter((scope) => scope !== "")),
];

const ScopesSchema = Schema.String.check(
  Schema.makeFilter(
    (text: string) => {
      const scopes = scopeList(text);

      return scopes.includes("openid") && scopes.includes("email");
    },
    { expected: "space-separated scopes, openid and email among them" }
  )
);

const googleConfig = Config.all({
  clientId: optionalString("GOOGLE_SIGN_IN_CLIENT_ID"),
  clientSecret: optionalString("GOOGLE_SIGN_IN_CLIENT_SECRET"),
}).pipe(
  Config.flatMap(({ clientId, clientSecret }) =>
    Option.isNone(clientId) && Option.isNone(clientSecret)
      ? Config.succeed(Option.none<SignInProviderClient>())
      : Config.all({
          clientId: requiredString("GOOGLE_SIGN_IN_CLIENT_ID"),
          clientSecret: requiredSecret("GOOGLE_SIGN_IN_CLIENT_SECRET"),
          issuer: Config.option(
            Config.schema(LoopbackIssuerSchema, "GOOGLE_SIGN_IN_ISSUER")
          ),
        }).pipe(
          Config.map(({ issuer, ...client }) =>
            Option.some<SignInProviderClient>(
              Option.match(issuer, {
                onNone: () => client,
                onSome: (other) => ({
                  ...client,
                  issuer: other.replace(/\/+$/u, ""),
                }),
              })
            )
          )
        )
  )
);

const oidcNames = [
  "PEAL_OIDC_ISSUER",
  "PEAL_OIDC_CLIENT_ID",
  "PEAL_OIDC_CLIENT_SECRET",
  "PEAL_OIDC_NAME",
  "PEAL_OIDC_SCOPES",
] as const;

const discoveryUrlOf = (issuer: string): string =>
  `${issuer.replace(/\/+$/u, "")}/.well-known/openid-configuration`;

const oidcConfig = Config.all(oidcNames.map(optionalString)).pipe(
  Config.flatMap((given) =>
    given.every(Option.isNone)
      ? Config.succeed(Option.none<OidcProviderSettings>())
      : Config.all({
          // The issuer first: a stray name or scope list says it is missing.
          issuer: Config.schema(IssuerSchema, "PEAL_OIDC_ISSUER"),
          clientId: requiredString("PEAL_OIDC_CLIENT_ID"),
          clientSecret: requiredSecret("PEAL_OIDC_CLIENT_SECRET"),
          name: Config.schema(ProviderNameSchema, "PEAL_OIDC_NAME").pipe(
            Config.withDefault(defaultProviderName)
          ),
          scopes: Config.schema(ScopesSchema, "PEAL_OIDC_SCOPES").pipe(
            Config.withDefault(defaultScopes),
            Config.map(scopeList)
          ),
        }).pipe(
          Config.map(({ issuer, ...rest }) =>
            Option.some<OidcProviderSettings>({
              ...rest,
              discoveryUrl: discoveryUrlOf(issuer),
              issuer,
            })
          )
        )
  )
);

/**
 * The sign-in providers, read when the server starts:
 *
 * | Variable                                                 | Default                |
 * | -------------------------------------------------------- | ---------------------- |
 * | `GOOGLE_SIGN_IN_CLIENT_ID`, `GOOGLE_SIGN_IN_CLIENT_SECRET` | none: no Google      |
 * | `PEAL_OIDC_ISSUER`, `PEAL_OIDC_CLIENT_ID`, `PEAL_OIDC_CLIENT_SECRET` | none: no provider |
 * | `PEAL_OIDC_NAME`                                         | `Single sign-on`       |
 * | `PEAL_OIDC_SCOPES`                                       | `openid email profile` |
 *
 * Each group is all or nothing: one of its settings without the others
 * stops the server, as a malformed issuer, name or scope list does.
 */
export const signInProvidersConfig = Config.all({
  google: googleConfig,
  oidc: oidcConfig,
});

/** Whether the server offers any provider. */
export const offersProviders = (settings: SignInProviderSettings): boolean =>
  Option.isSome(settings.google) || Option.isSome(settings.oidc);
