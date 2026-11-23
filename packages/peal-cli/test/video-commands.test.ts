import { setTimeout as delay } from "node:timers/promises";

import { assert, layer } from "@effect/vitest";
import { Effect, Fiber, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

import { filesLayer, signedIn } from "./signed-in.ts";
import { readyMediaId } from "./studio.ts";

const inStudio = ["--workspace", "studio"];

const firstId = "0190f3a0-0000-7000-8000-000000000001";

const Generation = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({ id: Schema.String, status: Schema.String })
  )
);

// Lets the command reach its next sleep, then wakes it: the in-memory
// server answers on the event loop, which the test clock does not drive.
const elapse = Effect.gen(function* elapse() {
  yield* Effect.promise(async () => {
    await delay(10);
  });
  yield* TestClock.adjust("5 seconds");
});

// Wakes the command until it ends, as many times as it sleeps.
const joined = <A, E>(fiber: Fiber.Fiber<A, E>) =>
  Effect.gen(function* joining() {
    for (
      let round = 0;
      round < 20 && fiber.pollUnsafe() === undefined;
      round += 1
    ) {
      yield* elapse;
    }

    return yield* Fiber.join(fiber);
  });

layer(filesLayer)("peal media video", (it) => {
  it.effect(
    "asks for a video with its aspect, length and first frame, and answers at once",
    () =>
      Effect.gen(function* asks() {
        const session = yield* signedIn();

        const printed = yield* session.printed([
          "media",
          "video",
          "generate",
          "--prompt",
          "A synthetic catalogue spinning slowly",
          "--aspect",
          "portrait",
          "--duration",
          "6",
          "--image",
          readyMediaId,
          ...inStudio,
        ]);

        assert.include(printed, `Asked for video ${firstId}`);
        assert.include(printed, `peal media video status ${firstId}`);

        const { changes } = yield* Ref.get(session.studio.state);

        assert.include(changes, `video:portrait:6:${readyMediaId}:${firstId}`);

        const json = yield* session.printed([
          "media",
          "video",
          "generate",
          "--prompt",
          "Another synthetic clip",
          "--json",
          ...inStudio,
        ]);

        assert.strictEqual(Generation(json).status, "queued");
      })
  );

  it.effect("waits with --wait until the video is ready", () =>
    Effect.gen(function* waits() {
      const session = yield* signedIn();

      const running = yield* session
        .printed([
          "media",
          "video",
          "generate",
          "--prompt",
          "A synthetic wave",
          "--wait",
          ...inStudio,
        ])
        .pipe(Effect.forkChild);

      const printed = yield* joined(running);

      assert.include(printed, "waiting for it");
      assert.include(
        printed,
        `Video ${firstId} is ready as media 0190f3a0-0000-7000-8000-00000000f0f1`
      );
    })
  );

  it.effect("ends --wait as a refusal when the video failed", () =>
    Effect.gen(function* fails() {
      const session = yield* signedIn();

      const running = yield* session
        .refused([
          "media",
          "video",
          "generate",
          "--prompt",
          "A refused synthetic clip",
          "--wait",
          ...inStudio,
        ])
        .pipe(Effect.forkChild);

      assert.include(yield* joined(running), "the provider refused");
    })
  );

  it.effect("says where a video stands, and lists them", () =>
    Effect.gen(function* follows() {
      const session = yield* signedIn();

      yield* session.printed([
        "media",
        "video",
        "generate",
        "--prompt",
        "A synthetic sunrise",
        ...inStudio,
      ]);

      assert.include(
        yield* session.printed([
          "media",
          "video",
          "status",
          firstId,
          ...inStudio,
        ]),
        "is being made"
      );
      assert.include(
        yield* session.printed(["media", "video", "list", ...inStudio]),
        `Video ${firstId}`
      );
      assert.include(
        yield* session.refused([
          "media",
          "video",
          "status",
          "0190f3a0-0000-7000-8000-0000000000ff",
          ...inStudio,
        ]),
        "asked for no video with that id"
      );
    })
  );

  it.effect("words each refusal before anything is made", () =>
    Effect.gen(function* refuses() {
      const session = yield* signedIn();

      const ask = (prompt: string, extra: readonly string[] = []) =>
        session.refused([
          "media",
          "video",
          "generate",
          "--prompt",
          prompt,
          ...extra,
          ...inStudio,
        ]);

      assert.include(
        yield* ask("unavailable"),
        "peal assistant models set video"
      );
      assert.include(yield* ask("busy"), "already has a video on the way");
      assert.include(yield* ask("allowance"), "20 videos today");
      assert.include(
        yield* ask("A synthetic clip", ["--image", "f-none"]),
        "no ready image"
      );
      assert.include(
        yield* ask("A synthetic clip", ["--duration", "0"]),
        "--duration takes 1 to 60 seconds"
      );
    })
  );
});
