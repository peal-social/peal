// A stand-in for PostHog, which the run's server and its web app send to:
// it answers the capture endpoints the browser's SDK and the server's
// adapter post to, the project's configuration (with session replay on)
// and the flags, and appends each request it received to `requestsFile`
// (its path, its headers' names, its body decoded), for a journey to read.
// It drops what PostHog's ingestion would, as PostHog does after answering
// 200: a counted event (`$cookieless_mode`) without what its hash needs,
// listed under `warnings` with PostHog's warning type.
import { once } from "node:events";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import type { Server } from "node:http";
import path from "node:path";
import { gunzipSync } from "node:zlib";

import { Option, Schema } from "effect";

/** The project token the run measures with. */
export const projectToken = "phc_synthetic";

/** Where the stand-in writes each request, one JSON object a line. */
export const requestsFile = path.join(
  import.meta.dirname,
  "..",
  // Each run's own folder: the WebKit run's is `.e2e/webkit`, so it never
  // writes over the Chromium run's (e2e.webkit.config.ts).
  process.env["PEAL_E2E_OUTPUT"] ?? ".e2e",
  "posthog-requests.jsonl"
);

/** A request as the stand-in received it. */
export interface RecordedRequest {
  readonly method: string;
  readonly path: string;
  readonly query: string;
  /** Its headers' names, lower case, never their values. */
  readonly headers: readonly string[];
  /** Its body, decoded: the events it carried, or null. */
  readonly body: typeof Schema.Json.Type;
  /** The events PostHog's ingestion would drop, with its warning. */
  readonly warnings: readonly IngestionWarning[];
}

/** An event PostHog's ingestion drops, and the warning it records. */
export interface IngestionWarning {
  readonly event: string;
  readonly type: string;
}

// A counted event, with what PostHog's hash reads of it.
const CountedSchema = Schema.Struct({
  event: Schema.String,
  properties: Schema.Struct({
    $cookieless_mode: Schema.Literal(true),
    $host: Schema.optional(Schema.String),
    $raw_user_agent: Schema.optional(Schema.String),
  }),
});

const decodeCounted = Schema.decodeUnknownOption(CountedSchema);

const decodeList = Schema.decodeUnknownOption(Schema.Array(Schema.Json));

const BatchSchema = Schema.Struct({ batch: Schema.Array(Schema.Json) });

const decodeBatch = Schema.decodeUnknownOption(BatchSchema);

const filled = (value: string | undefined) =>
  value !== undefined && value !== "";

// PostHog counts a cookieless visitor by a hash of the day's salt, the
// address, the host and the user agent (its cookieless manager): an event
// without one of them is dropped, with a warning naming it. The address
// is the request's, which the relay forwards as x-forwarded-for.
const warningOf = (
  raw: typeof Schema.Json.Type,
  headers: readonly string[]
): Option.Option<IngestionWarning> =>
  decodeCounted(raw).pipe(
    Option.flatMap(({ event, properties }) => {
      if (!filled(properties.$raw_user_agent)) {
        return Option.some({ event, type: "cookieless_missing_user_agent" });
      }

      if (!filled(properties.$host)) {
        return Option.some({ event, type: "cookieless_missing_host" });
      }

      return headers.includes("x-forwarded-for")
        ? Option.none()
        : Option.some({ event, type: "cookieless_missing_ip" });
    })
  );

/** A body as PostHog would ingest it, and what it would drop. */
interface Ingested {
  readonly body: typeof Schema.Json.Type;
  readonly warnings: readonly IngestionWarning[];
}

// A list of events, a batch, or one event.
const ingested = (
  body: typeof Schema.Json.Type,
  headers: readonly string[]
): Ingested => {
  const warnings: IngestionWarning[] = [];

  const kept = (events: readonly (typeof Schema.Json.Type)[]) =>
    events.filter((event) =>
      Option.match(warningOf(event, headers), {
        onNone: () => true,
        onSome: (warning) => {
          warnings.push(warning);

          return false;
        },
      })
    );

  const list = decodeList(body);

  if (Option.isSome(list)) {
    return { body: kept(list.value), warnings };
  }

  const batch = decodeBatch(body);

  if (Option.isSome(batch)) {
    return { body: { batch: kept(batch.value.batch) }, warnings };
  }

  return { body: kept([body]).length === 0 ? null : body, warnings };
};

const decodeJson = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Json)
);

// The SDK gzips its batches, or sends them as JSON, or base64 in a form's
// `data`.
const decodedBody = (raw: Buffer, query: URLSearchParams) => {
  if (raw.length === 0) {
    return null;
  }

  // A gzip stream starts with 1f 8b, whatever the query says.
  const gzipped =
    query.get("compression") === "gzip-js" ||
    (raw[0] === 0x1f && raw[1] === 0x8b);

  const text = gzipped
    ? gunzipSync(raw).toString("utf-8")
    : raw.toString("utf-8");

  return decodeJson(text).pipe(
    Option.orElse(() => {
      const data = new URLSearchParams(text).get("data");

      return data === null
        ? Option.none()
        : decodeJson(Buffer.from(data, "base64").toString("utf-8"));
    }),
    Option.getOrNull
  );
};

// What PostHog's project configuration says, exactly as its cloud served
// Peal's project on 19 November 2026 (the token aside): events to
// `/i/v0/e/` rather than the SDK's default `/e/`, both compressions, and
// session replay on with a 10 s minimum.
const remoteConfig = {
  analytics: { endpoint: "/i/v0/e/" },
  autocaptureExceptions: false,
  autocapture_opt_out: true,
  captureDeadClicks: false,
  capturePerformance: false,
  conversations: false,
  defaultIdentifiedOnly: true,
  elementsChainAsString: true,
  errorTracking: { autocaptureExceptions: false, suppressionRules: [] },
  hasFeatureFlags: false,
  heatmaps: false,
  logs: { captureConsoleLogs: false },
  productTours: false,
  push: { appIds: [] },
  sdkVersion: { requested: "1" },
  sessionRecording: {
    canvasFps: null,
    canvasQuality: null,
    consoleLogRecordingEnabled: false,
    endpoint: "/s/",
    eventTriggers: [],
    linkedFlag: null,
    masking: null,
    minimumDurationMilliseconds: 10_000,
    networkPayloadCapture: { recordBody: false, recordHeaders: false },
    recordCanvas: false,
    recorderVersion: "v2",
    sampleRate: null,
    scriptConfig: { script: "posthog-recorder" },
    triggerMatchType: null,
    urlBlocklist: [],
    urlTriggers: [],
    version: 1,
  },
  siteApps: [],
  supportedCompression: ["gzip", "gzip-js"],
  surveys: false,
  token: projectToken,
};

const answerTo = (pathname: string, raw: typeof Schema.Json.Type) => {
  if (pathname.startsWith("/array/")) {
    return remoteConfig;
  }

  if (pathname.startsWith("/flags/") || pathname.startsWith("/decide/")) {
    return { errorsWhileComputingFlags: false, featureFlags: {} };
  }

  // The server's adapter: capture v1, which answers each event by its id.
  if (pathname === "/i/v1/analytics/events") {
    const decoded = Schema.decodeUnknownOption(
      Schema.Struct({
        batch: Schema.Array(Schema.Struct({ uuid: Schema.String })),
      })
    )(raw);

    return {
      results: Object.fromEntries(
        Option.match(decoded, {
          onNone: () => [],
          onSome: ({ batch }) =>
            batch.map(({ uuid }) => [uuid, { result: "ok" }]),
        })
      ),
    };
  }

  return { status: 1 };
};

const PortSchema = Schema.Struct({ port: Schema.Int });

/** Starts the stand-in on a free loopback port, and says where it is. */
export const startPostHog = async (): Promise<{
  readonly server: Server;
  readonly url: string;
}> => {
  mkdirSync(path.dirname(requestsFile), { recursive: true });
  writeFileSync(requestsFile, "");

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      const body = decodedBody(Buffer.concat(chunks), url.searchParams);
      const headers = Object.keys(request.headers);
      const taken = ingested(body, headers);

      const recorded: RecordedRequest = {
        body: taken.body,
        headers,
        method: request.method ?? "GET",
        path: url.pathname,
        query: url.search,
        warnings: taken.warnings,
      };

      appendFileSync(requestsFile, `${JSON.stringify(recorded)}\n`);

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(answerTo(url.pathname, body)));
    });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = Schema.decodeUnknownSync(PortSchema)(server.address());

  return { server, url: `http://127.0.0.1:${port}` };
};
