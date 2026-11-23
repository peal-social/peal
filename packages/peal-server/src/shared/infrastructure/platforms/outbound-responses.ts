import { Cause, Effect, Exit, Metric } from "effect";
import { HttpClient } from "effect/http";
import type { HttpClientResponse } from "effect/http";

/**
 * Requests Peal sent through the public HTTP client, by the service the
 * host belongs to (`serviceOf`) and the class of the answer
 * (`statusClassOf`, or `failed` when none came). Every attempt is counted,
 * a retry again: the share of 429s and 5xx a platform answers with, which
 * the publishing outcomes only show once a post fails.
 * `peal-outbound-failing` watches it.
 */
export const outboundResponses = Metric.counter("peal.outbound.responses", {
  description: "Requests sent to outside services, by service and status",
  incremental: true,
});

// The hosts of the platforms and providers Peal calls, by the service they
// count under. A fixed list keeps the label bounded: a host the server was
// given (a Mastodon instance, a WordPress site, a webhook, a feed, a file to
// fetch, a self-hoster's AI endpoint) never becomes a label of its own.
const services: ReadonlyMap<string, string> = new Map([
  ["api.anthropic.com", "anthropic"],
  ["bsky.app", "bluesky"],
  ["bsky.social", "bluesky"],
  ["plc.directory", "bluesky"],
  ["dev.to", "devto"],
  ["discord.com", "discord"],
  ["discordapp.com", "discord"],
  ["gql.hashnode.com", "hashnode"],
  ["gql-beta.hashnode.com", "hashnode"],
  // Google's APIs, by product, so one product's outage is not averaged
  // away by another's traffic: YouTube's Data API and uploads, Google Ads,
  // Business Profile. Its other hosts (the token endpoint every product
  // renews on) count as `google`.
  ["googleads.googleapis.com", "googleAds"],
  ["mybusiness.googleapis.com", "googleBusiness"],
  ["mybusinessaccountmanagement.googleapis.com", "googleBusiness"],
  ["mybusinessbusinessinformation.googleapis.com", "googleBusiness"],
  ["www.googleapis.com", "youtube"],
  ["youtube.googleapis.com", "youtube"],
  ["youtubeanalytics.googleapis.com", "youtube"],
  ["linkedin.com", "linkedin"],
  ["facebook.com", "meta"],
  ["instagram.com", "meta"],
  ["api.openai.com", "openai"],
  ["pinterest.com", "pinterest"],
  ["api.shotstack.io", "shotstack"],
  ["slack.com", "slack"],
  ["api.telegram.org", "telegram"],
  ["threads.com", "threads"],
  ["threads.net", "threads"],
  ["tiktokapis.com", "tiktok"],
  ["public-api.wordpress.com", "wordpress"],
  ["twitter.com", "x"],
  ["x.com", "x"],
]);

// Domains whose every subdomain is the service's own: Google's other APIs, the
// PDSes Bluesky hosts, and each domain of two labels above (whose API,
// upload and sandbox hosts are its subdomains).
const suffixed: readonly (readonly [string, string])[] = [
  ["bsky.network", "bluesky"],
  ["googleapis.com", "google"],
  ...[...services].filter(([host]) => host.split(".").length === 2),
];

/**
 * The service a host belongs to, from the fixed list above, or `other`:
 * never the host itself, which would make a label without bound.
 */
export const serviceOf = (hostname: string): string => {
  const host = hostname.toLowerCase().replace(/\.$/u, "");
  const exact = services.get(host);

  if (exact !== undefined) {
    return exact;
  }

  return (
    suffixed.find(([domain]) => host.endsWith(`.${domain}`))?.[1] ?? "other"
  );
};

/** The class of an answer's status: `429` apart from the other 4xx. */
export const statusClassOf = (status: number): string => {
  if (status === 429) {
    return "429";
  }

  return `${Math.floor(status / 100)}xx`;
};

const hostOf = (url: string) => URL.parse(url)?.hostname ?? "";

/** Counts one request to `url`, answered with `status` or `failed`. */
export const countOutbound = (url: string, status: string) =>
  Metric.update(
    Metric.withAttributes(outboundResponses, {
      service: serviceOf(hostOf(url)),
      status,
    }),
    1
  );

/**
 * The client with each request counted once it is answered, or once it
 * failed (refused by the guard, timed out, or lost on the way). A request
 * its caller interrupted is not counted: nothing was asked of the host.
 */
export const countedResponses = <E, R>(
  client: HttpClient.HttpClient.With<E, R>
): HttpClient.HttpClient.With<E, R> =>
  client.pipe(
    HttpClient.transform((response, request) =>
      response.pipe(
        Effect.onExit(
          (exit: Exit.Exit<HttpClientResponse.HttpClientResponse, E>) => {
            if (Exit.isSuccess(exit)) {
              return countOutbound(
                request.url,
                statusClassOf(exit.value.status)
              );
            }

            return Cause.hasInterruptsOnly(exit.cause)
              ? Effect.void
              : countOutbound(request.url, "failed");
          }
        )
      )
    )
  );
