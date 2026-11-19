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

/** How long PostHog has to answer before the relay gives up (504). */
export const relayTimeoutMs = 10_000;

// A body past `maxBody`, read no further.
const tooLarge = Symbol("tooLarge");

// The body, read a chunk at a time, and given up on past `maxBody`.
const readBounded = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunks: readonly Uint8Array[],
  size: number
): Promise<readonly Uint8Array[] | typeof tooLarge> => {
  const { done, value } = await reader.read();

  if (done) {
    return chunks;
  }

  if (size + value.byteLength > maxBody) {
    await reader.cancel();

    return tooLarge;
  }

  return await readBounded(reader, [...chunks, value], size + value.byteLength);
};

const boundedBody = async (
  request: Request
): Promise<ArrayBuffer | typeof tooLarge> => {
  const reader = request.body?.getReader();

  if (reader === undefined) {
    return new ArrayBuffer(0);
  }

  const chunks = await readBounded(reader, [], 0);

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

// The request headers PostHog receives, and no other: never a cookie, a
// credential, the visitor's address, the page they came from, their
// languages or their browser's own description.
const forwardedRequestHeaders = ["accept", "content-type"];

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

// Where a path goes, by what the SDK sends there: its events and its
// recordings by POST, its project's configuration by GET.
const routeOf = (path: string, target: RelayTarget) => {
  if (ingestion.has(path)) {
    return Option.some({ host: target.host, method: "POST" });
  }

  return path === `/array/${target.token}/config`
    ? Option.some({ host: assetsHostOf(target.host), method: "GET" })
    : Option.none();
};

/**
 * Relays what the web app's SDK sends to PostHog, query kept: its events
 * (`/e/`, `/i/v0/e/`), its recordings (`/s/`, `/i/v0/s/`) and its
 * project's configuration
 * (`/array/<token>/config`, that token alone), with only the request's
 * type, and answers with PostHog's status and type alone (never a
 * cookie). 404 while PEAL_POSTHOG_WEB is off and for any other path, 405
 * for another method, 413 past 4 MiB (refused on its declared length
 * before anything is read), 502 when PostHog cannot be reached, 504 when
 * it does not answer within `timeoutMs`.
 */
export const relayToPostHog = Effect.fn("relayToPostHog")(function* relay(
  request: Request,
  send: Send,
  timeoutMs: number = relayTimeoutMs
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

  // Refused before anything is read when it says it is too large, and
  // read no further than the limit when it does not say.
  if (Option.exists(declaredLength(request), (length) => length > maxBody)) {
    return answer(413);
  }

  const body =
    request.method === "POST"
      ? yield* Effect.promise(async () => await boundedBody(request))
      : null;

  if (body === tooLarge) {
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
