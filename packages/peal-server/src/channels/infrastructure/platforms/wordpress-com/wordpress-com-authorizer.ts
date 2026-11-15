import { Effect, Option, Redacted, Schema } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";
import type { HttpClient, HttpClientError } from "effect/http";

import { AuthorizationFailed } from "#channels/application/authorization-failed.ts";
import type { SiteAuthorizer } from "#channels/application/site-authorizer.ts";
import { SiteRefused } from "#channels/application/site-refused.ts";
import type { VerifiedSite } from "#channels/application/site-verifier.ts";
import { AvatarUrlSchema } from "#channels/domain/avatar-url.ts";
import type { OAuthClient } from "#channels/infrastructure/platforms/oauth-client.ts";
import { randomTexts } from "#channels/infrastructure/platforms/oauth-exchange.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import type { WordPressComHosts } from "#shared/infrastructure/platforms/wordpress-api.ts";

/** Where WordPress.com sends members back: the web app's page. */
export const wordpressComCallbackPath = "/connect/wordpress-com/callback";

type Http = HttpClient.HttpClient.With<
  HttpClientError.HttpClientError | OutboundRequestRefused
>;

// The token's answer (developer.wordpress.com/docs/api/oauth2): the
// token, and the one site it opens.
const TokenSchema = Schema.Struct({
  access_token: Schema.String,
  blog_id: Schema.Union([Schema.Number, Schema.String]),
  blog_url: Schema.optionalKey(Schema.String),
});

// The site as `GET /rest/v1.1/sites/{id}` describes it to the member.
const SiteSchema = Schema.Struct({
  ID: Schema.Number,
  URL: Schema.String,
  capabilities: Schema.optionalKey(
    Schema.Struct({
      publish_posts: Schema.optionalKey(Schema.Boolean),
      upload_files: Schema.optionalKey(Schema.Boolean),
    })
  ),
  icon: Schema.optionalKey(
    Schema.NullOr(Schema.Struct({ img: Schema.optionalKey(Schema.String) }))
  ),
  name: Schema.optionalKey(Schema.String),
});

const decodeAvatar = Schema.decodeUnknownOption(AvatarUrlSchema);

// The site's home without its scheme or the slash that ends it, as a
// self-hosted site's is.
const handleOf = (home: string) => {
  const url = URL.parse(home);

  return url === null
    ? home
    : `${url.host}${url.pathname.replace(/\/+$/u, "")}`;
};

// A call that did not go through, or an answer that did not read, is
// WordPress.com unavailable.
const reached = <A>(effect: Effect.Effect<A, unknown>) =>
  effect.pipe(Effect.mapError(() => new PlatformUnavailable()));

/**
 * WordPress.com's sign-in, for its sites and the Jetpack sites a member
 * reaches there: OAuth 2.0's authorization code flow on
 * `public-api.wordpress.com` with the operator's app, no `scope`, so the
 * token opens the one site the member picks (WordPress.com's default),
 * and is the bearer token of that site's calls. The site must let the
 * member publish posts and upload files. WordPress.com documents neither
 * an expiry nor a refresh for these tokens: one it refuses marks the
 * channel to reconnect.
 */
export const wordpressComAuthorizer = Effect.fn("WordPressComAuthorizer.make")(
  function* wordpressComAuthorizer(options: {
    readonly client: OAuthClient;
    readonly hosts: WordPressComHosts;
    readonly http: Http;
    readonly publicUrl: string;
  }) {
    const { client, hosts, http } = options;

    const redirectUri = new URL(wordpressComCallbackPath, options.publicUrl)
      .href;

    const randomText = yield* randomTexts;

    const begin = Effect.gen(function* beginning() {
      const state = yield* randomText.pipe(Effect.orDie);
      const url = new URL("/oauth2/authorize", hosts.api);

      url.search = new URLSearchParams({
        client_id: client.clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        state,
      }).toString();

      return { authorizationUrl: url.href, state };
    });

    const complete = Effect.fn("WordPressComAuthorizer.complete")(
      function* complete(code: string) {
        const exchanged = yield* reached(
          http.execute(
            HttpClientRequest.post(new URL("/oauth2/token", hosts.api)).pipe(
              HttpClientRequest.acceptJson,
              HttpClientRequest.bodyUrlParams({
                client_id: client.clientId,
                client_secret: Redacted.value(client.clientSecret),
                code,
                grant_type: "authorization_code",
                redirect_uri: redirectUri,
              })
            )
          )
        );

        if (exchanged.status >= 500 || exchanged.status === 429) {
          return yield* new PlatformUnavailable();
        }

        if (exchanged.status !== 200) {
          return yield* new AuthorizationFailed({
            reason: `the token exchange answered ${exchanged.status}`,
          });
        }

        const token = yield* reached(
          HttpClientResponse.schemaBodyJson(TokenSchema)(exchanged)
        );

        const accessToken = Redacted.make(token.access_token);

        const described = yield* reached(
          http.execute(
            HttpClientRequest.get(
              new URL(
                `/rest/v1.1/sites/${encodeURIComponent(String(token.blog_id))}`,
                hosts.api
              )
            ).pipe(
              HttpClientRequest.bearerToken(accessToken),
              HttpClientRequest.acceptJson
            )
          )
        );

        if (described.status !== 200) {
          return yield* new PlatformUnavailable();
        }

        const site = yield* reached(
          HttpClientResponse.schemaBodyJson(SiteSchema)(described)
        );

        const may = site.capabilities ?? {};

        if (may.publish_posts !== true || may.upload_files !== true) {
          return yield* new SiteRefused({ reason: "cannotPublish" });
        }

        const verified: VerifiedSite = {
          accountId: String(site.ID),
          avatarUrl: Option.fromNullishOr(site.icon?.img).pipe(
            Option.flatMap(decodeAvatar)
          ),
          displayName: Option.fromNullishOr(site.name).pipe(
            Option.filter((name) => name.trim() !== "")
          ),
          handle: handleOf(site.URL),
          scopes: ["publish_posts", "upload_files"],
        };

        return { accessToken, site: verified };
      }
    );

    const authorizer: SiteAuthorizer = {
      begin,
      complete,
      platform: "wordpressCom",
    };

    return authorizer;
  }
);
