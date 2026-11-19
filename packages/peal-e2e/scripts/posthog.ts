// A stand-in for PostHog, which the run's server and its web app send to:
// it answers the capture endpoints the browser's SDK and the server's
// adapter post to, the project's configuration (with session replay on)
// and the flags, and appends each request it received to `requestsFile`
// (its path, its headers' names, its body decoded), for a journey to read.
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
  ".e2e",
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
}

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

// What PostHog's project configuration says: session replay on, with no
// minimum duration and every session sampled, so a short journey records.
const remoteConfig = {
  autocapture_opt_out: true,
  capturePerformance: false,
  hasFeatureFlags: false,
  sessionRecording: {
    consoleLogRecordingEnabled: false,
    endpoint: "/s/",
    minimumDurationMilliseconds: 0,
    recordCanvas: false,
    sampleRate: null,
  },
  supportedCompression: ["gzip-js"],
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

      const recorded: RecordedRequest = {
        body,
        headers: Object.keys(request.headers),
        method: request.method ?? "GET",
        path: url.pathname,
        query: url.search,
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
