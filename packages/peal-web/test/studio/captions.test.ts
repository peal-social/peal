import { describe, expect, it } from "@effect/vitest";
import { editSchema } from "@shotstack/schemas/zod";

import { captionClipOf, captionsLackSource } from "#studio/captions.ts";
import { emptyEdit, mediaRefOf, textClipOf } from "#studio/edit-document.ts";
import type { StudioClip, StudioEdit } from "#studio/edit-document.ts";

const film: StudioClip = {
  alias: "interview",
  asset: {
    src: mediaRefOf("0190a000-0000-7000-8000-000000000003"),
    type: "video",
  },
  length: 6,
  start: 2,
};

const withCaptions = (edit: StudioEdit): StudioEdit => {
  const clip = captionClipOf(edit);

  return {
    ...edit,
    timeline: {
      ...edit.timeline,
      tracks: [
        ...(clip === null ? [] : [{ clips: [clip] }]),
        ...edit.timeline.tracks,
      ],
    },
  };
};

describe("the editor's captions", () => {
  it("caption a film for as long as it plays, as Shotstack's schema takes them", () => {
    const edit = withCaptions(emptyEdit([film]));
    const [caption] = edit.timeline.tracks[0]?.clips ?? [];

    expect([
      caption?.asset.type,
      caption?.start,
      caption?.length,
      editSchema.safeParse(structuredClone(edit)).success,
    ]).toStrictEqual(["rich-caption", 2, 6, true]);
  });

  it("are known to lack the clip they name", () => {
    const edit = withCaptions(emptyEdit([film]));

    const alone = emptyEdit(edit.timeline.tracks[0]?.clips ?? []);

    expect([
      captionsLackSource(edit),
      captionsLackSource(alone),
      captionsLackSource(emptyEdit([film])),
    ]).toStrictEqual([false, true, false]);
  });

  it("need a sound or a film", () => {
    expect(captionClipOf(emptyEdit([textClipOf("Hello", 0)]))).toBeNull();
  });
});
