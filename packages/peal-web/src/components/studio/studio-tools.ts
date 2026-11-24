import { captionClipOf } from "#studio/captions.ts";
import { textClipOf } from "#studio/edit-document.ts";
import { figureClipOf } from "#studio/figures.ts";
import type { FigureKind } from "#studio/figures.ts";

import type { Studio } from "./studio-engine.ts";

/** A button of the SDK's toolbar beside the preview. */
export interface StudioTool {
  /** The SDK takes its icons as SVG text. */
  readonly icon: string;
  readonly id: string;
  readonly label: string;
  readonly onPress: (studio: Studio) => void;
}

const iconOf = (paths: string): string =>
  `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

/** A text over the others, at the playhead. */
export const textTool = (label: string, words: string): StudioTool => ({
  icon: iconOf('<path d="M3 3H13"/><path d="M8 3V13"/><path d="M5 13H11"/>'),
  id: "text",
  label,
  onPress: (studio) => {
    void studio.addTrack("over", [textClipOf(words, studio.time())]);
  },
});

const figureIcons: Readonly<Record<FigureKind, string>> = {
  circle: iconOf('<circle cx="8" cy="8" r="6"/>'),
  rectangle: iconOf('<rect x="2" y="3.5" width="12" height="9" rx="1"/>'),
};

/** A shape over the others, at the playhead. */
export const figureTool = (kind: FigureKind, label: string): StudioTool => ({
  icon: figureIcons[kind],
  id: kind,
  label,
  onPress: (studio) => {
    void studio.addTrack("over", [figureClipOf(kind, studio.time())]);
  },
});

/** Captions of a sound or a film; `onNoVoice` where the video has neither. */
export const captionsTool = (
  label: string,
  onNoVoice: () => void
): StudioTool => ({
  icon: iconOf(
    '<rect x="1.5" y="3" width="13" height="10" rx="2"/><path d="M4 8H7"/><path d="M9 8H12"/><path d="M4 10.5H9"/><path d="M11 10.5H12"/>'
  ),
  id: "captions",
  label,
  onPress: (studio) => {
    const clip = captionClipOf(studio.getEdit());

    if (clip === null) {
      onNoVoice();
    } else {
      void studio.addTrack("over", [clip]);
    }
  },
});
