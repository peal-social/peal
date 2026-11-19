import { isIP } from "node:net";

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

// A mode's switch (`on` or `off`, `off` by default) and, when it is on,
// PEAL_POSTHOG_KEY (the project token, required) and PEAL_POSTHOG_HOST
// (PostHog's EU Cloud by default). None while it is off.
const targetWhen = (name: string) =>
  Config.schema(Schema.Literals(["on", "off"]), name).pipe(
    Config.withDefault<"off" | "on">("off"),
    Config.flatMap((mode) =>
      mode === "on"
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
 * The relay's settings for the web app's own measurement, read per
 * request: PEAL_POSTHOG_WEB (`on` or `off`, `off` by default) and, when it
 * is on, PEAL_POSTHOG_KEY (the project token, required) and
 * PEAL_POSTHOG_HOST (PostHog's EU Cloud by default). None while it is off.
 */
export const relayConfig = targetWhen("PEAL_POSTHOG_WEB");

/** Where the site mode sends, and the headers it reads the address from. */
export interface SiteRelayTarget extends RelayTarget {
  /** The headers that may carry the visitor's address, in order. */
  readonly addressHeaders: readonly string[];
}

/**
 * The relay's settings for the site's, the docs' and the blog's
 * measurement, read per request, independent of the app's:
 * PEAL_POSTHOG_SITE (`on` or `off`, `off` by default) and, when it is on,
 * PEAL_POSTHOG_KEY and PEAL_POSTHOG_HOST as for the app, and
 * AUTH_IP_HEADERS (comma-separated, as the server reads it, none by
 * default): the headers the edge gives the visitor's address in. None
 * while it is off.
 */
export const siteRelayConfig = Config.all({
  addressHeaders: Config.Array(Schema.String, "AUTH_IP_HEADERS").pipe(
    Config.withDefault<readonly string[]>([]),
    Config.map((names) =>
      names
        .map((name) => name.trim().toLowerCase())
        .filter((name) => name !== "")
    )
  ),
  target: targetWhen("PEAL_POSTHOG_SITE"),
}).pipe(
  Config.map(({ addressHeaders, target }) =>
    target.pipe(
      Option.map((found): SiteRelayTarget => ({ ...found, addressHeaders }))
    )
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

// The most the app's SDK may send at once: a replay's batch, compressed, is
// far less.
const maxAppBody = 4 * 1024 * 1024;

// The most the site's SDK may send at once: a batch of events, without
// recordings.
const maxSiteBody = 256 * 1024;

/** How long PostHog has to answer before the relay gives up (504). */
export const relayTimeoutMs = 10_000;

// A body past its bound, read no further.
const tooLarge = Symbol("tooLarge");

// The body, read a chunk at a time, and given up on past `bound` bytes.
const readBounded = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  bound: number,
  chunks: readonly Uint8Array[],
  size: number
): Promise<readonly Uint8Array[] | typeof tooLarge> => {
  const { done, value } = await reader.read();

  if (done) {
    return chunks;
  }

  if (size + value.byteLength > bound) {
    await reader.cancel();

    return tooLarge;
  }

  return await readBounded(
    reader,
    bound,
    [...chunks, value],
    size + value.byteLength
  );
};

const boundedBody = async (
  request: Request,
  bound: number
): Promise<ArrayBuffer | typeof tooLarge> => {
  const reader = request.body?.getReader();

  if (reader === undefined) {
    return new ArrayBuffer(0);
  }

  const chunks = await readBounded(reader, bound, [], 0);

  if (chunks === tooLarge) {
    return tooLarge;
  }

  let size = 0;

  for (const chunk of chunks) {
    size += chunk.byteLength;
  }

  const body = new ArrayBuffer(size);
  const view = new Uint8Array(body);
  let offset = 0;

  for (const chunk of chunks) {
    view.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return body;
};

const ContentLengthSchema = Schema.NumberFromString.check(Schema.isInt());

// What a request says it carries, none when it does not say.
const declaredLength = (request: Request): Option.Option<number> =>
  Schema.decodeUnknownOption(ContentLengthSchema)(
    request.headers.get("content-length")
  );

// The request headers PostHog receives from the app's mode, and no other:
// never a cookie, a credential, the visitor's address, the page they came
// from, their languages or their browser's own description.
const forwardedRequestHeaders = ["accept", "content-type"];

// The request headers PostHog receives from the site's mode beside those:
// the browser's own description, which its cookieless count is worked out
// from with the visitor's address (set apart, from the edge's header).
// Never a cookie, a credential, the page they came from or their languages.
const forwardedSiteHeaders = [...forwardedRequestHeaders, "user-agent"];

// The named headers of a request, as it carries them.
const copied = (request: Request, names: readonly string[]): Headers => {
  const headers = new Headers();

  for (const name of names) {
    const value = request.headers.get(name);

    if (value !== null) {
      headers.set(name, value);
    }
  }

  return headers;
};

/**
 * The visitor's address: the first value of the first of `names` that the
 * request carries, when it is an IP address; none otherwise.
 */
export const visitorAddress = (
  request: Request,
  names: readonly string[]
): Option.Option<string> =>
  Option.fromNullishOr(
    names
      .map((name) => request.headers.get(name)?.split(",")[0]?.trim())
      .find((value) => value !== undefined && value !== "")
  ).pipe(Option.filter((address) => isIP(address) !== 0));

const answer = (status: number) => new Response(null, { status });

// Where the SDK sends events and recordings: its defaults, `/e/` and
// `/s/`, until the project's configuration names PostHog's newer
// endpoints, `/i/v0/e/` for events (as PostHog's cloud does) and
// `/i/v0/s/` for recordings.
const ingestion: ReadonlySet<string> = new Set([
  "/e/",
  "/i/v0/e/",
  "/i/v0/s/",
  "/s/",
]);

const ConfigSchema = Schema.Record(Schema.String, Schema.Json);

const decodeConfig = Schema.decodeUnknownOption(
  Schema.fromJsonString(ConfigSchema)
);

const isAnyRecord = Schema.is(ConfigSchema);

type ConfigPart = typeof ConfigSchema.Type;

const isPart = (
  value: typeof Schema.Json.Type | undefined
): value is ConfigPart => isAnyRecord(value);

// A part of the configuration with its endpoint set to `endpoint`, where
// it names one; anything else as it is.
const withEndpoint = (
  part: typeof Schema.Json.Type,
  endpoint: string
): typeof Schema.Json.Type =>
  isPart(part) && part["endpoint"] !== undefined
    ? Object.fromEntries([
        ...Object.entries(part).filter(([key]) => key !== "endpoint"),
        ["endpoint", endpoint],
      ])
    : part;

// The SDK's own endpoint for each part of the configuration that names one.
const ownEndpoints: ReadonlyMap<string, string> = new Map([
  ["analytics", "/e/"],
  ["sessionRecording", "/s/"],
]);

/**
 * The project's configuration with the SDK's own endpoints, `/e/` and
 * `/s/`, wherever it names others: PostHog's cloud names `/i/v0/e/` for
 * events, a path tracker blockers refuse, so a browser that runs one would
 * send its first page view (to the SDK's default) and none after. PostHog
 * takes `/e/` all the same. A configuration it cannot read goes as it is.
 */
export const withOwnEndpoints = (body: ArrayBuffer): ArrayBuffer | string =>
  Option.match(decodeConfig(new TextDecoder().decode(body)), {
    onNone: () => body,
    onSome: (config) =>
      JSON.stringify(
        Object.fromEntries(
          Object.entries(config).map(([key, part]) => {
            const endpoint = ownEndpoints.get(key);

            return [
              key,
              endpoint === undefined ? part : withEndpoint(part, endpoint),
            ];
          })
        )
      ),
  });

/** Where the site's, the docs' and the blog's SDK sends, on their origin. */
export const siteRelayPrefix = `${relayPrefix}/site`;

const isSitePath = (pathname: string): boolean =>
  pathname === siteRelayPrefix || pathname.startsWith(`${siteRelayPrefix}/`);

// Where a request goes, by what the SDK sends there, and with what.
interface Route {
  /** The host and path at PostHog. */
  readonly to: string;
  readonly method: "GET" | "POST";
  /** The most its body may hold. */
  readonly bound: number;
  readonly headers: () => Headers;
}

// The app's: its events and its recordings by POST, its project's
// configuration by GET, with the request's type alone.
const appRouteOf = (
  request: Request,
  path: string,
  target: RelayTarget
): Option.Option<Route> => {
  const headers = () => copied(request, forwardedRequestHeaders);

  if (ingestion.has(path)) {
    return Option.some({
      bound: maxAppBody,
      headers,
      method: "POST",
      to: `${target.host}${path}`,
    });
  }

  return path === `/array/${target.token}/config`
    ? Option.some({
        bound: 0,
        headers,
        method: "GET",
        to: `${assetsHostOf(target.host)}${path}`,
      })
    : Option.none();
};

// The site's: its events alone, by POST, to the SDK's default endpoint (it
// loads no remote configuration, so it never names another), with the
// browser's description and the visitor's address beside the type.
const siteRouteOf = (
  request: Request,
  path: string,
  target: SiteRelayTarget
): Option.Option<Route> =>
  path === "/e/"
    ? Option.some({
        bound: maxSiteBody,
        headers: () => {
          const headers = copied(request, forwardedSiteHeaders);

          Option.map(visitorAddress(request, target.addressHeaders), (ip) => {
            headers.set("x-forwarded-for", ip);
          });

          return headers;
        },
        method: "POST",
        to: `${target.host}${path}`,
      })
    : Option.none();

// The route of a request's path, under the mode its prefix names, while
// that mode is on.
const routeOf = (request: Request, pathname: string) =>
  isSitePath(pathname)
    ? siteRelayConfig.pipe(
        Effect.map(
          Option.flatMap((target) =>
            siteRouteOf(request, pathname.slice(siteRelayPrefix.length), target)
          )
        )
      )
    : relayConfig.pipe(
        Effect.map(
          Option.flatMap((target) =>
            appRouteOf(request, pathname.slice(relayPrefix.length), target)
          )
        )
      );

/**
 * Relays to PostHog, query kept, and answers with PostHog's status and type
 * alone (never a cookie), in two modes that are on or off apart:
 *
 * - The web app's, while PEAL_POSTHOG_WEB is on: its SDK's events (`/e/`,
 *   `/i/v0/e/`), recordings (`/s/`, `/i/v0/s/`) and project's
 *   configuration (`/array/<token>/config`, that token alone), with only
 *   the request's type (`accept`, `content-type`); 413 past 4 MiB.
 * - The site's, the docs' and the blog's, under `/pulse/site`, while
 *   PEAL_POSTHOG_SITE is on: their SDK's events alone (`/e/`), with the
 *   request's type, its `user-agent`, and `x-forwarded-for` set to the
 *   visitor's address, read from the header AUTH_IP_HEADERS names (none
 *   when it holds no IP address), which PostHog's cookieless count is
 *   worked out from; 413 past 256 KiB.
 *
 * 404 while a mode is off and for any path it does not relay, 405 for
 * another method, 413 on a declared length before anything is read, 502
 * when PostHog cannot be reached, 504 when it does not answer within
 * `timeoutMs`.
 */
export const relayToPostHog = Effect.fn("relayToPostHog")(function* relay(
  request: Request,
  send: Send,
  timeoutMs: number = relayTimeoutMs
) {
  const url = new URL(request.url);
  const route = yield* routeOf(request, url.pathname);

  if (Option.isNone(route)) {
    return answer(404);
  }

  if (request.method !== route.value.method) {
    return answer(405);
  }

  const { bound } = route.value;

  // Refused before anything is read when it says it is too large, and
  // read no further than the limit when it does not say.
  if (Option.exists(declaredLength(request), (length) => length > bound)) {
    return answer(413);
  }

  const body =
    request.method === "POST"
      ? yield* Effect.promise(async () => await boundedBody(request, bound))
      : null;

  if (body === tooLarge) {
    return answer(413);
  }

  const headers = route.value.headers();

  const relayedUrl = `${route.value.to}${url.search}`;

  const signal = AbortSignal.timeout(timeoutMs);

  return yield* Effect.tryPromise(async () => {
    const reply = await send(relayedUrl, {
      body,
      headers,
      method: request.method,
      redirect: "manual",
      signal,
    });

    const type = reply.headers.get("content-type");
    const replied = await reply.arrayBuffer();

    return new Response(
      route.value.method === "GET" && reply.ok
        ? withOwnEndpoints(replied)
        : replied,
      {
        headers: type === null ? {} : { "content-type": type },
        status: reply.status,
      }
    );
  }).pipe(
    // Too slow is 504, unreachable 502.
    Effect.orElseSucceed(() => answer(signal.aborted ? 504 : 502))
  );
});
