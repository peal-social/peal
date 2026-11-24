"use client";

import { Schema } from "effect";

import { relayedAddressOf, relayedSourceOf } from "#studio/asset-relay.ts";
import type {
  StudioClip,
  StudioEdit,
  StudioTrack,
} from "#studio/edit-document.ts";

// Shotstack's Studio SDK, whole: its document, preview, timeline, toolbars
// and keys. Peal starts and stops it, and adds library files and texts.

/** What the editor asks of the SDK. */
export interface Studio {
  /** Puts clips on a track of their own: over the others, or under them. */
  readonly addTrack: (
    place: "over" | "under",
    clips: readonly StudioClip[]
  ) => Promise<void>;
  readonly dispose: () => void;
  /** The document as it stands, without the SDK's ids. */
  readonly getEdit: () => StudioEdit;
  /** Calls `listener` after each change to the document. */
  readonly onChange: (listener: () => void) => () => void;
  readonly pause: () => void;
  /** The playhead, in seconds. */
  readonly time: () => number;
}

const isText = Schema.is(Schema.String);

// A request with a relayed host's address sent through the relay.
const relayedInput = (
  input: Request | URL | string,
  origin: string
): Request | URL | string => {
  if (input instanceof Request) {
    const address = relayedAddressOf(input.url, origin);

    return address === input.url ? input : new Request(address, input);
  }

  const address = relayedAddressOf(String(input), origin);

  return address === String(input) ? input : address;
};

/**
 * Sends the SDK's downloads from the five hosts the relay stands in for
 * through it, while the editor runs: its catalogue of Google fonts names
 * each font's address, which it fetches or hands `FontFace` as it loads
 * one. Only those hosts' addresses change; the patch rewrites the SDK's
 * other address constants. Answers what puts `fetch` and `FontFace`
 * back.
 */
const relayFetches = (origin: string): (() => void) => {
  const { FontFace: OriginalFontFace, fetch: originalFetch } = globalThis;

  globalThis.fetch = async (input, init) =>
    await originalFetch(relayedInput(input, origin), init);

  globalThis.FontFace = class extends OriginalFontFace {
    constructor(
      family: string,
      source: BufferSource | string,
      descriptors?: FontFaceDescriptors
    ) {
      super(
        family,
        isText(source) ? relayedSourceOf(source, origin) : source,
        descriptors
      );
    }
  };

  return () => {
    globalThis.fetch = originalFetch;
    globalThis.FontFace = OriginalFontFace;
  };
};

/** The element the SDK's preview and toolbars go in, which it finds by itself. */
export const canvasAttribute = "data-shotstack-studio";

// The SDK's toolbar takes its icons as SVG text.
const textIcon =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3H13"/><path d="M8 3V13"/><path d="M5 13H11"/></svg>';

// Keeps the preview fitted to its box.
const fitted = (fit: () => void): (() => void) => {
  const stage = document.querySelector(`[${canvasAttribute}]`);
  const observer = new ResizeObserver(fit);

  if (stage !== null) {
    observer.observe(stage);
  }

  return () => {
    observer.disconnect();
  };
};

/**
 * Loads the SDK in the browser and starts it on `initial`, which holds a
 * clip at least: its preview and toolbars in the page's element with
 * `canvasAttribute`, its timeline in `timelineBox`.
 */
export const startStudio = async ({
  addTextLabel,
  initial,
  onAddText,
  timelineBox,
}: {
  readonly addTextLabel: string;
  readonly initial: StudioEdit;
  readonly onAddText: (studio: Studio) => void;
  readonly timelineBox: HTMLElement;
}): Promise<Studio> => {
  const stops = [relayFetches(window.location.origin)];

  const dispose = () => {
    for (const stop of stops.toReversed()) {
      stop();
    }
  };

  try {
    const sdk = await import("@shotstack/shotstack-studio");
    const edit = new sdk.Edit(initial);
    const canvas = new sdk.Canvas(edit);
    const ui = sdk.UIController.create(edit, canvas);

    const studio: Studio = {
      addTrack: async (place, clips) => {
        const track: StudioTrack = { clips: [...clips] };

        await edit.addTrack(
          place === "over" ? 0 : edit.getEdit().timeline.tracks.length,
          track
        );
      },
      dispose,
      getEdit: () => edit.getEdit(),
      onChange: (listener) => edit.events.on("edit:changed", listener),
      pause: () => {
        edit.pause();
      },
      time: () => edit.playbackTime,
    };

    ui.registerButton({ icon: textIcon, id: "text", tooltip: addTextLabel });

    ui.on("button:text", () => {
      onAddText(studio);
    });

    await canvas.load();

    stops.push(() => {
      edit.pause();
      ui.dispose();
      canvas.dispose();
    });

    await edit.load();

    const timeline = new sdk.Timeline(edit, timelineBox);

    await timeline.load();

    stops.push(() => {
      timeline.dispose();
    });

    const controls = new sdk.Controls(edit);

    await controls.load();

    stops.push(
      () => {
        controls.dispose();
      },
      fitted(() => {
        canvas.resize();
        canvas.zoomToFit();
      })
    );

    return studio;
  } catch (error) {
    dispose();
    throw error;
  }
};
