import { describe, expect, it } from "@effect/vitest";
import { editSchema } from "@shotstack/schemas/zod";

import {
  captionClipOf,
  captionSourceOf,
  captionSourcesOf,
} from "#studio/captions.ts";
import {
  clipOfMedia,
  emptyEdit,
  storedOf,
  tracksOf,
} from "#studio/edit-document.ts";
import type { StudioClip, StudioEdit } from "#studio/edit-document.ts";
import { figureClipOf, figureSizeOf, figureWith } from "#studio/figures.ts";
import {
  animationOf,
  propertyChanges,
  propertyOf,
  stillOf,
  withKeyframeAdded,
  withKeyframeChanged,
  withKeyframeRemoved,
} from "#studio/tweens.ts";

// Shapes, keyframes and captions as the editor writes them: each a
// document Shotstack's schema accepts, as the server checks it.

const origin = "https://app.example.com";
const film = "0190a000-0000-7000-8000-000000000003";
const filmClipId = "4f1c2b9e-0000-4000-8000-00000000ab12";

const editOf = (tracks: readonly (readonly StudioClip[])[]): StudioEdit => ({
  ...emptyEdit(),
  timeline: {
    background: "#000000",
    tracks: tracks.map((clips) => ({ clips: [...clips] })),
  },
});

// What the server takes: Shotstack's schema, then a caption's source
// another clip's alias (edit-render.ts in peal-server).
const accepted = (edit: StudioEdit): boolean => {
  const sent = storedOf(edit, () => null, origin);

  return editSchema.safeParse(structuredClone(sent)).success;
};

const filmClip = (): StudioClip => {
  const clip = clipOfMedia({ durationMs: 6000, id: film, kind: "video" }, 2);

  if (clip === null) {
    throw new Error("no clip of a film");
  }

  return { ...clip, id: filmClipId };
};

describe("figures", () => {
  it("adds a rectangle, a circle and a line Shotstack renders", () => {
    const figures = (["rectangle", "circle", "line"] as const).map((kind) =>
      figureClipOf(kind, 1)
    );

    expect(accepted(editOf([figures]))).toBeTruthy();
    expect(figures.map(({ asset }) => asset.type)).toStrictEqual([
      "shape",
      "shape",
      "shape",
    ]);
  });

  it("sizes its box to the shape and its stroke, in whole pixels", () => {
    const { asset } = figureClipOf("rectangle", 0);

    if (asset.type !== "shape") {
      throw new Error("not a shape");
    }

    const changed = figureWith(asset, {
      size: {
        cornerRadius: 12.4,
        height: 300.6,
        kind: "rectangle",
        width: 500,
      },
      stroke: { color: "#112233", width: 4 },
    });

    expect(changed.rectangle).toStrictEqual({
      cornerRadius: 12,
      height: 301,
      width: 500,
    });
    expect([changed.width, changed.height]).toStrictEqual([508, 309]);
    expect(figureSizeOf(changed)).toStrictEqual({
      cornerRadius: 12,
      height: 301,
      kind: "rectangle",
      width: 500,
    });

    const circle = figureClipOf("circle", 0).asset;

    if (circle.type !== "shape") {
      throw new Error("not a shape");
    }

    // A stroke of no width is none: the SDK merges changes, so it stays.
    const unstroked = figureWith(
      figureWith(circle, { stroke: { color: "#000000", width: 2 } }),
      { stroke: { color: "#000000", width: 0 } }
    );

    expect(unstroked.stroke).toStrictEqual({ color: "#000000", width: 0 });
    expect([unstroked.width, unstroked.height]).toStrictEqual([400, 400]);
  });

  it("draws a shape on the timeline as one", () => {
    const tracks = tracksOf(
      editOf([[{ ...figureClipOf("line", 3), id: "s" }]])
    );

    expect(tracks[0]?.[0]).toMatchObject({ kind: "figure", start: 3 });
  });
});

describe("keyframes", () => {
  it("animates a property from its still value, and stills it again", () => {
    const clip: StudioClip = { ...figureClipOf("circle", 0), scale: 0.8 };
    const keyframes = animationOf("scale", propertyOf(clip, "scale"), 4);

    expect(keyframes).toStrictEqual([
      {
        easing: "easeInOut",
        from: 0.8,
        interpolation: "bezier",
        length: 1,
        start: 0,
        to: 1,
      },
    ]);
    expect(stillOf("scale", keyframes)).toBe(0.8);
    expect(stillOf("opacity", undefined)).toBe(1);
  });

  it("adds a keyframe after the last, changes and removes one", () => {
    const first = animationOf("rotate", 10, 4);
    const two = withKeyframeAdded(first, 4);

    expect(two[1]).toStrictEqual({
      from: 45,
      interpolation: "linear",
      length: 1,
      start: 1,
      to: 45,
    });

    // An easing goes with a curve only.
    const constant = withKeyframeChanged(two, 0, { interpolation: "constant" });

    expect(constant[0]).not.toHaveProperty("easing");
    expect(withKeyframeRemoved(constant, 0)).toStrictEqual([two[1]]);
  });

  it("writes each property where Shotstack reads it, the others kept", () => {
    const clip: StudioClip = {
      ...figureClipOf("rectangle", 0),
      offset: { x: 0.1, y: 0.2 },
      transform: { flip: { horizontal: true } },
    };

    const keyframes = animationOf("offsetY", 0.2, 4);

    expect(propertyChanges(clip, "offsetY", keyframes)).toStrictEqual({
      offset: { x: 0.1, y: keyframes },
    });
    expect(propertyChanges(clip, "rotate", 30)).toStrictEqual({
      transform: { flip: { horizontal: true }, rotate: { angle: 30 } },
    });
    expect(propertyChanges(clip, "opacity", 0.5)).toStrictEqual({
      opacity: 0.5,
    });
  });

  it("keeps a document Shotstack renders, and its timeline, with every property animated", () => {
    const clip: StudioClip = { ...figureClipOf("rectangle", 0), id: "a" };

    for (const property of [
      "opacity",
      "scale",
      "offsetX",
      "offsetY",
      "rotate",
    ] as const) {
      Object.assign(
        clip,
        propertyChanges(
          clip,
          property,
          withKeyframeAdded(
            animationOf(property, propertyOf(clip, property), 4),
            4
          )
        )
      );
    }

    const edit = editOf([[clip]]);

    expect(accepted(edit)).toBeTruthy();
    expect(tracksOf(edit)[0]?.[0]).toMatchObject({ length: 4, start: 0 });
  });
});

describe("captions", () => {
  it("lists the sounds and films words can come from, the bottom track first, as the SDK does", () => {
    const sound = clipOfMedia(
      {
        durationMs: 3000,
        id: "0190a000-0000-7000-8000-000000000004",
        kind: "audio",
      },
      0
    );

    if (sound === null) {
      throw new Error("no clip of a sound");
    }

    const edit = editOf([
      [{ ...filmClip(), alias: "voice" }],
      [{ ...figureClipOf("circle", 0), id: "figure" }],
      [{ ...sound, id: "sound-0000-0000-00000000cd34" }],
    ]);

    expect(
      captionSourcesOf(edit).map(({ alias, id }) => [id, alias])
    ).toStrictEqual([
      ["sound-0000-0000-00000000cd34", "source_0000cd34"],
      [filmClipId, "voice"],
    ]);
  });

  it("captions a film over its time, by its alias, as the server takes", () => {
    const edit = editOf([[filmClip()]]);
    const [source] = captionSourcesOf(edit);

    if (source === undefined) {
      throw new Error("no source");
    }

    expect(source.alias).toBe("source_0000ab12");

    const caption = captionClipOf(source);

    expect(caption).toMatchObject({
      asset: { src: "alias://source_0000ab12", type: "rich-caption" },
      length: 6,
      start: 2,
    });
    expect(captionSourceOf(caption)).toBe("source_0000ab12");

    const captioned = editOf([
      [caption],
      [{ ...filmClip(), alias: source.alias }],
    ]);

    expect(accepted(captioned)).toBeTruthy();
    expect(tracksOf(editOf([[{ ...caption, id: "c" }]]))[0]?.[0]?.kind).toBe(
      "caption"
    );
  });
});
