import type { Option } from "effect";
import { Effect, Redacted, Schema } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";

import type { SitePlatform } from "#shared/domain/platform.ts";

// What the channels and publishing contexts share of WordPress's REST API
// (developer.wordpress.org/rest-api): how a route is written under the
// root discovery found, how an application password is sent, and how the
// site's own errors look.

/**
 * The address of `route` (such as `/wp/v2/posts`) under the API's root,
 * with `query`. A site with pretty permalinks serves its root as
 * `…/wp-json/` and routes below it; one without names the route in the
 * `rest_route` parameter (`…/?rest_route=/`), which discovery says, so
 * both forms are kept as the root has them.
 */
export const routeUrl = (
  root: string,
  route: string,
  query: Readonly<Record<string, string>> = {}
): URL => {
  const url = new URL(root);
  const restRoute = url.searchParams.get("rest_route");
  const relative = route.replace(/^\/+/u, "");

  if (restRoute === null) {
    url.pathname = `${url.pathname.replace(/\/*$/u, "/")}${relative}`;
  } else {
    url.searchParams.set(
      "rest_route",
      `${restRoute.replace(/\/*$/u, "/")}${relative}`
    );
  }

  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, value);
  }

  return url;
};

/**
 * Signs a request with the site's credential, kept as `user:password`: an
 * application password goes as HTTP Basic authentication (RFC 7617),
 * which WordPress takes over HTTPS only.
 */
export const withSiteCredential =
  (credential: Redacted.Redacted) =>
  (request: HttpClientRequest.HttpClientRequest) => {
    const written = Redacted.value(credential);
    const colon = written.indexOf(":");

    return request.pipe(
      HttpClientRequest.basicAuth(
        written.slice(0, colon),
        Redacted.make(written.slice(colon + 1))
      ),
      HttpClientRequest.acceptJson
    );
  };

/** An error as WordPress's REST API answers one. */
export const WordPressErrorSchema = Schema.Struct({
  code: Schema.String,
  message: Schema.optionalKey(Schema.String),
});

export type WordPressError = typeof WordPressErrorSchema.Type;

/**
 * The site's own error in the answer, if it is one: only then is a 401 or
 * a 403 the site refusing the credential, rather than a proxy or a
 * security layer in front of it.
 */
export const wordpressErrorOf = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<Option.Option<WordPressError>> =>
  HttpClientResponse.schemaBodyJson(WordPressErrorSchema)(response).pipe(
    Effect.option
  );

/** The namespace of the core endpoints Peal calls. */
export const coreNamespace = "wp/v2";

/**
 * Where WordPress.com's API is: its sites' core routes are served under
 * `/wp/v2/sites/{site id}/` (developer.wordpress.com/docs/api), with the
 * OAuth token a member gave Peal as a bearer token.
 */
export interface WordPressComHosts {
  readonly api: string;
}

export const wordpressComHosts: WordPressComHosts = {
  api: "https://public-api.wordpress.com",
};

/** The site a channel names: its platform, and its API's root or id. */
export interface WordPressSite {
  readonly credential: Redacted.Redacted;
  readonly platform: SitePlatform;
  /** A site's API root, or a WordPress.com site's id. */
  readonly root: string;
}

/**
 * The address of a core route (such as `/wp/v2/posts`) on the site: under
 * its own API's root, or under WordPress.com's for a site there.
 */
export const siteRouteUrl = (
  hosts: WordPressComHosts,
  site: WordPressSite,
  route: string,
  query: Readonly<Record<string, string>> = {}
): URL => {
  if (site.platform !== "wordpressCom") {
    return routeUrl(site.root, route, query);
  }

  const below = route.replace(/^\/*wp\/v2\/?/u, "");

  const url = new URL(
    `/wp/v2/sites/${encodeURIComponent(site.root)}/${below}`,
    hosts.api
  );

  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, value);
  }

  return url;
};

/**
 * Signs a request for the site: an application password as Basic
 * credentials, a WordPress.com token as a bearer token.
 */
export const withSiteToken =
  (site: WordPressSite) => (request: HttpClientRequest.HttpClientRequest) =>
    site.platform === "wordpressCom"
      ? request.pipe(
          HttpClientRequest.bearerToken(site.credential),
          HttpClientRequest.acceptJson
        )
      : request.pipe(withSiteCredential(site.credential));
