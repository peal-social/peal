import type { components } from "@shotstack/schemas";
import { Schema } from "effect";
import type { ImageAspect, Media } from "peal-contract";

import { relayedAddressOf, upstreamAddressOf } from "#studio/asset-relay.ts";

// The editor's document is Shotstack's Edit, as the Studio SDK keeps it
// and as the server renders it. Library files are named `peal:media/<id>`
// wherever the document is stored or sent; the preview swaps each for the
// file's address, and the export swaps it back.

export type StudioEdit = components["schemas"]["Edit"];

export type StudioClip = components["schemas"]["Clip"];

export type StudioTrack = components["schemas"]["Track"];

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

// The SDK's size menu writes a size, where the server takes one of three
// aspects at a resolution: the sizes it offers, as those.
const outputs: ReadonlyMap<
  string,
  Pick<StudioEdit["output"], "aspectRatio" | "resolution">
> = new Map([
  ["1080x1080", { aspectRatio: "1:1", resolution: "1080" }],
  ["1080x1920", { aspectRatio: "9:16", resolution: "1080" }],
  ["1280x720", { aspectRatio: "16:9", resolution: "hd" }],
  ["1920x1080", { aspectRatio: "16:9", resolution: "1080" }],
]);

// The output with its size as an aspect and a resolution; a size the
// server has no word for stays, and the server says so.
const sizedOutput = (output: StudioEdit["output"]): StudioEdit["output"] => {
  const { size, ...rest } = output;
  const named = outputs.get(`${size?.width}x${size?.height}`);

  return named === undefined ? output : { ...rest, ...named };
};

// The SDK adds a font it has by the relay's address again by its host's.
const eachOnce = (
  fonts: NonNullable<StudioEdit["timeline"]["fonts"]>
): NonNullable<StudioEdit["timeline"]["fonts"]> => [
  ...new Map(fonts.map((font) => [font.src, font])).values(),
];

/**
 * The document as it is stored and sent: each library file's address
 * swapped back for its name, each relayed address back to its host's, each
 * font once, and the size chosen as the server names it. An address the editor did not
 * hand out stays.
 */
export const storedOf = (
  edit: StudioEdit,
  mediaIdOf: (address: string) => string | null,
  origin: string
): StudioEdit => {
  const stored = withSources(edit, (src) => {
    const mediaId = mediaIdOf(src);

    return mediaId === null
      ? upstreamAddressOf(src, origin)
      : mediaRefOf(mediaId);
  });

  const { fonts } = stored.timeline;

  return {
    ...stored,
    output: sizedOutput(stored.output),
    timeline:
      fonts === undefined
        ? stored.timeline
        : { ...stored.timeline, fonts: eachOnce(fonts) },
  };
};

type GenerativeAsset = Extract<
  StudioAsset,
  { readonly type: "audio" | "image" | "video" }
>;

// The assets a prompt may make, as the editor adds them.
const isGenerative = (asset: StudioAsset): asset is GenerativeAsset =>
  asset.type === "audio" || asset.type === "image" || asset.type === "video";

/**
 * Whether a clip still waits to be generated: a prompt and no file. Sent
 * as it is, Shotstack would generate it, at the cost of the workspace's
 * Shotstack account.
 */
export const waitsToBeGenerated = (edit: StudioEdit): boolean =>
  edit.timeline.tracks.some(({ clips }) =>
    clips.some(
      ({ asset }) =>
        isGenerative(asset) &&
        asset.prompt !== undefined &&
        asset.src === undefined
    )
  );

// An asset made from a prompt is its file alone: with the prompt, the
// render would generate it again.
const generatedAsset = (asset: StudioAsset): StudioAsset => {
  if (!isGenerative(asset) || asset.src === undefined) {
    return asset;
  }

  const { model: _model, options: _options, prompt: _prompt, ...rest } = asset;

  return rest;
};

/** The document as it is rendered: what was generated, by its file alone. */
export const renderedOf = (edit: StudioEdit): StudioEdit => ({
  ...edit,
  timeline: {
    ...edit.timeline,
    tracks: edit.timeline.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => ({
        ...clip,
        asset: generatedAsset(clip.asset),
      })),
    })),
  },
});

/** The shape an image made for the edit takes. */
export const imageAspectOf = (edit: StudioEdit): ImageAspect => {
  const { aspectRatio } = sizedOutput(edit.output);

  if (aspectRatio === "16:9") {
    return "landscape";
  }

  return aspectRatio === "1:1" ? "square" : "portrait";
};

/** A picture to generate from a prompt, at `start`. */
export const promptedImageOf = (prompt: string, start: number): StudioClip => ({
  asset: { prompt, type: "image" },
  fit: "crop",
  length: stillSeconds,
  start,
});

/** A new portrait edit of these clips, on one track. */
export const emptyEdit = (clips: readonly StudioClip[]): StudioEdit => ({
  output: { aspectRatio: "9:16", format: "mp4", fps: 25, resolution: "1080" },
  timeline: { background: "#000000", tracks: [{ clips: [...clips] }] },
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

const isSeconds = Schema.is(Schema.Finite);

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

    at =
      Math.round(
        (at + (isSeconds(clip.length) ? clip.length : stillSeconds)) * 10
      ) / 10;

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
