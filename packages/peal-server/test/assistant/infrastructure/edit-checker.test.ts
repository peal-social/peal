import { assert, layer } from "@effect/vitest";
import { Effect, Option, Result } from "effect";
import type { Schema } from "effect";

import { EditChecker } from "#assistant/application/ports/edit-checker.ts";
import { editFilesOf, editVideoOf } from "#assistant/domain/edit-render.ts";
import { ShotstackEditCheckerLive } from "#assistant/infrastructure/shotstack/edit-checker.ts";

// The documents the web app's editor writes, through Shotstack's schema
// and then Peal's rules, as an edit sent to be rendered is: figures,
// keyframes on every property it animates, and captions transcribed from
// another clip by its alias.

const film = "019a0000-0000-7000-8000-00000000c010";

const keyframes = [
  {
    easing: "easeInOut",
    from: 0,
    interpolation: "bezier",
    length: 1,
    start: 0,
    to: 1,
  },
  { from: 1, interpolation: "constant", length: 1, start: 1, to: 0.5 },
];

// The field of Shotstack's asset that names the figure drawn.
const kindField = "shape";

const output: Schema.JsonObject = {
  aspectRatio: "9:16",
  format: "mp4",
  fps: 25,
  resolution: "1080",
};

const editorEdit: Schema.JsonObject = {
  output,
  timeline: {
    background: "#000000",
    tracks: [
      {
        clips: [
          {
            asset: {
              active: { font: { color: "#b9a6ff" } },
              align: { horizontal: "center", vertical: "middle" },
              animation: { style: "highlight" },
              background: { color: "#000000", opacity: 0.6 },
              font: {
                color: "#ffffff",
                family: "Geist",
                size: 56,
                weight: 700,
              },
              src: "alias://source_0000c010",
              type: "rich-caption",
            },
            height: 280,
            length: 6,
            offset: { x: 0, y: 0.05 },
            position: "bottom",
            start: 0,
            width: 900,
          },
        ],
      },
      {
        clips: [
          {
            asset: {
              fill: { color: "#ffffff", opacity: 1 },
              height: 408,
              rectangle: { cornerRadius: 12, height: 400, width: 600 },
              [kindField]: "rectangle",
              stroke: { color: "#000000", width: 4 },
              type: "shape",
              width: 608,
            },
            length: 4,
            offset: { x: keyframes, y: 0.1 },
            opacity: keyframes,
            position: "center",
            scale: keyframes,
            start: 0,
            transform: { rotate: { angle: keyframes } },
          },
          {
            asset: {
              circle: { radius: 200 },
              fill: { color: "#ffffff", opacity: 1 },
              height: 400,
              [kindField]: "circle",
              type: "shape",
              width: 400,
            },
            length: 2,
            start: 4,
          },
          {
            asset: {
              fill: { color: "#ffffff", opacity: 1 },
              height: 8,
              line: { length: 600, thickness: 8 },
              [kindField]: "line",
              type: "shape",
              width: 600,
            },
            length: 2,
            start: 6,
          },
        ],
      },
      {
        clips: [
          {
            alias: "source_0000c010",
            asset: { src: `peal:media/${film}`, type: "video", volume: 1 },
            fit: "crop",
            length: 6,
            start: 0,
          },
        ],
      },
    ],
  },
};

layer(ShotstackEditCheckerLive)("the editor's edits", (it) => {
  it.effect(
    "pass Shotstack's schema and Peal's rules with figures, keyframes and captions",
    () =>
      Effect.gen(function* accepted() {
        const checker = yield* EditChecker;
        const checked = yield* checker.check(editorEdit);

        assert.isTrue(Option.isSome(checked));

        const edit = Option.getOrThrow(checked);
        const files = Result.getOrThrow(editFilesOf(edit));

        assert.deepStrictEqual(
          files.map(({ mediaId }) => mediaId),
          [film]
        );
        assert.deepStrictEqual(Result.getOrThrow(editVideoOf(edit)), {
          aspect: "portrait",
          durationSeconds: 8,
        });
      })
  );

  it.effect("refuse a caption whose source names no clip", () =>
    Effect.gen(function* refused() {
      const checker = yield* EditChecker;

      const checked = yield* checker.check({
        output,
        timeline: {
          tracks: [
            {
              clips: [
                {
                  asset: { src: "alias://", type: "rich-caption" },
                  length: 2,
                  start: 0,
                },
              ],
            },
          ],
        },
      });

      const reason = Option.match(checked, {
        onNone: () => "refused by the schema",
        onSome: (edit) =>
          Result.match(editFilesOf(edit), {
            onFailure: ({ reason: why }) => why,
            onSuccess: () => "accepted",
          }),
      });

      assert.notStrictEqual(reason, "accepted");
    })
  );
});
