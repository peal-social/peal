import { assert, describe, it } from "@effect/vitest";
import { Duration, Effect, Fiber, Option, Redacted, Schema } from "effect";
import { TestClock } from "effect/testing";

import type { VideoProviderId } from "#assistant/domain/video-provider.ts";
import type { ProviderFetch } from "#assistant/infrastructure/ai-sdk/models.ts";
import { generateVideoWith } from "#assistant/infrastructure/ai-sdk/video-model.ts";
import type { VideoCall } from "#assistant/infrastructure/ai-sdk/video-model.ts";
import { reasonOfVideoStatus } from "#assistant/infrastructure/own-video-model.ts";

// Each video provider's package as the registry builds it, on fake fetches
// that answer as the provider would and keep every request: the start,
// each poll, and the download of the video. Nothing here reaches a
// provider.

interface Sent {
  readonly body: string;
  readonly headers: Headers;
  readonly method: string;
  readonly url: string;
}

// What a start sends, as each provider's API reads it.
const decodeJson = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      aspect_ratio: Schema.optional(Schema.String),
      duration: Schema.optional(Schema.Number),
      image: Schema.optional(Schema.Json),
      model: Schema.optional(Schema.String),
      parameters: Schema.optional(Schema.Json),
      prompt: Schema.optional(Schema.String),
    })
  )
);

// Bytes that start as an MP4 does: a box size, then `ftyp`.
const mp4Bytes = Uint8Array.from({ length: 4096 }, (_, index) => {
  const head = [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d];

  return head[index] ?? index % 251;
});

const videoAddress = "https://media.example.com/videos/synthetic.mp4";

type Answer = (request: Sent) => Response;

// A fetch that answers with `answer` and keeps every request.
const fakeFetch = (answer: Answer) => {
  const sent: Sent[] = [];

  const fetch: ProviderFetch = Object.assign(
    async (input: Request | URL | string, init?: RequestInit) => {
      const request =
        input instanceof Request
          ? new Request(input, init)
          : new Request(input instanceof URL ? input.href : input, init);

      const kept: Sent = {
        body: request.method === "GET" ? "" : await request.text(),
        headers: request.headers,
        method: request.method,
        url: request.url,
      };

      sent.push(kept);

      return answer(kept);
    },
    { preconnect: globalThis.fetch.preconnect }
  );

  return { fetch, sent };
};

// xAI: a start that names a request, a first poll still pending, then done.
const xaiAnswers = (): Answer => {
  let polls = 0;

  return ({ url }) => {
    if (url.endsWith("/videos/generations")) {
      return Response.json({ request_id: "synthetic-request" });
    }

    polls += 1;

    return polls === 1
      ? Response.json({ status: "pending" })
      : Response.json({ status: "done", video: { url: videoAddress } });
  };
};

// Gemini: an operation, done at the first poll, its video at an address
// of its own API.
const googleAnswers =
  (videoUri: string): Answer =>
  ({ url }) =>
    url.includes(":predictLongRunning")
      ? Response.json({ name: "operations/synthetic" })
      : Response.json({
          done: true,
          name: "operations/synthetic",
          response: {
            generateVideoResponse: {
              generatedSamples: [{ video: { uri: videoUri } }],
            },
          },
        });

const download = () =>
  fakeFetch(
    () => new Response(mp4Bytes, { headers: { "content-type": "video/mp4" } })
  );

const settingsFor = (provider: VideoProviderId) => ({
  apiKey: Redacted.make("sk_test_synthetic_video_key"),
  baseUrl:
    provider === "google"
      ? "https://generativelanguage.googleapis.com/v1beta"
      : "https://api.x.ai/v1",
  model:
    provider === "google" ? "veo-3.1-generate-preview" : "grok-imagine-video",
  provider,
});

const call = (overrides: Partial<VideoCall> = {}): VideoCall => ({
  durationSeconds: 6,
  image: Option.none(),
  maxBytes: 1024 * 1024,
  pollEvery: Duration.millis(1),
  pollFor: Duration.seconds(30),
  prompt: "A synthetic harbour at dawn.",
  ratio: "16:9",
  ...overrides,
});

describe("the AI SDK's video adapter", () => {
  it.live(
    "makes an xAI video: starts once, polls, downloads through its own fetch",
    () =>
      Effect.gen(function* xaiVideo() {
        const api = fakeFetch(xaiAnswers());
        const files = download();

        const bytes = yield* generateVideoWith(
          settingsFor("xai"),
          { api: api.fetch, download: files.fetch },
          call()
        );

        assert.deepStrictEqual(bytes, mp4Bytes);

        const [start, ...polls] = api.sent;

        assert.strictEqual(
          start?.url,
          "https://api.x.ai/v1/videos/generations"
        );
        assert.strictEqual(start?.method, "POST");
        assert.strictEqual(
          start?.headers.get("authorization"),
          "Bearer sk_test_synthetic_video_key"
        );

        const body = decodeJson(start?.body ?? "{}");

        assert.strictEqual(body.prompt, "A synthetic harbour at dawn.");
        assert.strictEqual(body.aspect_ratio, "16:9");
        assert.strictEqual(body.duration, 6);
        assert.strictEqual(body.model, "grok-imagine-video");
        // One start, never sent again.
        assert.strictEqual(
          api.sent.filter(({ method }) => method === "POST").length,
          1
        );
        assert.deepStrictEqual(
          polls.map(({ url }) => url),
          [
            "https://api.x.ai/v1/videos/synthetic-request",
            "https://api.x.ai/v1/videos/synthetic-request",
          ]
        );
        // The video came through the download's fetch, without the key.
        assert.deepStrictEqual(
          files.sent.map(({ url }) => url),
          [videoAddress]
        );
        assert.isUndefined(
          files.sent[0]?.headers.get("authorization") ?? undefined
        );
      })
  );

  it.live("sends a first frame and no length when none is asked", () =>
    Effect.gen(function* firstFrame() {
      const api = fakeFetch(xaiAnswers());

      yield* generateVideoWith(
        settingsFor("xai"),
        { api: api.fetch, download: download().fetch },
        call({
          durationSeconds: null,
          image: Option.some(
            Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])
          ),
        })
      );

      const body = decodeJson(api.sent[0]?.body ?? "{}");

      assert.isUndefined(body.duration);
      assert.isDefined(body.image);
    })
  );

  it.live("makes a Gemini video: the key only on its own API's address", () =>
    Effect.gen(function* googleVideo() {
      const own =
        "https://generativelanguage.googleapis.com/v1beta/files/synthetic:download?alt=media";

      const api = fakeFetch(googleAnswers(own));
      const files = download();

      yield* generateVideoWith(
        settingsFor("google"),
        { api: api.fetch, download: files.fetch },
        call()
      );

      const [start] = api.sent;

      assert.strictEqual(
        start?.url,
        "https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-generate-preview:predictLongRunning"
      );
      assert.strictEqual(
        start?.headers.get("x-goog-api-key"),
        "sk_test_synthetic_video_key"
      );

      const body = decodeJson(start?.body ?? "{}");

      assert.deepStrictEqual(body.parameters, {
        aspectRatio: "16:9",
        durationSeconds: 6,
        sampleCount: 1,
      });
      assert.strictEqual(
        files.sent[0]?.url,
        `${own}&key=sk_test_synthetic_video_key`
      );

      // An address elsewhere never gets the key.
      const elsewhere = fakeFetch(googleAnswers(videoAddress));
      const other = download();

      yield* generateVideoWith(
        settingsFor("google"),
        { api: elsewhere.fetch, download: other.fetch },
        call()
      );

      assert.strictEqual(other.sent[0]?.url, videoAddress);
    })
  );

  it.live("asks a start that failed once, never again", () =>
    Effect.gen(function* noRetry() {
      for (const status of [401, 429, 500]) {
        const api = fakeFetch(() =>
          Response.json({ error: "synthetic refusal" }, { status })
        );

        const failure = yield* generateVideoWith(
          settingsFor("xai"),
          { api: api.fetch, download: download().fetch },
          call()
        ).pipe(Effect.flip);

        assert.strictEqual(failure.kind, "status");
        assert.strictEqual(failure.status, status);
        assert.lengthOf(api.sent, 1);
      }
    })
  );

  it.live(
    "calls an operation the provider failed refused, and a video too large unusable",
    () =>
      Effect.gen(function* failures() {
        const failing = fakeFetch(({ url }) =>
          url.endsWith("/videos/generations")
            ? Response.json({ request_id: "synthetic-request" })
            : Response.json({
                error: { message: "synthetic content rule" },
                status: "failed",
              })
        );

        const refused = yield* generateVideoWith(
          settingsFor("xai"),
          { api: failing.fetch, download: download().fetch },
          call()
        ).pipe(Effect.flip);

        assert.strictEqual(refused.kind, "refused");
        assert.notInclude(refused.message, "synthetic content rule");

        const tooLarge = yield* generateVideoWith(
          settingsFor("xai"),
          { api: fakeFetch(xaiAnswers()).fetch, download: download().fetch },
          call({ maxBytes: 1024 })
        ).pipe(Effect.flip);

        assert.strictEqual(tooLarge.kind, "unusable");
      })
  );

  it.effect("aborts the provider's wait when the call is interrupted", () =>
    Effect.gen(function* interrupted() {
      const signals: AbortSignal[] = [];

      const api = fakeFetch(({ url }) =>
        url.endsWith("/videos/generations")
          ? Response.json({ request_id: "synthetic-request" })
          : Response.json({ status: "pending" })
      );

      const watched: ProviderFetch = Object.assign(
        async (input: Request | URL | string, init?: RequestInit) => {
          if (init?.signal) {
            signals.push(init.signal);
          }

          return await api.fetch(input, init);
        },
        { preconnect: globalThis.fetch.preconnect }
      );

      const running = yield* generateVideoWith(
        settingsFor("xai"),
        { api: watched, download: download().fetch },
        call({ pollEvery: Duration.seconds(5) })
      ).pipe(Effect.forkChild);

      yield* TestClock.withLive(Effect.sleep(Duration.millis(50)));
      yield* Fiber.interrupt(running);

      assert.isAbove(signals.length, 0);
      assert.isTrue(signals.every((signal) => signal.aborted));
    })
  );
});

describe("a video provider's statuses", () => {
  it("say what a job failed for", () => {
    assert.deepStrictEqual(
      [301, 401, 402, 403, 404, 400, 422, 429, 500, 503].map(
        reasonOfVideoStatus
      ),
      [
        "redirected",
        "settingsRefused",
        "settingsRefused",
        "settingsRefused",
        "settingsRefused",
        "refused",
        "refused",
        "unreachable",
        "unreachable",
        "unreachable",
      ]
    );
  });
});
