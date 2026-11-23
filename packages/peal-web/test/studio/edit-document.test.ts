import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import { draftOf, storedDraftOf } from "#studio/draft.ts";
import {
  clipOfMedia,
  emptyEdit,
  endOf,
  mediaIdOfRef,
  mediaIdsOf,
  mediaRefOf,
  previewOf,
  storedOf,
  textClipOf,
  tracksOf,
} from "#studio/edit-document.ts";
import type { StudioClip, StudioEdit } from "#studio/edit-document.ts";

const origin = "https://app.example.com";
const picture = "0190a000-0000-7000-8000-000000000001";
const sound = "0190a000-0000-7000-8000-000000000002";
const font = "https://fonts.gstatic.com/s/inter/v20/abc.ttf";

// The clip a library file makes, with the id the SDK would give it.
const clipWithId = (
  file: Parameters<typeof clipOfMedia>[0],
  id: string
): StudioClip => {
  const clip = clipOfMedia(file, 0);

  if (clip === null) {
    throw new Error("no clip of this file");
  }

  return { ...clip, id };
};

const edit: StudioEdit = {
  output: { aspectRatio: "9:16", format: "mp4" },
  timeline: {
    fonts: [{ src: font }],
    tracks: [
      {
        clips: [{ ...textClipOf("Hello", 1), id: "t1" }],
      },
      {
        clips: [
          clipWithId({ durationMs: null, id: picture, kind: "image" }, "p1"),
          {
            asset: { src: mediaRefOf(picture), type: "image" },
            id: "p2",
            length: "auto",
            start: "auto",
          },
        ],
      },
      {
        clips: [
          clipWithId({ durationMs: 12_340, id: sound, kind: "audio" }, "s1"),
        ],
      },
    ],
  },
};

const pictureAddress =
  "https://bucket.example.com/picture.png?signature=synthetic";

const addresses = new Map([
  [picture, pictureAddress],
  [sound, "https://bucket.example.com/sound.mp3?signature=synthetic"],
]);

describe("the editor's document", () => {
  it("names library files, and reads the name back", () => {
    expect([
      mediaRefOf(picture),
      mediaIdOfRef(`peal:media/${picture}`),
      mediaIdOfRef("peal:media/"),
      mediaIdOfRef("https://example.com/a.png"),
    ]).toStrictEqual([`peal:media/${picture}`, picture, null, null]);
  });

  it("previews files by address and fonts through the relay, and stores them back by name", () => {
    const shown = previewOf(edit, (id) => addresses.get(id) ?? null, origin);

    const stored = storedOf(
      shown,
      (address) =>
        [...addresses].find(([, each]) => each === address)?.[0] ?? null,
      origin
    );

    expect([
      JSON.stringify(shown).includes(pictureAddress),
      JSON.stringify(shown).includes(
        `${origin}/studio-assets/fonts.gstatic.com/`
      ),
      JSON.stringify(shown).includes("peal:media/"),
      stored,
    ]).toStrictEqual([true, true, false, edit]);
  });

  it("leaves a file the library no longer has by its name", () => {
    const shown = previewOf(edit, () => null, origin);

    expect(mediaIdsOf(shown)).toStrictEqual([picture, sound]);
  });

  it("lays out clips with numbers, a clip of `auto` timing after the one before", () => {
    const tracks = tracksOf(edit);

    expect([
      tracks.map((track) => track.map(({ id, kind }) => `${id}:${kind}`)),
      tracks[1]?.[1],
      tracks[2]?.[0]?.length,
      endOf(tracks),
    ]).toStrictEqual([
      [["t1:text"], ["p1:image", "p2:image"], ["s1:audio"]],
      {
        id: "p2",
        kind: "image",
        length: 4,
        mediaId: picture,
        start: 4,
        text: null,
        trackIndex: 1,
      },
      12.3,
      12.3,
    ]);
  });

  it("makes no clip of a document", () => {
    expect(
      clipOfMedia({ durationMs: null, id: picture, kind: "document" }, 0)
    ).toBeNull();
  });

  it("keeps a draft as text and reads it back, and reads nothing else", () => {
    expect([
      draftOf(storedDraftOf(emptyEdit("1:1"))),
      draftOf("not json"),
      draftOf(JSON.stringify({ edit: emptyEdit(), version: 2 })),
      draftOf(null),
    ]).toStrictEqual([
      Option.some(emptyEdit("1:1")),
      Option.none(),
      Option.none(),
      Option.none(),
    ]);
  });
});
