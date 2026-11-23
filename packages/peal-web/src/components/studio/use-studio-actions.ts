"use client";

import { useShortcut } from "@ui-sdk/react/shortcuts";
import { useTranslations } from "next-intl";
import type { Media } from "peal-contract";

import { typingIn } from "#components/undo.tsx";
import { undoKey } from "#shell/keys.ts";
import { clearDraft } from "#studio/draft.ts";
import { endOf, laidEnd, textClipOf } from "#studio/edit-document.ts";
import { tenth } from "#studio/timeline-geometry.ts";

import type { StudioEngine } from "./use-studio-engine.ts";

const notTyping = () => !typingIn(document.activeElement);

/** What the editor's tools do. */
export interface StudioActions {
  readonly addFiles: (picked: readonly Media[]) => void;
  readonly addText: () => void;
  readonly deleteChosen: () => void;
  readonly duplicate: () => void;
  readonly startOver: () => void;
  readonly togglePlay: () => void;
}

/**
 * The editor's tools on its engine, and their keys: Space plays or
 * pauses, ⌘Z or Ctrl+Z undoes, with Shift redoes, outside a field.
 */
export const useStudioActions = (
  studio: StudioEngine,
  workspaceId: string
): StudioActions => {
  const t = useTranslations("Studio");
  const { chosen, engine, state, tracks } = studio;

  // Pictures and films go after the last clip of the chosen clip's track,
  // or the top one, or on a track of their own when there is none; sounds
  // on a track of their own at the foot.
  const addFiles = (picked: readonly Media[]) => {
    const files = studio.know(picked);

    const preview = (each: Parameters<StudioEngine["previewClip"]>[0]) =>
      studio.previewClip(each, files);

    const visualTrack = chosen?.view.trackIndex ?? 0;

    const pictures = laidEnd(
      picked.filter(({ kind }) => kind !== "audio"),
      endOf([tracks[visualTrack] ?? []])
    ).map(preview);

    const sounds = laidEnd(
      picked.filter(({ kind }) => kind === "audio"),
      0
    ).map(preview);

    if (engine === null) {
      studio.seedWith(
        [pictures, sounds].flatMap((clips) =>
          clips.length === 0 ? [] : [{ clips: [...clips] }]
        ),
        files
      );

      return;
    }

    const adding = [
      ...(tracks.length === 0 && pictures.length > 0
        ? [engine.addTrack(0, { clips: [...pictures] })]
        : pictures.map(async (clip) => {
            await engine.addClip(visualTrack, clip);
          })),
      ...(sounds.length === 0
        ? []
        : [engine.addTrack(tracks.length, { clips: [...sounds] })]),
    ];

    void Promise.all(adding);
  };

  // A text on a track of its own over the others, at the playhead.
  const addText = () => {
    const clip = textClipOf(t("newText"), tenth(state?.time ?? 0));

    if (engine === null) {
      studio.seedWith([{ clips: [clip] }], studio.files);

      return;
    }

    void engine.addTrack(0, { clips: [clip] });
  };

  const duplicate = () => {
    if (engine === null || chosen === null) {
      return;
    }

    const { id: _id, ...copy } = chosen.clip;

    void engine.addClip(chosen.view.trackIndex, {
      ...copy,
      start: tenth(chosen.view.start + chosen.view.length),
    });
  };

  const togglePlay = () => {
    if (state?.playing === true) {
      engine?.pause();
    } else {
      engine?.play();
    }
  };

  useShortcut("space", togglePlay, {
    description: t("keys.play"),
    when: () => engine !== null && notTyping(),
  });

  useShortcut(
    undoKey,
    () => {
      void engine?.undo();
    },
    {
      description: t("keys.undo"),
      when: () => state?.canUndo === true && notTyping(),
    }
  );

  useShortcut(
    "mod+shift+z",
    () => {
      void engine?.redo();
    },
    {
      description: t("keys.redo"),
      when: () => state?.canRedo === true && notTyping(),
    }
  );

  return {
    addFiles,
    addText,
    deleteChosen: () => {
      if (chosen !== null) {
        void engine?.deleteClip(chosen.view.id);
      }
    },
    duplicate,
    startOver: () => {
      clearDraft(workspaceId);
      window.location.reload();
    },
    togglePlay,
  };
};
