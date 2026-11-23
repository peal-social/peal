import { setTimeout as delay } from "node:timers/promises";

import { assert, layer } from "@effect/vitest";
import { Effect, Fiber, FileSystem, Path, Ref, Schema } from "effect";
import { TestClock } from "effect/testing";

import { filesLayer, signedIn } from "./signed-in.ts";
import type { SignedIn } from "./signed-in.ts";
import { madeSlideshowId, slideshowId } from "./studio-slideshows.ts";
import { readyMediaId } from "./studio.ts";

const inStudio = ["--workspace", "studio"];

const firstId = slideshowId(0);

const Answer = Schema.decodeUnknownSync(
  Schema.fromJsonString(
    Schema.Struct({
      durationSeconds: Schema.Number,
      id: Schema.String,
      status: Schema.String,
    })
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

// A file of the test's own, holding `contents`.
const fileOf = (session: SignedIn, name: string, contents: string) =>
  Effect.gen(function* writing() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = path.join(session.directory, name);

    yield* fs.writeFileString(file, contents);

    return file;
  });

const twoImages = ["--image", readyMediaId, "--image", readyMediaId];

const create = (...rest: readonly string[]) => [
  "media",
  "slideshow",
  "create",
  ...rest,
  ...inStudio,
];

layer(filesLayer)("peal media slideshow", (it) => {
  it.effect(
    "asks for a slide video with its slides paired in order, and answers at once",
    () =>
      Effect.gen(function* asks() {
        const session = yield* signedIn();

        const printed = yield* session.printed(
          create(
            ...twoImages,
            "--caption",
            "A synthetic opening",
            "--caption",
            "",
            "--motion",
            "zoomIn",
            "--motion",
            "slide",
            "--seconds",
            "3",
            "--transition",
            "none",
            "--aspect",
            "square"
          )
        );

        assert.include(printed, `Asked for slide video ${firstId}`);
        assert.include(printed, "6 seconds long");
        assert.include(printed, `peal media slideshow status ${firstId}`);

        const { changes } = yield* Ref.get(session.studio.state);

        assert.include(
          changes,
          `slideshow:square:3:none:-:A synthetic opening/zoomIn,-/slide:${firstId}`
        );
      })
  );

  it.effect(
    "fits the slides to a voice-over, and a single motion moves all",
    () =>
      Effect.gen(function* fits() {
        const session = yield* signedIn();

        const json = yield* session.printed(
          create(
            ...twoImages,
            "--voiceover",
            readyMediaId,
            "--motion",
            "zoomOut",
            "--json"
          )
        );

        const answer = Answer(json);

        assert.strictEqual(answer.status, "queued");
        assert.strictEqual(answer.durationSeconds, 12);

        const { changes } = yield* Ref.get(session.studio.state);

        assert.include(
          changes,
          `slideshow:portrait:-:fade:${readyMediaId}:-/zoomOut,-/zoomOut:${firstId}`
        );
      })
  );

  it.effect("waits with --wait until the slide video is ready", () =>
    Effect.gen(function* waits() {
      const session = yield* signedIn();

      const running = yield* session
        .printed(create(...twoImages, "--wait"))
        .pipe(Effect.forkChild);

      const printed = yield* joined(running);

      assert.include(printed, "waiting for it");
      assert.include(
        printed,
        `Slide video ${firstId} is ready as media ${madeSlideshowId}`
      );
    })
  );

  it.effect("ends --wait as a refusal when the slide video failed", () =>
    Effect.gen(function* fails() {
      const session = yield* signedIn();

      const running = yield* session
        .refused(
          create(
            ...twoImages,
            "--caption",
            "A refused synthetic slide",
            "--wait"
          )
        )
        .pipe(Effect.forkChild);

      assert.include(yield* joined(running), "the service refused");
    })
  );

  it.effect("says where a slide video stands, and lists them", () =>
    Effect.gen(function* follows() {
      const session = yield* signedIn();

      yield* session.printed(create(...twoImages));

      assert.include(
        yield* session.printed([
          "media",
          "slideshow",
          "status",
          firstId,
          ...inStudio,
        ]),
        "is being composed"
      );
      assert.include(
        yield* session.printed([
          "media",
          "slideshow",
          "status",
          firstId,
          ...inStudio,
        ]),
        "is ready as media"
      );
      assert.include(
        yield* session.printed([
          "media",
          "slideshow",
          "list",
          "--status",
          "succeeded",
          ...inStudio,
        ]),
        `Slide video ${firstId} is ready`
      );
      assert.include(
        yield* session.printed([
          "media",
          "slideshow",
          "list",
          "--status",
          "queued",
          ...inStudio,
        ]),
        "no slide video to list"
      );
      assert.include(
        yield* session.refused([
          "media",
          "slideshow",
          "status",
          "0190f3a0-0000-7000-8000-0000000000ff",
          ...inStudio,
        ]),
        "asked for no slide video with that id"
      );
    })
  );

  it.effect("words each refusal before anything is composed", () =>
    Effect.gen(function* refuses() {
      const session = yield* signedIn();

      const said = (caption: string) =>
        session.refused(create(...twoImages, "--caption", caption));

      assert.include(
        yield* said("unavailable"),
        "peal assistant models set composition --provider shotstack"
      );
      assert.include(yield* said("payment"), "need a payment method");
      assert.include(yield* said("busy"), "already has a slide video");
      assert.include(yield* said("allowance"), "20 slide videos today");
      assert.include(
        yield* session.refused(
          create("--image", readyMediaId, "--image", "f-none")
        ),
        "no ready image"
      );
      assert.include(
        yield* session.refused(create("--image", readyMediaId)),
        "Give 2 to 10 images"
      );
      assert.include(
        yield* session.refused(
          create(
            ...twoImages,
            "--caption",
            "a",
            "--caption",
            "b",
            "--caption",
            "c"
          )
        ),
        "at most one --caption per --image"
      );
      assert.include(
        yield* session.refused(create(...twoImages, "--seconds", "11")),
        "--seconds takes 2 to 10 seconds"
      );
    })
  );

  it.effect("renders a whole Shotstack Edit from a file", () =>
    Effect.gen(function* renders() {
      const session = yield* signedIn();

      const file = yield* fileOf(
        session,
        "edit.json",
        JSON.stringify({
          output: { aspectRatio: "1:1", format: "mp4" },
          timeline: {
            tracks: [
              {
                clips: [
                  {
                    asset: { src: `peal:media/${readyMediaId}`, type: "image" },
                    length: 4,
                    start: 0,
                  },
                ],
              },
            ],
          },
        })
      );

      const printed = yield* session.printed([
        "media",
        "slideshow",
        "render",
        file,
        "--json",
        ...inStudio,
      ]);

      const { changes } = yield* Ref.get(session.studio.state);

      assert.deepStrictEqual(
        [Answer(printed).status, Answer(printed).id],
        ["queued", firstId]
      );
      assert.include(changes, `slideshow-edit:${firstId}`);
    })
  );

  it.effect("refuses a file that holds no JSON object, before asking", () =>
    Effect.gen(function* refuses() {
      const session = yield* signedIn();
      const file = yield* fileOf(session, "notes.txt", "[1, 2, 3]");

      const said = yield* session.refused([
        "media",
        "slideshow",
        "render",
        file,
        ...inStudio,
      ]);

      const { changes } = yield* Ref.get(session.studio.state);

      assert.include(said, "does not hold a JSON object");
      assert.notInclude(changes.join(" "), "slideshow-edit");
    })
  );
});
