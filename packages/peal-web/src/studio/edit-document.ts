import type { components } from "@shotstack/schemas";
import { Schema } from "effect";
import type { Media } from "peal-contract";

import { relayedAddressOf, upstreamAddressOf } from "#studio/asset-relay.ts";

// The editor's document is Shotstack's Edit, as the Studio SDK keeps it
// and as the server renders it. Library files are named `peal:media/<id>`
// wherever the document is stored or sent; the preview swaps each for the
// file's address, and the export swaps it back.

export type StudioEdit = components["schemas"]["Edit"];

export type StudioClip = components["schemas"]["Clip"];

export type StudioTrack = components["schemas"]["Track"];

export type StudioOutput = components["schemas"]["Output"];

/** A clip's changes: a field set to undefined is taken off the clip. */
export type ClipChanges = {
  readonly [Field in keyof StudioClip]?: StudioClip[Field] | undefined;
};

/** A clip's asset of one kind, as Shotstack's schema has it. */
export type AssetOf<Kind extends StudioClip["asset"]["type"]> = Extract<
  StudioClip["asset"],
  { readonly type: Kind }
>;

/** The prefix of a library file's name in a document. */
export const mediaRefPrefix = "peal:media/";

/** A library file's name in a document. */
export const mediaRefOf = (mediaId: string): string =>
  `${mediaRefPrefix}${mediaId}`;

/** The library file a document's `src` names, or null. */
export const mediaIdOfRef = (src: string): string | null =>
  src.startsWith(mediaRefPrefix) && src.length > mediaRefPrefix.length
    ? src.slice(mediaRefPrefix.length)
    : null;

type StudioAsset = StudioClip["asset"];

// An asset with its file swapped, for the kinds that take a file (images,
// videos, sounds, lumas, captions, SVGs, AI inputs).
const withAssetSource = (
  asset: StudioAsset,
  swap: (src: string) => string
): StudioAsset =>
  "src" in asset && asset.src !== undefined
    ? { ...asset, src: swap(asset.src) }
    : asset;

// Every `src` the editor writes (each clip's asset, the fonts), replaced
// as `swap` says; the rest of the document as it is. The editor puts
// sound on tracks, never in the soundtrack Shotstack deprecates.
const withSources = (
  edit: StudioEdit,
  swap: (src: string) => string
): StudioEdit => {
  const timeline: StudioEdit["timeline"] = {
    ...edit.timeline,
    tracks: edit.timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => ({
        ...clip,
        asset: withAssetSource(clip.asset, swap),
      })),
    })),
  };

  if (edit.timeline.fonts !== undefined) {
    timeline.fonts = edit.timeline.fonts.map((font) => ({
      ...font,
      src: swap(font.src),
    }));
  }

  return { ...edit, timeline };
};

/**
 * The document as the preview loads it: each library file's name swapped
 * for its address, a file the library no longer has left as it is (the
 * preview shows it as missing), and a font of a host the relay stands in
 * for fetched through the relay at `origin`.
 */
export const previewOf = (
  edit: StudioEdit,
  addressOf: (mediaId: string) => string | null,
  origin: string
): StudioEdit =>
  withSources(edit, (src) => {
    const mediaId = mediaIdOfRef(src);

    return mediaId === null
      ? relayedAddressOf(src, origin)
      : (addressOf(mediaId) ?? src);
  });

/** A clip as the preview loads it: its file by address. */
export const clipPreviewOf = (
  clip: StudioClip,
  addressOf: (mediaId: string) => string | null,
  origin: string
): StudioClip => ({
  ...clip,
  asset: withAssetSource(clip.asset, (src) => {
    const mediaId = mediaIdOfRef(src);

    return mediaId === null
      ? relayedAddressOf(src, origin)
      : (addressOf(mediaId) ?? src);
  }),
});

/**
 * The document as it is stored and sent: each library file's address
 * swapped back for its name, each relayed address back to its host's. An
 * address the editor did not hand out stays.
 */
export const storedOf = (
  edit: StudioEdit,
  mediaIdOf: (address: string) => string | null,
  origin: string
): StudioEdit =>
  withSources(edit, (src) => {
    const mediaId = mediaIdOf(src);

    return mediaId === null
      ? upstreamAddressOf(src, origin)
      : mediaRefOf(mediaId);
  });

/** The video's shape: Shotstack's aspect ratios the server renders. */
export const editAspects = ["9:16", "16:9", "1:1"] as const;

export type EditAspect = (typeof editAspects)[number];

/** The resolutions the server renders, smallest first. */
export const editResolutions = ["sd", "hd", "1080"] as const;

export type EditResolution = (typeof editResolutions)[number];

/** The frame rates offered. */
export const editFrameRates = [24, 25, 30] as const;

/** The video's settings as the editor offers them, each with its default. */
export interface EditSettings {
  readonly aspectRatio: EditAspect;
  readonly background: string;
  readonly fps: number;
  readonly resolution: EditResolution;
}

/** The document's settings, those the editor does not offer read as its defaults. */
export const settingsOf = (edit: StudioEdit): EditSettings => ({
  aspectRatio:
    editAspects.find((each) => each === edit.output.aspectRatio) ?? "9:16",
  background: edit.timeline.background ?? "#000000",
  fps: editFrameRates.find((each) => each === edit.output.fps) ?? 25,
  resolution:
    editResolutions.find((each) => each === edit.output.resolution) ?? "1080",
});

/**
 * Fonts the text tools offer: in the Studio SDK's catalogue, so the
 * preview draws them, and Google's, so the render has them.
 */
export const editFonts = [
  "Geist",
  "Inter",
  "Montserrat",
  "Open Sans",
  "Roboto",
  "Poppins",
  "DM Sans",
  "Work Sans",
  "Oswald",
  "Bebas Neue",
  "Playfair Display",
  "Lora",
  "Permanent Marker",
] as const;

/** A new edit: one empty track, in the shape and resolution given. */
export const emptyEdit = (aspect: EditAspect = "9:16"): StudioEdit => ({
  output: { aspectRatio: aspect, format: "mp4", fps: 25, resolution: "1080" },
  timeline: { background: "#000000", tracks: [{ clips: [] }] },
});

// How long a still or a text shows when it is added.
const stillSeconds = 4;

// A file's length in seconds, when the library knows it.
const secondsOf = (media: Pick<Media, "durationMs">): number | null =>
  media.durationMs === null ? null : Math.round(media.durationMs / 100) / 10;

/** The clip a library file makes, at `start`. */
export const clipOfMedia = (
  media: Pick<Media, "durationMs" | "id" | "kind">,
  start: number
): StudioClip | null => {
  const src = mediaRefOf(media.id);
  const length = secondsOf(media) ?? stillSeconds;

  const clips: Readonly<Record<Media["kind"], StudioClip | null>> = {
    audio: { asset: { src, type: "audio", volume: 1 }, length, start },
    document: null,
    image: {
      asset: { src, type: "image" },
      fit: "crop",
      length: stillSeconds,
      start,
    },
    video: {
      asset: { src, type: "video", volume: 1 },
      fit: "crop",
      length,
      start,
    },
  };

  return clips[media.kind];
};

/** Library files as clips one after the other from `start`, documents left out. */
export const laidEnd = (
  files: readonly Pick<Media, "durationMs" | "id" | "kind">[],
  start: number
): readonly StudioClip[] => {
  let at = start;

  return files.flatMap((media) => {
    const clip = clipOfMedia(media, at);

    if (clip === null) {
      return [];
    }

    at = Math.round((at + timingOf(clip.length, stillSeconds)) * 10) / 10;

    return [clip];
  });
};

/** Whether the document holds a clip, as the SDK needs one to load. */
export const hasClips = (edit: StudioEdit): boolean =>
  edit.timeline.tracks.some((track) => track.clips.length > 0);

/** A text clip at `start`: centred, white, in Peal's own font. */
export const textClipOf = (text: string, start: number): StudioClip => ({
  asset: {
    align: { horizontal: "center", vertical: "middle" },
    font: { color: "#ffffff", family: "Geist", size: 64, weight: 700 },
    text,
    type: "rich-text",
  },
  height: 240,
  length: stillSeconds,
  start,
  width: 900,
});

/** What a clip holds, as the timeline names and draws it. */
export type ClipKind =
  | "audio"
  | "caption"
  | "figure"
  | "image"
  | "other"
  | "text"
  | "video";

// What Shotstack's assets show, as the timeline draws them; any other
// (an HTML page, a luma matte) is a clip of its own kind.
const kinds: ReadonlyMap<StudioAsset["type"], ClipKind> = new Map([
  ["audio", "audio"],
  ["caption", "caption"],
  ["html", "text"],
  ["image", "image"],
  ["image-to-video", "video"],
  ["rich-caption", "caption"],
  ["rich-text", "text"],
  ["shape", "figure"],
  ["svg", "image"],
  ["text", "text"],
  ["text-to-image", "image"],
  ["text-to-speech", "audio"],
  ["title", "text"],
  ["video", "video"],
]);

const kindOf = (clip: StudioClip): ClipKind =>
  kinds.get(clip.asset.type) ?? "other";

/** A clip as the timeline lays it out. */
export interface ClipView {
  /** The SDK's stable id, which every change names. */
  readonly id: string;
  readonly kind: ClipKind;
  readonly length: number;
  /** The library file it shows, when it shows one. */
  readonly mediaId: string | null;
  readonly start: number;
  /** The words it shows, for a text. */
  readonly text: string | null;
  readonly trackIndex: number;
}

// A clip's timing in seconds: a number as written, else where it falls
// (after the clip before it, or the length a file or a still has).
const isSeconds = Schema.is(Schema.Finite);

const timingOf = (value: number | string, fallback: number): number =>
  isSeconds(value) ? value : fallback;

const textOf = ({ asset }: StudioClip): string | null =>
  "text" in asset && asset.text !== undefined ? asset.text : null;

const mediaOf = ({ asset }: StudioClip): string | null =>
  "src" in asset && asset.src !== undefined ? mediaIdOfRef(asset.src) : null;

/**
 * The document's tracks as the timeline draws them, the first track on
 * top as Shotstack layers them. Clips need the ids the SDK gives
 * (`getEdit({ includeIds: true })`); one without is left out.
 */
export const tracksOf = (edit: StudioEdit): readonly (readonly ClipView[])[] =>
  edit.timeline.tracks.map((track, trackIndex) => {
    let end = 0;

    return track.clips.flatMap((clip) => {
      const { id } = clip;
      const start = timingOf(clip.start, end);
      const length = timingOf(clip.length, stillSeconds);

      end = start + length;

      return id === undefined
        ? []
        : [
            {
              id,
              kind: kindOf(clip),
              length,
              mediaId: mediaOf(clip),
              start,
              text: textOf(clip),
              trackIndex,
            },
          ];
    });
  });

/** Where the video ends: the latest end of any clip. */
export const endOf = (tracks: readonly (readonly ClipView[])[]): number =>
  Math.max(0, ...tracks.flat().map(({ length, start }) => start + length));

/** Every library file the document names, in order, each once. */
export const mediaIdsOf = (edit: StudioEdit): readonly string[] => {
  const found = new Set<string>();

  withSources(edit, (src) => {
    const mediaId = mediaIdOfRef(src);

    if (mediaId !== null) {
      found.add(mediaId);
    }

    return src;
  });

  return [...found];
};
