import { Result, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  editFilesOf,
  editMediaIdsOf,
  editVideoOf,
  editWithLinks,
  withOutputDefaults,
} from "#assistant/domain/edit-render.ts";
import {
  EditPlanSchema,
  SlidePlanSchema,
  SlideshowPlanSchema,
} from "#assistant/domain/slideshow.ts";

// The rules an edit is held to once Shotstack's schema accepted it, on
// synthetic edits.

const image = "019a0000-0000-7000-8000-00000000c001";
const clip = "019a0000-0000-7000-8000-00000000c006";
const voice = "019a0000-0000-7000-8000-00000000c004";

const media = (id: string) => `peal:media/${id}`;

const edit: Schema.JsonObject = {
  output: { aspectRatio: "1:1", format: "mp4", resolution: "hd" },
  timeline: {
    fonts: [{ src: "https://fonts.gstatic.com/s/synthetic/v1/synthetic.ttf" }],
    soundtrack: { src: media(voice) },
    tracks: [
      {
        clips: [
          {
            asset: { src: "<svg></svg>", type: "svg" },
            length: "end",
            start: 0,
          },
          {
            asset: { src: media(clip), type: "luma" },
            length: 2,
            start: 1,
          },
        ],
      },
      {
        clips: [
          { asset: { src: media(image), type: "image" }, length: 4, start: 0 },
          {
            asset: {
              options: { startSrc: media(image), voice: "synthetic" },
              prompt: "A synthetic harbour",
              type: "video",
            },
            length: 5.5,
            start: 4,
          },
        ],
      },
    ],
  },
};

const reasonOf = <A>(result: Result.Result<A, { readonly reason: string }>) =>
  Result.match(result, {
    onFailure: ({ reason }) => reason,
    onSuccess: () => "accepted",
  });

// One clip of a type whose source is `src`.
const withSrc = (src: string, type = "image"): Schema.JsonObject => ({
  output: {},
  timeline: {
    tracks: [{ clips: [{ asset: { src, type }, length: 1, start: 0 }] }],
  },
});

describe("an edit's files", () => {
  it("lists each library file in order, with the kinds its place takes", () => {
    const files = Result.getOrThrow(editFilesOf(edit));

    expect(
      files.map(({ kinds, mediaId }) => [mediaId, [...kinds].toSorted()])
    ).toStrictEqual([
      [clip, ["image", "video"]],
      [image, ["image"]],
      [image, ["image", "video"]],
      [voice, ["audio"]],
    ]);
    expect(editMediaIdsOf(edit)).toStrictEqual([clip, image, voice]);
  });

  it("swaps each for its link, and nothing else", () => {
    const links = new Map([
      [image, "https://media.example.com/signed/image"],
      [clip, "https://media.example.com/signed/clip"],
      [voice, "https://media.example.com/signed/voice"],
    ]);

    const linked = editWithLinks(edit, links);

    expect(editMediaIdsOf(linked)).toStrictEqual([]);
    expect(linked).toMatchObject({
      timeline: {
        fonts: [
          { src: "https://fonts.gstatic.com/s/synthetic/v1/synthetic.ttf" },
        ],
        soundtrack: { src: "https://media.example.com/signed/voice" },
        tracks: [
          {
            clips: [
              { asset: { src: "<svg></svg>", type: "svg" } },
              { asset: { src: "https://media.example.com/signed/clip" } },
            ],
          },
          {
            clips: [
              { asset: { src: "https://media.example.com/signed/image" } },
              {
                asset: {
                  options: {
                    startSrc: "https://media.example.com/signed/image",
                    voice: "synthetic",
                  },
                },
              },
            ],
          },
        ],
      },
    });
  });

  it("refuses an address that is not the library's, and a font from the library", () => {
    expect(
      [
        withSrc("https://media.example.com/x.png"),
        withSrc("//media.example.com/x.png"),
        withSrc("alias://voice"),
        withSrc("alias://voice", "rich-caption"),
        withSrc("data:image/png;base64,AAAA"),
        {
          output: {},
          timeline: { fonts: [{ src: media(image) }], tracks: [] },
        },
      ].map((each) => reasonOf(editFilesOf(each)))
    ).toStrictEqual([
      "editInvalid",
      "editInvalid",
      "editInvalid",
      "accepted",
      "editInvalid",
      "mediaNotSupported",
    ]);
  });
});

// An edit of one clip that starts and lasts as given.
const ending = (start: Schema.Json, length: Schema.Json) =>
  editVideoOf({
    output: { format: "mp4", resolution: "1080" },
    timeline: {
      tracks: [{ clips: [{ asset: { type: "html" }, length, start }] }],
    },
  });

describe("an edit's output, size and length", () => {
  it("gives the job's aspect and the latest numeric end", () => {
    expect(Result.getOrThrow(editVideoOf(edit))).toStrictEqual({
      aspect: "square",
      durationSeconds: 9.5,
    });
  });

  it("fills in an MP4 at 1080p in 16:9 where the edit says none", () => {
    expect(withOutputDefaults({ timeline: {} })).toStrictEqual({
      output: { aspectRatio: "16:9", format: "mp4", resolution: "1080" },
      timeline: {},
    });
    expect(
      withOutputDefaults({ output: { aspectRatio: "9:16", resolution: "sd" } })
    ).toStrictEqual({
      output: { aspectRatio: "9:16", format: "mp4", resolution: "sd" },
    });
    // A size stands for a resolution, which Peal then refuses.
    expect(
      withOutputDefaults({ output: { size: { height: 10, width: 10 } } })
    ).toStrictEqual({
      output: {
        aspectRatio: "16:9",
        format: "mp4",
        size: { height: 10, width: 10 },
      },
    });
  });

  it("counts only clips whose start and length are numbers, up to 300 seconds", () => {
    expect(
      [
        ending(0, 300),
        ending(299.5, 1),
        ending("auto", 400),
        ending(10, "end"),
      ].map((result) =>
        Result.match(result, {
          onFailure: ({ reason }) => reason,
          onSuccess: ({ durationSeconds }) => durationSeconds,
        })
      )
    ).toStrictEqual([300, "editTooLong", 0, 0]);
  });
});

describe("a job's stored plan", () => {
  it("reads a slide plan as earlier releases wrote it, and an edit plan", () => {
    const slides = {
      secondsPerSlide: 4,
      slides: [{ caption: null, mediaId: image, motion: "none" }],
      transition: "fade",
    };

    const decode = Schema.decodeUnknownSync(SlideshowPlanSchema);

    expect(Schema.is(SlidePlanSchema)(decode(slides))).toBeTruthy();
    expect(decode(slides)).toStrictEqual(slides);
    expect(Schema.is(EditPlanSchema)(decode({ edit }))).toBeTruthy();
    expect(decode({ edit })).toStrictEqual({ edit });
  });
});
