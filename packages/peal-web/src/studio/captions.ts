import { Schema } from "effect";

import { mediaIdOfRef } from "#studio/edit-document.ts";
import type { AssetOf, StudioClip, StudioEdit } from "#studio/edit-document.ts";

// Captions: Shotstack's rich captions, whose words Shotstack transcribes
// from another clip of the edit, named by its alias (`alias://<alias>`).
// The SDK shows placeholder words in the preview until the render, and,
// as it adds a caption's track, links it to the first sound or film it
// finds (the bottom track first) and gives that clip an alias of its
// own making, `source_` and its id's last eight characters. The editor
// lists the same clips in the same order and names them the same way, so
// the caption it adds is the one the SDK keeps, and another clip chosen
// gets the alias the SDK would give it. Shotstack's older caption asset,
// from a subtitle file, is deprecated, and the server takes a caption's
// source from another clip or a sound or a film of the library only.

export type CaptionAsset = AssetOf<"rich-caption">;

/** A clip whose words a caption may show. */
export interface CaptionSource {
  /** The alias a caption names it by: its own, or the one the SDK gives. */
  readonly alias: string;
  readonly id: string;
  readonly kind: "audio" | "video";
  readonly length: number;
  /** The library file it plays, when it plays one. */
  readonly mediaId: string | null;
  readonly start: number;
}

const aliasPrefix = "alias://";

// The SDK's sources: what speaks.
const spokenKinds: ReadonlyMap<string, "audio" | "video"> = new Map([
  ["audio", "audio"],
  ["text-to-speech", "audio"],
  ["video", "video"],
]);

const isSeconds = Schema.is(Schema.Finite);

// How long a caption lasts over a clip of `auto` timing.
const captionSeconds = 4;

/** The alias the SDK gives a clip without one: `source_` and its id's end. */
export const sdkAliasOf = (clipId: string): string =>
  `source_${clipId.slice(-8).replaceAll(/[^\w-]/gu, "_")}`;

const sourceOf = (clip: StudioClip): CaptionSource | null => {
  const kind = spokenKinds.get(clip.asset.type);

  if (kind === undefined || clip.id === undefined) {
    return null;
  }

  return {
    alias: clip.alias ?? sdkAliasOf(clip.id),
    id: clip.id,
    kind,
    length: isSeconds(clip.length) ? clip.length : captionSeconds,
    mediaId:
      "src" in clip.asset && clip.asset.src !== undefined
        ? mediaIdOfRef(clip.asset.src)
        : null,
    start: isSeconds(clip.start) ? clip.start : 0,
  };
};

/**
 * The sounds and films of the edit a caption may take its words from, in
 * the order the SDK reads them: the bottom track first, each track's clips
 * in order. Clips need the SDK's ids.
 */
export const captionSourcesOf = (edit: StudioEdit): readonly CaptionSource[] =>
  edit.timeline.tracks.toReversed().flatMap(({ clips }) =>
    clips.flatMap((clip) => {
      const source = sourceOf(clip);

      return source === null ? [] : [source];
    })
  );

/** The alias a caption's words come from, or none. */
export const captionSourceOf = (clip: StudioClip): string | null => {
  const { asset } = clip;

  return asset.type === "rich-caption" && asset.src.startsWith(aliasPrefix)
    ? asset.src.slice(aliasPrefix.length)
    : null;
};

/** A caption's source as the document names it. */
export const captionSrcOf = (source: Pick<CaptionSource, "alias">): string =>
  `${aliasPrefix}${source.alias}`;

/**
 * A caption over a sound or a film, for as long as it plays: white words
 * in Peal's font on a dark band at the foot of the frame, the word spoken
 * in the brand's lavender.
 */
export const captionClipOf = (source: CaptionSource): StudioClip => ({
  asset: {
    active: { font: { color: "#b9a6ff" } },
    align: { horizontal: "center", vertical: "middle" },
    animation: { style: "highlight" },
    background: { color: "#000000", opacity: 0.6 },
    font: { color: "#ffffff", family: "Geist", size: 56, weight: 700 },
    src: captionSrcOf(source),
    type: "rich-caption",
  },
  height: 280,
  length: source.length,
  offset: { x: 0, y: 0.05 },
  position: "bottom",
  start: source.start,
  width: 900,
});
