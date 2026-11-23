"use client";

import type { Canvas } from "@shotstack/shotstack-studio";
import { Schema } from "effect";

import { relayedAddressOf, relayedSourceOf } from "#studio/asset-relay.ts";
import { captionSrcOf, sdkAliasOf } from "#studio/captions.ts";
import type {
  ClipChanges,
  StudioClip,
  StudioEdit,
  StudioTrack,
} from "#studio/edit-document.ts";

// The Studio SDK as the editor's engine: its Edit holds the document,
// every change, the history and the playback, and its Canvas draws the
// preview. Its own timeline, toolbars and keyboard handling are never
// loaded: the editor draws its controls from ui-sdk and calls the engine.

/** What the editor reads of the engine. */
export interface EngineState {
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  /** The video's length, in seconds. */
  readonly duration: number;
  /** The document, each clip with the SDK's id, each file by its address. */
  readonly edit: StudioEdit;
  /** Clips whose file the preview could not load, by id. */
  readonly failed: ReadonlySet<string>;
  readonly playing: boolean;
  /** The clip chosen, by id. */
  readonly selected: string | null;
  /** The playhead, in seconds. */
  readonly time: number;
}

/** What the editor asks of the engine. */
export interface Engine {
  /**
   * Adds a caption on a track of its own over the others, its words from
   * the clip `sourceId`.
   */
  readonly addCaption: (caption: StudioClip, sourceId: string) => Promise<void>;
  readonly addClip: (trackIndex: number, clip: StudioClip) => Promise<void>;
  readonly addTrack: (trackIndex: number, track: StudioTrack) => Promise<void>;
  readonly deleteClip: (clipId: string) => Promise<void>;
  readonly deleteTrack: (trackIndex: number) => Promise<void>;
  readonly dispose: () => void;
  readonly fit: () => void;
  /** Has a caption take its words from the clip `sourceId`. */
  readonly linkCaption: (captionId: string, sourceId: string) => Promise<void>;
  /** The document as it stands, without the SDK's ids: to keep or send. */
  readonly getEdit: () => StudioEdit;
  readonly getState: () => EngineState;
  readonly moveClip: (
    clipId: string,
    trackIndex: number,
    start: number
  ) => Promise<void>;
  readonly pause: () => void;
  readonly play: () => void;
  readonly redo: () => Promise<void>;
  readonly seek: (time: number) => void;
  readonly select: (clipId: string | null) => void;
  readonly setOutput: (output: {
    readonly aspectRatio?: string;
    readonly fps?: number;
    readonly resolution?: string;
  }) => Promise<void>;
  readonly setBackground: (color: string) => Promise<void>;
  readonly subscribe: (listener: () => void) => () => void;
  readonly undo: () => Promise<void>;
  readonly updateClip: (clipId: string, updates: ClipChanges) => Promise<void>;
}

// The SDK assigns a clip's changes to the clip, so a field changed to
// undefined is gone from the document it saves; its types take no
// undefined, so those fields are set apart.
const changesOf = (changes: ClipChanges): Partial<StudioClip> => {
  const kept: Partial<StudioClip> = {};

  for (const [field, value] of Object.entries(changes)) {
    Reflect.set(kept, field, value);
  }

  return kept;
};

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

/** The element the SDK's canvas draws into, which it finds by itself. */
export const canvasAttribute = "data-shotstack-studio";

const documentEvents = [
  "timeline:updated",
  "edit:changed",
  "edit:undo",
  "edit:redo",
  "clip:added",
  "clip:updated",
  "clip:deleted",
  "clip:restored",
  "track:added",
  "track:removed",
  "duration:changed",
  "output:resized",
  "output:aspectRatioChanged",
  "output:resolutionChanged",
  "output:fpsChanged",
  "timeline:backgroundChanged",
] as const;

/**
 * Loads the SDK in the browser and starts it on `initial`, drawing into
 * the page's element with `canvasAttribute`. The SDK's own interface is
 * never loaded.
 */
export const startEngine = async (initial: StudioEdit): Promise<Engine> => {
  const unrelay = relayFetches(window.location.origin);
  const sdk = await import("@shotstack/shotstack-studio");
  const edit = new sdk.Edit(initial);
  const canvas: Canvas = new sdk.Canvas(edit);

  try {
    await canvas.load();
    await edit.load();
  } catch (error) {
    unrelay();
    canvas.dispose();
    throw error;
  }

  canvas.zoomToFit();

  const listeners = new Set<() => void>();
  const failed = new Set<string>();
  let selected: string | null = null;
  let state: EngineState;

  const read = (): EngineState => ({
    canRedo: edit.canRedo,
    canUndo: edit.canUndo,
    duration: edit.totalDuration,
    edit: edit.getEdit({ includeIds: true }),
    failed: new Set(failed),
    playing: edit.isPlaying,
    selected,
    time: edit.playbackTime,
  });

  state = read();

  const changed = () => {
    state = read();

    for (const listener of listeners) {
      listener();
    }
  };

  // The playhead moves without events while it plays.
  let frame = 0;

  const follow = () => {
    changed();
    frame = edit.isPlaying ? requestAnimationFrame(follow) : 0;
  };

  const idAt = (trackIndex: number, clipIndex: number): string | null =>
    edit.getEdit({ includeIds: true }).timeline.tracks[trackIndex]?.clips[
      clipIndex
    ]?.id ?? null;

  const unsubscribes = [
    ...documentEvents.map((name) => edit.events.on(name, changed)),
    edit.events.on("clip:selected", ({ clipIndex, trackIndex }) => {
      selected = idAt(trackIndex, clipIndex);
      changed();
    }),
    edit.events.on("selection:cleared", () => {
      selected = null;
      changed();
    }),
    edit.events.on("clip:loadFailed", ({ clipIndex, trackIndex }) => {
      const id = idAt(trackIndex, clipIndex);

      if (id !== null) {
        failed.add(id);
      }

      changed();
    }),
    edit.events.on("playback:play", () => {
      cancelAnimationFrame(frame);
      follow();
    }),
    edit.events.on("playback:pause", changed),
  ];

  const settled = async (command: Promise<unknown>) => {
    await command;
    changed();
  };

  // A caption names its source by the source's alias: one the clip has,
  // else the one the SDK would give it, set first.
  const link = async (captionId: string, sourceId: string) => {
    const source = edit.getClipById(sourceId);
    const caption = edit.getClipById(captionId);

    if (source === null || caption?.asset.type !== "rich-caption") {
      return;
    }

    const alias = source.alias ?? sdkAliasOf(sourceId);
    const src = captionSrcOf({ alias });

    if (source.alias === undefined) {
      await edit.updateClipById(sourceId, { alias });
    }

    if (caption.asset.src !== src) {
      await edit.updateClipById(captionId, {
        asset: { ...caption.asset, src },
      });
    }
  };

  // The SDK's Edit publishes no way to choose a clip: one chosen on the
  // canvas is followed through its events, one chosen on the timeline is
  // the editor's own, and the canvas keeps its last highlight.
  const select = (clipId: string | null) => {
    selected =
      clipId !== null && edit.getClipPositionById(clipId) !== null
        ? clipId
        : null;
    changed();
  };

  return {
    // The SDK links a caption added on a track to the first sound or film
    // it finds; one asked of another clip is linked to it after.
    addCaption: async (caption, sourceId) => {
      await edit.addTrack(0, { clips: [caption] });

      const added = edit.getEdit({ includeIds: true }).timeline.tracks[0]
        ?.clips[0]?.id;

      if (added !== undefined) {
        await link(added, sourceId);
      }

      changed();
    },
    addClip: async (trackIndex, clip) => {
      await settled(edit.addClip(trackIndex, clip));
    },
    addTrack: async (trackIndex, track) => {
      await settled(edit.addTrack(trackIndex, track));
    },
    deleteClip: async (clipId) => {
      if (selected === clipId) {
        select(null);
      }

      await settled(edit.deleteClipById(clipId));
    },
    deleteTrack: async (trackIndex) => {
      await settled(edit.deleteTrack(trackIndex));
    },
    dispose: () => {
      cancelAnimationFrame(frame);

      for (const unsubscribe of unsubscribes) {
        unsubscribe();
      }

      listeners.clear();
      edit.pause();
      canvas.dispose();
      unrelay();
    },
    fit: () => {
      canvas.resize();
      canvas.zoomToFit();
    },
    getEdit: () => edit.getEdit(),
    linkCaption: async (captionId, sourceId) => {
      await settled(link(captionId, sourceId));
    },
    getState: () => state,
    // The SDK's types brand a new start without a way to make one: a clip
    // that changes track moves there, then takes its start.
    moveClip: async (clipId, trackIndex, start) => {
      if (edit.getClipPositionById(clipId)?.trackIndex !== trackIndex) {
        await edit.moveClipById(clipId, trackIndex);
      }

      await settled(edit.updateClipById(clipId, { start }));
    },
    pause: () => {
      edit.pause();
      changed();
    },
    play: () => {
      edit.play();
    },
    redo: async () => {
      await settled(edit.redo());
    },
    seek: (time) => {
      edit.seek(time);
      changed();
    },
    select,
    setBackground: async (color) => {
      await settled(edit.setTimelineBackground(color));
    },
    setOutput: async (output) => {
      await settled(edit.setOutput(output));
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => {
        listeners.delete(listener);
      };
    },
    undo: async () => {
      await settled(edit.undo());
    },
    updateClip: async (clipId, updates) => {
      await settled(edit.updateClipById(clipId, changesOf(updates)));
    },
  };
};
