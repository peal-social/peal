import { Config, Effect, Option, Schema } from "effect";

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

// The project token, as the server takes it for the web app.
const TokenSchema = Schema.Trim.check(
  Schema.isPattern(/^phc_[A-Za-z0-9]+$/u, {
    expected: "a project token, `phc_` then letters and digits",
  })
);

/** Where the relay sends, and the one project it relays for. */
export interface RelayTarget {
  readonly host: string;
  readonly token: string;
}

/**
 * The relay's settings, read per request: PEAL_POSTHOG_WEB (`on` or `off`,
 * `off` by default) and, when it is on, PEAL_POSTHOG_KEY (the project
 * token, required) and PEAL_POSTHOG_HOST (PostHog's EU Cloud by default).
 * None while it is off.
 */
export const relayConfig = Config.schema(
  Schema.Literals(["on", "off"]),
  "PEAL_POSTHOG_WEB"
).pipe(
  Config.withDefault<"off" | "on">("off"),
  Config.flatMap((web) =>
    web === "on"
      ? Config.all({
          host: Config.schema(HostSchema, "PEAL_POSTHOG_HOST").pipe(
            Config.withDefault(defaultPostHogHost)
          ),
          token: Config.schema(TokenSchema, "PEAL_POSTHOG_KEY"),
        }).pipe(
          Config.map(({ host, token }) =>
            Option.some<RelayTarget>({
              host: host.replace(/\/+$/u, ""),
              token,
            })
          )
        )
      : Config.succeed(Option.none<RelayTarget>())
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

/** What sends a request on, as `fetch` does. */
export type Send = (url: string, init: RequestInit) => Promise<Response>;

// The most a request may carry: a replay's batch, compressed, is far less.
const maxBody = 4 * 1024 * 1024;

// The request headers PostHog receives, and no other: never a cookie, a
// credential, the visitor's address, the page they came from, their
// languages or their browser's own description.
const forwardedRequestHeaders = ["accept", "content-type"];

const answer = (status: number) => new Response(null, { status });

// Where a path goes, by what the SDK sends there: its events and its
// recordings by POST, its project's configuration by GET.
const routeOf = (path: string, target: RelayTarget) => {
  if (path === "/e/" || path === "/s/") {
    return Option.some({ host: target.host, method: "POST" });
  }

  return path === `/array/${target.token}/config`
    ? Option.some({ host: assetsHostOf(target.host), method: "GET" })
    : Option.none();
};

/**
 * Relays what the web app's SDK sends to PostHog, query kept: its events
 * (`/e/`), its recordings (`/s/`) and its project's configuration
 * (`/array/<token>/config`, that token alone), with only the request's
 * type, and answers with PostHog's status and type alone (never a
 * cookie). 404 while PEAL_POSTHOG_WEB is off and for any other path, 405
 * for another method, 413 past 4 MiB, 502 when PostHog cannot be reached.
 */
export const relayToPostHog = Effect.fn("relayToPostHog")(function* relay(
  request: Request,
  send: Send
) {
  const target = yield* relayConfig;
  const url = new URL(request.url);

  if (Option.isNone(target)) {
    return answer(404);
  }

  const route = routeOf(url.pathname.slice(relayPrefix.length), target.value);

  if (Option.isNone(route)) {
    return answer(404);
  }

  if (request.method !== route.value.method) {
    return answer(405);
  }

  const body =
    request.method === "POST"
      ? yield* Effect.promise(async () => await request.arrayBuffer())
      : null;

  if (body !== null && body.byteLength > maxBody) {
    return answer(413);
  }

  const headers = new Headers();

  for (const name of forwardedRequestHeaders) {
    const value = request.headers.get(name);

    if (value !== null) {
      headers.set(name, value);
    }
  }

  const relayedUrl = `${route.value.host}${url.pathname.slice(relayPrefix.length)}${url.search}`;

  return yield* Effect.tryPromise(async () => {
    const reply = await send(relayedUrl, {
      body,
      headers,
      method: request.method,
      redirect: "manual",
    });

    const type = reply.headers.get("content-type");

    return new Response(await reply.arrayBuffer(), {
      headers: type === null ? {} : { "content-type": type },
      status: reply.status,
    });
  }).pipe(Effect.orElseSucceed(() => answer(502)));
});
