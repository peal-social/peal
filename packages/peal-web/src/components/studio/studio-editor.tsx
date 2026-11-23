"use client";

import { Option } from "effect";
import { DownloadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AssistantStatus, Media } from "peal-contract";
import { Alert, AlertTitle } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import { Skeleton } from "peal-ui/components/skeleton";
import { useMemo, useRef, useState } from "react";
import type { RefObject } from "react";

import { isSlideshowSettingsRefusal } from "#assistant/slideshows.ts";
import { SlideshowJobs } from "#components/media/generate-slideshow.tsx";
import { useMediaName } from "#components/media/media-preview.tsx";
import { PageActions } from "#components/shell/frame-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";
import { readDraft } from "#studio/draft.ts";
import {
  emptyEdit,
  endOf,
  mediaIdsOf,
  settingsOf,
} from "#studio/edit-document.ts";
import type { ClipView, StudioEdit } from "#studio/edit-document.ts";
import { useLibraryFiles } from "#studio/library-files.ts";
import { defaultZoom, steppedTime } from "#studio/timeline-geometry.ts";

import { canvasAttribute } from "./studio-engine.ts";
import { StudioInspector } from "./studio-inspector.tsx";
import { StudioTimeline } from "./studio-timeline.tsx";
import { StudioToolbar } from "./studio-toolbar.tsx";
import { StudioTransport } from "./studio-transport.tsx";
import { useStudioActions } from "./use-studio-actions.ts";
import type { StudioActions } from "./use-studio-actions.ts";
import { useStudioEngine } from "./use-studio-engine.ts";
import type { StudioEngine } from "./use-studio-engine.ts";
import { useStudioExport } from "./use-studio-export.ts";
import type { StudioExport } from "./use-studio-export.ts";

interface EditorProps {
  readonly mayConfigure: boolean;
  readonly status: AssistantStatus;
  readonly workspaceId: string;
}

const noFailures: ReadonlySet<string> = new Set();

/** The editor on the SDK's engine, once the draft's library files are read. */
export const StudioEditor = (props: EditorProps) => {
  const initial = useMemo<StudioEdit>(
    () => Option.getOrElse(readDraft(props.workspaceId), () => emptyEdit()),
    [props.workspaceId]
  );

  const files = useLibraryFiles(props.workspaceId, mediaIdsOf(initial));

  return files.loading ? (
    <Skeleton className="h-[70dvh] w-full" />
  ) : (
    <LoadedStudio {...props} files={files.byId} initial={initial} />
  );
};

type StageState = "empty" | "loading" | "ready";

const stageStateOf = (studio: StudioEngine): StageState => {
  if (studio.engine !== null || studio.broken) {
    return "ready";
  }

  return studio.starting ? "empty" : "loading";
};

// The stage: the SDK's canvas, a word before the first clip, a placeholder
// while the engine starts.
const Stage = ({
  stage,
  state,
}: {
  readonly stage: RefObject<HTMLDivElement | null>;
  readonly state: StageState;
}) => {
  const t = useTranslations("Studio");

  return (
    <div className="bg-muted relative h-[48dvh] min-h-72 overflow-hidden rounded-lg border">
      <div
        ref={stage}
        {...{ [canvasAttribute]: "" }}
        className="absolute inset-0"
      />
      {state === "empty" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-6 text-center">
          <span className="text-sm font-medium">{t("stageEmpty")}</span>
          <span className="text-muted-foreground max-w-xs text-sm text-balance">
            {t("stageEmptyHint")}
          </span>
        </div>
      ) : null}
      {state === "loading" ? <Skeleton className="absolute inset-4" /> : null}
    </div>
  );
};

// Under the transport: why the last export was refused, and where an
// export goes with how many are left today.
const ExportNotice = ({
  exporting,
  mayConfigure,
  remaining,
  workspaceId,
}: {
  readonly exporting: StudioExport;
  readonly mayConfigure: boolean;
  readonly remaining: number;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Studio");
  const slideshows = useTranslations("Assistant.slideshows");
  const workspaceHref = useWorkspaceHref();
  const { failure } = exporting;

  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      {failure === null ? null : (
        <Alert variant="destructive">
          <AlertTitle>{exporting.failureText(failure)}</AlertTitle>
          {mayConfigure && isSlideshowSettingsRefusal(failure) ? (
            <Link
              className="text-sm underline"
              href={workspaceHref(workspaceId, "/settings/assistant")}
            >
              {slideshows("providerSettings")}
            </Link>
          ) : null}
        </Alert>
      )}
      <p className="text-muted-foreground text-xs">
        {t("exportHint", { remaining })}
      </p>
    </div>
  );
};

// The page's action: export the video once there is something to render.
const ExportAction = ({
  exporting,
  idle,
  studio,
}: {
  readonly exporting: StudioExport;
  readonly idle: boolean;
  readonly studio: StudioEngine;
}) => {
  const t = useTranslations("Studio");

  const handleExport = () => {
    studio.engine?.pause();
    exporting.exportVideo(studio.stored());
  };

  return (
    <PageActions>
      <Button
        size="sm"
        variant="ghost"
        disabled={idle || studio.tracks.length === 0}
        onClick={handleExport}
      >
        <DownloadIcon aria-hidden />
        {exporting.sending ? t("exporting") : t("export")}
      </Button>
    </PageActions>
  );
};

// The toolbar, wired to the engine and to what the editor's state allows.
const EditorToolbar = ({
  act,
  idle,
  sending,
  studio,
  workspaceId,
}: {
  readonly act: StudioActions;
  readonly idle: boolean;
  readonly sending: boolean;
  readonly studio: StudioEngine;
  readonly workspaceId: string;
}) => {
  const { engine, state } = studio;

  const canAdd =
    !sending && !studio.broken && (engine !== null || studio.starting);

  return (
    <StudioToolbar
      workspaceId={workspaceId}
      actions={{
        canAdd,
        canEdit: !idle,
        canRedo: !idle && state?.canRedo === true,
        canUndo: !idle && state?.canUndo === true,
        handleAddFiles: act.addFiles,
        handleAddText: act.addText,
        handleDelete: act.deleteChosen,
        handleDuplicate: act.duplicate,
        handleRedo: () => {
          void engine?.redo();
        },
        handleStartOver: act.startOver,
        handleUndo: () => {
          void engine?.undo();
        },
        hasChoice: studio.chosen !== null,
      }}
    />
  );
};

// The transport, wired to the engine's playback.
const EditorTransport = ({
  act,
  studio,
}: {
  readonly act: StudioActions;
  readonly studio: StudioEngine;
}) => {
  const { engine, state, tracks } = studio;

  const handlePlay = () => {
    act.togglePlay();
  };

  return (
    <StudioTransport
      disabled={engine === null || state === null || state.duration === 0}
      duration={state?.duration ?? 0}
      playing={state?.playing ?? false}
      time={state?.time ?? 0}
      onPlay={handlePlay}
      onSeek={(to) => {
        engine?.seek(to);
      }}
      onStep={(by) => {
        if (state !== null) {
          engine?.seek(
            steppedTime(tracks.flat(), state.time, by, state.duration)
          );
        }
      }}
    />
  );
};

// The inspector, wired to the engine's document.
const EditorInspector = ({
  idle,
  initial,
  studio,
}: {
  readonly idle: boolean;
  readonly initial: StudioEdit;
  readonly studio: StudioEngine;
}) => {
  const { chosen, engine, state } = studio;

  return (
    <StudioInspector
      disabled={idle}
      clip={chosen?.clip ?? null}
      kind={chosen?.view.kind ?? null}
      settings={settingsOf(state?.edit ?? initial)}
      actions={{
        onBackground: (colour) => {
          void engine?.setBackground(colour);
        },
        onClip: (changes) => {
          if (chosen !== null) {
            void engine?.updateClip(chosen.view.id, changes);
          }
        },
        onOutput: (changes) => {
          void engine?.setOutput(changes);
        },
      }}
    />
  );
};

// The timeline, wired to the engine's document and playback.
const EditorTimeline = ({
  idle,
  studio,
}: {
  readonly idle: boolean;
  readonly studio: StudioEngine;
}) => {
  const t = useTranslations("Studio");
  const nameOf = useMediaName();
  const [zoom, setZoom] = useState(defaultZoom);
  const { engine, state, tracks } = studio;

  const labelOf = (clip: ClipView): string => {
    const media =
      clip.mediaId === null ? undefined : studio.files.byId.get(clip.mediaId);

    return (
      clip.text ??
      (media === undefined ? t(`clipKinds.${clip.kind}`) : nameOf(media))
    );
  };

  return (
    <StudioTimeline
      disabled={idle}
      duration={Math.max(state?.duration ?? 0, endOf(tracks))}
      failed={state?.failed ?? noFailures}
      labelOf={labelOf}
      selected={state?.selected ?? null}
      time={state?.time ?? 0}
      tracks={tracks}
      zoom={zoom}
      actions={{
        onDelete: (clipId) => {
          void engine?.deleteClip(clipId);
        },
        onDeleteTrack: (trackIndex) => {
          void engine?.deleteTrack(trackIndex);
        },
        onMove: (clipId, trackIndex, start) => {
          void engine?.moveClip(clipId, trackIndex, start);
        },
        onSeek: (time) => {
          engine?.seek(time);
        },
        onSelect: (clipId) => {
          engine?.select(clipId);
        },
        onTrim: (clipId, start, length) => {
          void engine?.updateClip(clipId, { length, start });
        },
        onZoom: setZoom,
      }}
    />
  );
};

const LoadedStudio = ({
  files,
  initial,
  mayConfigure,
  status,
  workspaceId,
}: EditorProps & {
  readonly files: ReadonlyMap<string, Media>;
  readonly initial: StudioEdit;
}) => {
  const t = useTranslations("Studio");
  const slideshows = useTranslations("Assistant.slideshows");
  const stage = useRef<HTMLDivElement>(null);
  const studio = useStudioEngine({ files, initial, stage, workspaceId });
  const exporting = useStudioExport(workspaceId);
  const act = useStudioActions(studio, workspaceId);
  const idle = studio.engine === null || exporting.sending;

  return (
    <div className="flex flex-col gap-4">
      <ExportAction exporting={exporting} idle={idle} studio={studio} />
      {status.slideshows.sandbox ? (
        <Alert>
          <AlertTitle>{slideshows("sandbox")}</AlertTitle>
        </Alert>
      ) : null}
      {studio.broken ? (
        <Alert variant="destructive">
          <AlertTitle>{t("engineFailed")}</AlertTitle>
        </Alert>
      ) : null}
      <EditorToolbar
        act={act}
        idle={idle}
        sending={exporting.sending}
        studio={studio}
        workspaceId={workspaceId}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-3">
          <Stage stage={stage} state={stageStateOf(studio)} />
          <EditorTransport act={act} studio={studio} />
          <ExportNotice
            exporting={exporting}
            mayConfigure={mayConfigure}
            remaining={status.slideshows.remaining}
            workspaceId={workspaceId}
          />
        </div>
        <div className="relative min-w-0">
          <EditorInspector idle={idle} initial={initial} studio={studio} />
        </div>
      </div>
      <EditorTimeline idle={idle} studio={studio} />
      <SlideshowJobs workspaceId={workspaceId} />
    </div>
  );
};
