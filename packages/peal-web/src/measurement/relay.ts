import { Config, Effect, Option, Schema } from "effect";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { forwardedHeader } from "#api/forward.ts";

import { relayPrefix } from "./relay-prefix.ts";

/** Where PostHog's EU Cloud takes events, as the server's default. */
const defaultPostHogHost = "https://eu.i.posthog.com";

const loopbackHostnames: ReadonlySet<string> = new Set([
  "localhost",
  "127.0.0.1",
  "[::1]",
]);

// https, or http on this machine (tests, a local instance), with no
// credentials, query or fragment: the server's rule for the same setting.
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

/**
 * The relay's settings, read per request: PEAL_POSTHOG_WEB (`on` or `off`,
 * `off` by default) and, when it is on, PEAL_POSTHOG_HOST (PostHog's EU
 * Cloud by default). None while it is off.
 */
export const relayConfig = Config.schema(
  Schema.Literals(["on", "off"]),
  "PEAL_POSTHOG_WEB"
).pipe(
  Config.withDefault<"off" | "on">("off"),
  Config.flatMap((web) =>
    web === "on"
      ? Config.schema(HostSchema, "PEAL_POSTHOG_HOST").pipe(
          Config.withDefault(defaultPostHogHost),
          Config.map((host) => Option.some(host.replace(/\/+$/u, "")))
        )
      : Config.succeed(Option.none<string>())
  )
);

/**
 * Where PostHog serves a project's configuration: `<region>-assets` beside
 * its EU and US Clouds, the host itself anywhere else.
 */
export const assetsHostOf = (host: string): string => {
  const region = /^https:\/\/(?<region>[a-z]+)\.i\.posthog\.com$/u.exec(host)
    ?.groups?.["region"];

  return region === undefined ? host : `https://${region}-assets.i.posthog.com`;
};

/** Whether a path is the relay's. */
export const relayed = (pathname: string): boolean =>
  pathname === relayPrefix || pathname.startsWith(`${relayPrefix}/`);

const methods: ReadonlySet<string> = new Set(["GET", "OPTIONS", "POST"]);

// What the SDK sends to: events, replays, flags and its project's
// configuration. Nothing else of PostHog's is reachable through the relay.
const paths = ["/e/", "/i/", "/s/", "/flags/", "/array/"];

// What PostHog must never receive: Peal's session cookie, any credential,
// and the visitor's address, which the privacy policy says it does not get.
const strippedHeaders = [
  "authorization",
  "cf-connecting-ip",
  "cf-ipcountry",
  "cookie",
  "forwarded",
  "true-client-ip",
  "x-forwarded-for",
  "x-real-ip",
  forwardedHeader,
];

const notFound = () => new NextResponse(null, { status: 404 });

/**
 * Forwards what the web app's SDK sends to PostHog, path and query kept,
 * without the visitor's cookies, credentials or address: 404 while
 * PEAL_POSTHOG_WEB is off and for any path the SDK does not use, 405 for
 * a method it does not send.
 */
export const forwardToPostHog = Effect.fn("forwardToPostHog")(function* forward(
  request: NextRequest
) {
  const host = yield* relayConfig;

  if (Option.isNone(host)) {
    return notFound();
  }

  if (!methods.has(request.method)) {
    return new NextResponse(null, { status: 405 });
  }

  const path = request.nextUrl.pathname.slice(relayPrefix.length);

  if (!paths.some((allowed) => path.startsWith(allowed))) {
    return notFound();
  }

  const target = path.startsWith("/array/")
    ? assetsHostOf(host.value)
    : host.value;

  const url = new URL(`${target}${path}${request.nextUrl.search}`);
  const headers = new Headers(request.headers);

  for (const name of strippedHeaders) {
    headers.delete(name);
  }

  headers.set("host", url.host);

  return NextResponse.rewrite(url, { request: { headers } });
});
