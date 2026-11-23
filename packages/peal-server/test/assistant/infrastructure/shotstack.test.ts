import { assert, describe, expect, it } from "@effect/vitest";
import { Duration, Effect, Fiber, Redacted, Result, Schema } from "effect";
import { TestClock } from "effect/testing";

import type {
  CompositionRequest,
  OwnComposerEndpoint,
} from "#assistant/application/ports/own-composer.ts";
import { ProviderAddressSchema } from "#assistant/domain/image-provider.ts";
import { slideshowLengthOf } from "#assistant/domain/slideshow-length.ts";
import {
  composeWith,
  reasonOfComposerStatus,
} from "#assistant/infrastructure/shotstack/client.ts";
import type { ComposerFetch } from "#assistant/infrastructure/shotstack/client.ts";
import { slideTimelineOf } from "#assistant/infrastructure/shotstack/timeline.ts";

// Shotstack's Edit API as its definition (api.edit.json) and guide
// describe it, on fake fetches that answer as it would and keep every
// request. Nothing here reaches Shotstack.

const request = (
  overrides: Partial<CompositionRequest> = {}
): CompositionRequest => ({
  aspect: "portrait",
  secondsPerSlide: 4,
  slides: [
    {
      caption: "A synthetic harbour",
      imageUrl: "https://media.example.com/signed/one",
      motion: "zoomIn",
    },
    {
      caption: null,
      imageUrl: "https://media.example.com/signed/two",
      motion: "slide",
    },
  ],
  transition: "fade",
  voiceoverUrl: null,
  ...overrides,
});

describe("a slide video's timeline", () => {
  it("lays the slides one after the other, captions on top, at 1080p", () => {
    const edit = slideTimelineOf(request());

    expect(edit.output).toStrictEqual({
      aspectRatio: "9:16",
      destinations: [{ exclude: true, provider: "shotstack" }],
      format: "mp4",
      fps: 25,
      resolution: "1080",
    });
    expect(edit.timeline.cache).toBeFalsy();
  });

  it("lays the images one after the other, under their captions", () => {
    const edit = slideTimelineOf(request());

    // The first track is drawn on top: the captions, then the images.
    expect(edit.timeline.tracks).toHaveLength(2);
    expect(edit.timeline.tracks[1]?.clips).toStrictEqual([
      {
        asset: { src: "https://media.example.com/signed/one", type: "image" },
        effect: "zoomIn",
        fit: "crop",
        length: 4,
        start: 0,
        transition: { in: "fade", out: "fade" },
      },
      {
        asset: { src: "https://media.example.com/signed/two", type: "image" },
        effect: "slideLeft",
        fit: "crop",
        length: 4,
        start: 4,
        transition: { in: "fade", out: "fade" },
      },
    ]);

    const captions = edit.timeline.tracks[0]?.clips ?? [];

    expect(captions).toHaveLength(1);
    expect(captions[0]).toMatchObject({
      asset: {
        background: { color: "#000000" },
        font: { color: "#ffffff", family: "Roboto" },
        text: "A synthetic harbour",
        type: "rich-text",
      },
      length: 4,
      position: "bottom",
      start: 0,
      width: 920,
    });
  });

  it("plays the voice-over from the start to the last slide's end, without motion or fade when none is asked", () => {
    const edit = slideTimelineOf(
      request({
        aspect: "landscape",
        secondsPerSlide: 6.5,
        slides: [
          {
            caption: null,
            imageUrl: "https://media.example.com/signed/one",
            motion: "none",
          },
          {
            caption: null,
            imageUrl: "https://media.example.com/signed/two",
            motion: "none",
          },
        ],
        transition: "none",
        voiceoverUrl: "https://media.example.com/signed/voice",
      })
    );

    expect(edit.output.aspectRatio).toBe("16:9");
    // No captions: the images on top, the voice-over below.
    expect(edit.timeline.tracks).toStrictEqual([
      {
        clips: [
          {
            asset: {
              src: "https://media.example.com/signed/one",
              type: "image",
            },
            fit: "crop",
            length: 6.5,
            start: 0,
          },
          {
            asset: {
              src: "https://media.example.com/signed/two",
              type: "image",
            },
            fit: "crop",
            length: 6.5,
            start: 6.5,
          },
        ],
      },
      {
        clips: [
          {
            asset: {
              effect: "fadeOut",
              src: "https://media.example.com/signed/voice",
              type: "audio",
            },
            length: 13,
            start: 0,
          },
        ],
      },
    ]);
  });

  it("composes a square at 1:1", () => {
    expect(
      slideTimelineOf(request({ aspect: "square" })).output.aspectRatio
    ).toBe("1:1");
  });
});

const reasonOf = (asked: Parameters<typeof slideshowLengthOf>[0]) =>
  Result.match(slideshowLengthOf(asked), {
    onFailure: ({ reason }) => reason,
    onSuccess: ({ secondsPerSlide, totalSeconds }) =>
      `${secondsPerSlide}/${totalSeconds}`,
  });

describe("a slide video's length", () => {
  it("takes the seconds asked, else the voice-over shared, else four", () => {
    expect(
      reasonOf({ secondsPerSlide: 3, slides: 5, voiceoverSeconds: 40 })
    ).toBe("3/15");
    expect(
      reasonOf({ secondsPerSlide: null, slides: 3, voiceoverSeconds: 10 })
    ).toBe("3.333/9.999");
    expect(
      reasonOf({ secondsPerSlide: null, slides: 10, voiceoverSeconds: null })
    ).toBe("4/40");
  });

  it("refuses more than 90 seconds, or a voice-over that cannot be shared", () => {
    expect(
      reasonOf({ secondsPerSlide: 10, slides: 10, voiceoverSeconds: null })
    ).toBe("tooLong");
    expect(
      reasonOf({ secondsPerSlide: null, slides: 2, voiceoverSeconds: 30 })
    ).toBe("voiceoverTooLong");
    expect(
      reasonOf({ secondsPerSlide: null, slides: 10, voiceoverSeconds: 95 })
    ).toBe("voiceoverTooLong");
    expect(
      reasonOf({ secondsPerSlide: null, slides: 5, voiceoverSeconds: 6 })
    ).toBe("voiceoverTooShort");
  });
});

interface Sent {
  readonly body: string;
  readonly headers: Headers;
  readonly method: string;
  readonly url: string;
}

type Answer = (sent: Sent, index: number) => Response;

// A fetch that answers with `answer` and keeps every request.
const fakeFetch = (answer: Answer) => {
  const sent: Sent[] = [];

  const fetch: ComposerFetch = Object.assign(
    async (input: Request | URL | string, init?: RequestInit) => {
      const asked =
        input instanceof Request
          ? new Request(input, init)
          : new Request(input instanceof URL ? input.href : input, init);

      const kept: Sent = {
        body: asked.method === "GET" ? "" : await asked.text(),
        headers: asked.headers,
        method: asked.method,
        url: asked.url,
      };

      sent.push(kept);

      return answer(kept, sent.length - 1);
    },
    { preconnect: () => {} }
  );

  return { fetch, sent };
};

const json = (status: number, body: Readonly<Record<string, Schema.Json>>) =>
  Response.json(body, { status });

const renderId = "2abd5c11-0f3d-4c6d-ba20-235fc9b8e8b7";

const queued = () =>
  json(201, {
    message: "Created",
    response: { id: renderId, message: "Render Successfully Queued" },
    success: true,
  });

const statusOf = (status: string, url: string | null = null) =>
  json(200, {
    message: "OK",
    response: { id: renderId, owner: "synthetic", status, url },
    success: true,
  });

const videoUrl = "https://output.example.com/synthetic/render.mp4";

const videoBytes = Uint8Array.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]);

const endpoint: OwnComposerEndpoint = {
  apiKey: Redacted.make("synthetic-shotstack-key"),
  baseUrl: ProviderAddressSchema.make("https://api.shotstack.io/edit/stage"),
  provider: "shotstack",
};

const decodeEdit = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      output: Schema.Struct({ format: Schema.String }),
      timeline: Schema.Struct({ tracks: Schema.Array(Schema.Json) }),
    })
  )
);

// Runs a composition on TestClock, moving it a poll at a time until it
// ends.
const composing = (
  api: ReturnType<typeof fakeFetch>,
  download: ReturnType<typeof fakeFetch>
) =>
  Effect.gen(function* run() {
    const fiber = yield* composeWith(
      { api: api.fetch, download: download.fetch },
      endpoint,
      request(),
      { pollInterval: Duration.seconds(5) }
    ).pipe(Effect.result, Effect.forkChild);

    for (let poll = 0; poll < 20; poll += 1) {
      yield* TestClock.adjust(Duration.seconds(5));
    }

    return yield* Fiber.join(fiber);
  });

describe("Shotstack's Edit API", () => {
  it.effect(
    "posts the Edit once with the key, polls until done, then downloads the video without the key",
    () =>
      Effect.gen(function* renders() {
        const api = fakeFetch((sent, index) => {
          if (sent.method === "POST") {
            return queued();
          }

          return index < 3 ? statusOf("rendering") : statusOf("done", videoUrl);
        });

        const download = fakeFetch(() => new Response(videoBytes));

        const result = yield* composing(api, download);

        assert.isTrue(Result.isSuccess(result));
        assert.deepStrictEqual(Result.getOrThrow(result), videoBytes);

        const [post, ...polls] = api.sent;

        assert.strictEqual(post?.method, "POST");
        assert.strictEqual(
          post?.url,
          "https://api.shotstack.io/edit/stage/render"
        );
        assert.strictEqual(
          post?.headers.get("x-api-key"),
          "synthetic-shotstack-key"
        );
        assert.strictEqual(
          post?.headers.get("content-type"),
          "application/json"
        );
        assert.strictEqual(decodeEdit(post?.body ?? "").output.format, "mp4");
        // Sent once; every later request reads where it stands.
        assert.lengthOf(
          api.sent.filter(({ method }) => method === "POST"),
          1
        );
        assert.lengthOf(polls, 3);

        for (const poll of polls) {
          assert.strictEqual(
            poll.url,
            `https://api.shotstack.io/edit/stage/render/${renderId}`
          );
          assert.strictEqual(
            poll.headers.get("x-api-key"),
            "synthetic-shotstack-key"
          );
        }

        assert.deepStrictEqual(
          download.sent.map(({ headers, url }) => [
            url,
            headers.get("x-api-key"),
          ]),
          [[videoUrl, null]]
        );
      })
  );

  it.effect("fails a render Shotstack failed, sent once", () =>
    Effect.gen(function* failed() {
      const api = fakeFetch((sent) =>
        sent.method === "POST" ? queued() : statusOf("failed")
      );

      const download = fakeFetch(() => new Response(videoBytes));
      const result = yield* composing(api, download);

      assert.deepStrictEqual(
        Result.isFailure(result) ? result.failure.reason : null,
        "refused"
      );
      assert.lengthOf(download.sent, 0);
    })
  );

  it.effect(
    "reads the key or the account refused from the render's status",
    () =>
      Effect.gen(function* refused() {
        const api = fakeFetch(() =>
          json(402, { message: "Insufficient credits", success: false })
        );

        const download = fakeFetch(() => new Response(videoBytes));
        const result = yield* composing(api, download);

        assert.deepStrictEqual(
          Result.isFailure(result) ? result.failure.reason : null,
          "settingsRefused"
        );
        assert.lengthOf(api.sent, 1);
      })
  );

  it.effect(
    "bears a few polls failing for now, never sending the render again",
    () =>
      Effect.gen(function* flaky() {
        const api = fakeFetch((sent, index) => {
          if (sent.method === "POST") {
            return queued();
          }

          return index < 3
            ? json(503, { message: "Busy" })
            : statusOf("done", videoUrl);
        });

        const download = fakeFetch(() => new Response(videoBytes));
        const result = yield* composing(api, download);

        assert.isTrue(Result.isSuccess(result));
        assert.lengthOf(
          api.sent.filter(({ method }) => method === "POST"),
          1
        );
      })
  );

  it.effect("gives up once polls keep failing", () =>
    Effect.gen(function* down() {
      const api = fakeFetch((sent) =>
        sent.method === "POST" ? queued() : json(500, { message: "Down" })
      );

      const download = fakeFetch(() => new Response(videoBytes));
      const result = yield* composing(api, download);

      assert.deepStrictEqual(
        Result.isFailure(result) ? result.failure.reason : null,
        "unreachable"
      );
    })
  );

  it.effect("refuses an answer without a render's id", () =>
    Effect.gen(function* unusable() {
      const api = fakeFetch(() => json(201, { response: { id: "../x" } }));
      const download = fakeFetch(() => new Response(videoBytes));
      const result = yield* composing(api, download);

      assert.deepStrictEqual(
        Result.isFailure(result) ? result.failure.reason : null,
        "unusableAnswer"
      );
      assert.lengthOf(api.sent, 1);
    })
  );

  it("reads each status as a job's reason", () => {
    expect(
      [301, 400, 401, 402, 403, 404, 422, 429, 500, 503].map(
        reasonOfComposerStatus
      )
    ).toStrictEqual([
      "redirected",
      "refused",
      "settingsRefused",
      "settingsRefused",
      "settingsRefused",
      "settingsRefused",
      "refused",
      "unreachable",
      "unreachable",
      "unreachable",
    ]);
  });
});
