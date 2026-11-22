import { Context, Effect, Layer } from "effect";
import type { Redacted } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { Api, apiVersion, apiVersionHeader, OAuthApi } from "peal-contract";

import { apiKeyVariable } from "#api-key.ts";
import { display } from "#display.ts";
import { Refused } from "#refused.ts";
import { insecureHttpFlag, insecureHttpVariable } from "#root.ts";

// This machine, under the names a URL gives it: what is sent there leaves
// no network. `URL` writes an IPv6 host in brackets.
const isLoopback = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname.endsWith(".localhost") ||
  hostname === "[::1]" ||
  /^127(?:\.\d{1,3}){3}$/u.test(hostname);

/**
 * Whether a credential sent to this server stays private on the way: over
 * HTTPS, or to this machine.
 */
export const keepsCredentialsPrivate = (baseUrl: URL): boolean =>
  baseUrl.protocol === "https:" || isLoopback(baseUrl.hostname);

// The typed clients derived from peal-contract, bound to the server the
// command line points at: the HTTP API, and the OAuth endpoints its sign-in
// uses. Commands take them from here, so tests swap the transport (the
// HttpClient) and keep everything else.
export class PealApi extends Context.Service<
  PealApi,
  {
    /**
     * Whether the run named the server (--api-url or PEAL_API_URL), rather
     * than taking the default.
     */
    readonly apiUrlNamed: boolean;
    readonly baseUrl: URL;
    readonly client: HttpApiClient.ForApi<typeof Api>;
    readonly oauth: HttpApiClient.ForApi<typeof OAuthApi>;
    /**
     * Refuses when a credential sent to the server would travel in clear:
     * over plain HTTP to a host that is not this machine, unless the run
     * said it may (--insecure-http). Whatever sends an API key, an access
     * token or a refresh token goes through it first, and what sends none
     * (the health check, the discovery documents) does not.
     */
    readonly sendingCredentials: Effect.Effect<void, Refused>;
    /**
     * Refuses as `sendingCredentials` does, and also when the run did not
     * name the server: an API key is a workspace's, made on one server,
     * and goes to no default.
     */
    readonly sendingApiKey: Effect.Effect<void, Refused>;
    /**
     * The HTTP API's client, sending an OAuth access token: refused as
     * `sendingCredentials` refuses.
     */
    readonly signedIn: (
      accessToken: Redacted.Redacted
    ) => Effect.Effect<HttpApiClient.ForApi<typeof Api>, Refused>;
    /**
     * The HTTP API's client, sending an API key: refused as
     * `sendingApiKey` refuses.
     */
    readonly withApiKey: (
      key: Redacted.Redacted
    ) => Effect.Effect<HttpApiClient.ForApi<typeof Api>, Refused>;
  }
>()("peal-cli/PealApi") {
  static readonly layer = (
    baseUrl: URL,
    options: {
      /** Whether the run named the server, rather than took the default. */
      readonly apiUrlNamed: boolean;
      /** Whether credentials may go over plain HTTP beyond this machine. */
      readonly insecureHttp?: boolean;
    }
  ) =>
    Layer.effect(
      PealApi,
      Effect.gen(function* pealApi() {
        // Every request names the version of the API the command line was
        // built against, as the SDKs' do.
        const httpClient = (yield* HttpClient.HttpClient).pipe(
          HttpClient.mapRequest(
            HttpClientRequest.setHeader(apiVersionHeader, apiVersion)
          )
        );

        const sendingCredentials =
          options.insecureHttp === true || keepsCredentialsPrivate(baseUrl)
            ? Effect.void
            : Effect.fail(
                new Refused({
                  code: "insecure_api_url",
                  reason: `${display(baseUrl)} is reached over plain HTTP, and is not this machine: a sign-in or an API key sent there could be read on the way, so none was sent. Point the command line at the server's https:// address (--api-url or PEAL_API_URL). For a server on a network you trust that has no TLS, pass --${insecureHttpFlag}, or set ${insecureHttpVariable}=true.`,
                })
              );

        const sendingApiKey = options.apiUrlNamed
          ? sendingCredentials
          : Effect.fail(
              new Refused({
                code: "api_url_required",
                reason: `${apiKeyVariable} is set, and no server is named: an API key goes only to the server it was made on, so none was sent to the default, ${display(baseUrl)}. Name the server with --api-url or PEAL_API_URL, such as https://peal.example.com.`,
              })
            );

        const bearing = (credential: Redacted.Redacted) =>
          HttpApiClient.makeWith(Api, {
            baseUrl,
            httpClient: httpClient.pipe(
              HttpClient.mapRequest(HttpClientRequest.bearerToken(credential))
            ),
          });

        return PealApi.of({
          apiUrlNamed: options.apiUrlNamed,
          baseUrl,
          client: yield* HttpApiClient.makeWith(Api, { baseUrl, httpClient }),
          oauth: yield* HttpApiClient.makeWith(OAuthApi, {
            baseUrl,
            httpClient,
          }),
          sendingApiKey,
          sendingCredentials,
          signedIn: (accessToken) =>
            sendingCredentials.pipe(Effect.andThen(bearing(accessToken))),
          withApiKey: (key) => sendingApiKey.pipe(Effect.andThen(bearing(key))),
        });
      })
    );
}
