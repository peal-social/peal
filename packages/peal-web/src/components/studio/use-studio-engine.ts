"use client";

import type { Media } from "peal-contract";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { RefObject } from "react";

import { clearDraft, writeDraft } from "#studio/draft.ts";
import {
  clipPreviewOf,
  hasClips,
  previewOf,
  storedOf,
  tracksOf,
} from "#studio/edit-document.ts";
import type {
  ClipView,
  StudioClip,
  StudioEdit,
  StudioTrack,
} from "#studio/edit-document.ts";

import { startEngine } from "./studio-engine.ts";
import type { Engine, EngineState } from "./studio-engine.ts";

// The editor's engine as React sees it: started on the draft when it has a
// clip, else on the first thing added (Shotstack's Edit holds a clip on
// every track); kept in the browser a moment after each change; fitted to
// its stage's size; and the library's files it knows, by id and address.

// How long the draft waits after the last change before it is kept.
const saveDelayMs = 800;

const noState = null;

const nothingToUndo = (): void => {
  // Nothing was started, so nothing stops.
};

const noSubscription = () => nothingToUndo;

// The engine's state, read as React renders, or none before it starts.
const useEngineState = (engine: Engine | null): EngineState | null =>
  useSyncExternalStore(
    engine?.subscribe ?? noSubscription,
    () => engine?.getState() ?? noState,
    () => noState
  );

/** The library's files the editor knows, to show and send each one. */
export interface KnownFiles {
  /** A file's address in the preview, by its id. */
  readonly addressOf: (mediaId: string) => string | null;
  readonly byId: ReadonlyMap<string, Media>;
  /** The file an address in the preview shows. */
  readonly mediaIdOf: (address: string) => string | null;
}

const knownFilesOf = (byId: ReadonlyMap<string, Media>): KnownFiles => ({
  addressOf: (mediaId) => byId.get(mediaId)?.url ?? null,
  byId,
  mediaIdOf: (address) =>
    [...byId.values()].find(({ url }) => url === address)?.id ?? null,
});

/** What the editor reads and does through its engine. */
export interface StudioEngine {
  readonly broken: boolean;
  /** The clip chosen, as the timeline lays it out, and as the document has it. */
  readonly chosen: {
    readonly clip: StudioClip;
    readonly view: ClipView;
  } | null;
  readonly engine: Engine | null;
  readonly files: KnownFiles;
  /** Files picked since the editor opened, so it shows and sends them. */
  readonly know: (picked: readonly Media[]) => KnownFiles;
  /** A clip as the preview loads it. */
  readonly previewClip: (clip: StudioClip, files: KnownFiles) => StudioClip;
  /** Starts the engine on these tracks, before it runs. */
  readonly seedWith: (
    tracks: readonly StudioTrack[],
    files: KnownFiles
  ) => void;
  /** Before the first clip, only adding one is offered. */
  readonly starting: boolean;
  readonly state: EngineState | null;
  /** The document with each file by its library name, for keeping or sending. */
  readonly stored: () => StudioEdit | null;
  readonly tracks: readonly (readonly ClipView[])[];
}

// Keeps the draft at once, then a moment after each change.
const keepDraft = (
  engine: Engine,
  workspaceId: string,
  files: RefObject<KnownFiles>
) => {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const save = () => {
    writeDraft(
      workspaceId,
      storedOf(
        engine.getEdit(),
        files.current.mediaIdOf,
        window.location.origin
      )
    );
  };

  save();

  const unsubscribe = engine.subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(save, saveDelayMs);
  });

  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
};

// The canvas follows its box's size.
const fitTo = (engine: Engine, box: HTMLElement) => {
  const observer = new ResizeObserver(() => {
    engine.fit();
  });

  observer.observe(box);

  return () => {
    observer.disconnect();
  };
};

/** The editor's engine, its state and the files it knows. */
export const useStudioEngine = ({
  files: initialFiles,
  initial,
  stage,
  workspaceId,
}: {
  readonly files: ReadonlyMap<string, Media>;
  readonly initial: StudioEdit;
  readonly stage: RefObject<HTMLElement | null>;
  readonly workspaceId: string;
}): StudioEngine => {
  const [files, setFiles] = useState(() => knownFilesOf(initialFiles));

  const [seed, setSeed] = useState<StudioEdit | null>(() =>
    hasClips(initial)
      ? previewOf(initial, files.addressOf, window.location.origin)
      : null
  );

  const [engine, setEngine] = useState<Engine | null>(null);
  const [broken, setBroken] = useState(false);
  const state = useEngineState(engine);
  const latestFiles = useRef(files);

  useEffect(() => {
    latestFiles.current = files;
  }, [files]);

  // The engine starts once, on its seed, and stops with the page.
  useEffect(() => {
    if (seed === null) {
      return nothingToUndo;
    }

    let running: Engine | null = null;
    let stopped = false;

    const start = async () => {
      try {
        const started = await startEngine(seed);

        if (stopped) {
          started.dispose();
        } else {
          running = started;
          setEngine(started);
        }
      } catch {
        // A draft the SDK refuses, or a browser without WebGL: the draft
        // is forgotten, so the next visit starts afresh, and the page says
        // so.
        if (!stopped) {
          clearDraft(workspaceId);
          setBroken(true);
        }
      }
    };

    void start();

    return () => {
      stopped = true;
      running?.dispose();
    };
  }, [seed, workspaceId]);

  useEffect(
    () =>
      engine === null
        ? nothingToUndo
        : keepDraft(engine, workspaceId, latestFiles),
    [engine, workspaceId]
  );

  useEffect(() => {
    const box = stage.current;

    return engine === null || box === null ? nothingToUndo : fitTo(engine, box);
  }, [engine, stage]);

  const tracks = useMemo(
    () =>
      state === null
        ? []
        : tracksOf(
            storedOf(state.edit, files.mediaIdOf, window.location.origin)
          ),
    [state, files]
  );

  const view = tracks.flat().find(({ id }) => id === state?.selected);

  const clip = state?.edit.timeline.tracks[view?.trackIndex ?? -1]?.clips.find(
    (each) => each.id === view?.id
  );

  return {
    broken,
    chosen: view === undefined || clip === undefined ? null : { clip, view },
    engine,
    files,
    know: (picked) => {
      const next = knownFilesOf(
        new Map([
          ...files.byId,
          ...picked.map((media) => [media.id, media] as const),
        ])
      );

      latestFiles.current = next;
      setFiles(next);

      return next;
    },
    previewClip: (each, known) =>
      clipPreviewOf(each, known.addressOf, window.location.origin),
    seedWith: (added, known) => {
      setSeed(
        previewOf(
          { ...initial, timeline: { ...initial.timeline, tracks: [...added] } },
          known.addressOf,
          window.location.origin
        )
      );
    },
    starting: seed === null && !broken,
    state,
    stored: () =>
      engine === null
        ? null
        : storedOf(engine.getEdit(), files.mediaIdOf, window.location.origin),
    tracks,
  };
};
