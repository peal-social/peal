import { Schema } from "effect";

import type { StudioClip, StudioEdit } from "#studio/edit-document.ts";

// Captions: Shotstack's rich captions, whose words Shotstack transcribes
// from another clip as it renders; the preview shows placeholder words.
// The SDK links a caption added to the first sound or film it finds (the
// bottom track first), whatever alias it names, and its toolbar chooses
// another.

const isSeconds = Schema.is(Schema.Finite);

// How long a caption lasts over a clip of `auto` timing.
const captionSeconds = 4;

// What has a voice to transcribe.
const voiced: ReadonlySet<StudioClip["asset"]["type"]> = new Set([
  "audio",
  "text-to-speech",
  "video",
]);

/**
 * Captions over the sound or film the SDK links them to, for as long as it
 * plays: white words on a dark band at the foot, the one spoken in
 * lavender. None in an edit without a sound or a film.
 */
export const captionClipOf = (edit: StudioEdit): StudioClip | null => {
  const source = edit.timeline.tracks
    .toReversed()
    .flatMap(({ clips }) => clips)
    .find(({ asset }) => voiced.has(asset.type));

  if (source === undefined) {
    return null;
  }

  return {
    asset: {
      active: { font: { color: "#b9a6ff" } },
      align: { horizontal: "center", vertical: "middle" },
      animation: { style: "highlight" },
      background: { color: "#000000", opacity: 0.6 },
      font: { color: "#ffffff", family: "Geist", size: 56, weight: 700 },
      src: `alias://${source.alias ?? "source"}`,
      type: "rich-caption",
    },
    height: 280,
    length: isSeconds(source.length) ? source.length : captionSeconds,
    offset: { x: 0, y: 0.05 },
    position: "bottom",
    start: isSeconds(source.start) ? source.start : 0,
    width: 900,
  };
};
