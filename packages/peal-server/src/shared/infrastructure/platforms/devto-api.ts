import { Effect, Redacted, Schema } from "effect";
import type { Option } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";

// What the channels and publishing contexts share of DEV's API, Forem's
// API v1 (developers.forem.com/api/v1): where it is, how a member's key
// is sent, and how its errors look.

/** Where DEV's API is: `https://dev.to` in production. */
export interface DevToHosts {
  readonly api: string;
}

export const devtoHosts: DevToHosts = { api: "https://dev.to" };

/**
 * The media type Forem routes to its API v1: a request without it falls
 * through to the older, default version.
 */
export const devtoApiV1 = "application/vnd.forem.api-v1+json";

/** The address of `path` (such as `/api/articles`) with `query`. */
export const devtoUrl = (
  hosts: DevToHosts,
  path: string,
  query: Readonly<Record<string, string>> = {}
): URL => {
  const url = new URL(path, hosts.api);

  for (const [name, value] of Object.entries(query)) {
    url.searchParams.set(name, value);
  }

  return url;
};

/** Signs a request with the member's key, for API v1. */
export const withDevToKey =
  (key: Redacted.Redacted) => (request: HttpClientRequest.HttpClientRequest) =>
    request.pipe(
      HttpClientRequest.setHeader("api-key", Redacted.value(key)),
      HttpClientRequest.setHeader("accept", devtoApiV1)
    );

/** An error as Forem answers one: `{ "error": "…", "status": 422 }`. */
export const DevToErrorSchema = Schema.Struct({
  error: Schema.String,
  status: Schema.optionalKey(Schema.Number),
});

/** Forem's own error in the answer, if it is one. */
export const devtoErrorOf = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<Option.Option<typeof DevToErrorSchema.Type>> =>
  HttpClientResponse.schemaBodyJson(DevToErrorSchema)(response).pipe(
    Effect.option
  );
