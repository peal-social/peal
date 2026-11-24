"use client";

import { Option } from "effect";
import {
  CameraIcon,
  DownloadIcon,
  FilePlusIcon,
  MaximizeIcon,
  MinimizeIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { AssistantStatus, Media } from "peal-contract";
import { Alert, AlertTitle } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import { Skeleton } from "peal-ui/components/skeleton";
import { toast } from "peal-ui/components/toast";
import { cn } from "peal-ui/lib/utils";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";

import { isSlideshowSettingsRefusal } from "#assistant/slideshows.ts";
import { SlideshowJobs } from "#components/media/generate-slideshow.tsx";
import { MediaPicker } from "#components/posts/media-picker.tsx";
import { PageActions, useFullWindow } from "#components/shell/frame-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";
import { clearDraft, readDraft, writeDraft } from "#studio/draft.ts";
import {
  clipPreviewOf,
  emptyEdit,
  hasClips,
  imageAspectOf,
  laidEnd,
  mediaIdAt,
  mediaIdsOf,
  playedSecondsOf,
  previewOf,
  renderedOf,
  storedOf,
  textClipOf,
  waitsToBeGenerated,
} from "#studio/edit-document.ts";
import type { StudioEdit } from "#studio/edit-document.ts";
import { useLibraryFiles } from "#studio/library-files.ts";

import { canvasAttribute, startStudio } from "./studio-engine.ts";
import type { Generated, Generation, Studio } from "./studio-engine.ts";
import {
  captionsTool,
  figureTool,
  filmTool,
  imageTool,
  textTool,
  voiceTool,
} from "./studio-tools.ts";
import type { StudioTool } from "./studio-tools.ts";
import { useStudioExport } from "./use-studio-export.ts";
import type { StudioExport } from "./use-studio-export.ts";
import { useStudioFrame } from "./use-studio-frame.ts";
import { useStudioGenerator } from "./use-studio-generator.ts";

import "./studio.css";

interface EditorProps {
  readonly mayConfigure: boolean;
  readonly status: AssistantStatus;
  readonly workspaceId: string;
}

// The most files added at once.
const filesAtOnce = 20;

// How long the draft waits after the last change before it is kept.
const saveDelayMs = 800;

// What the editor may add from the library: pictures, films and sounds
// that are ready.
const isEditable = (media: Media): boolean =>
  media.status._tag === "ready" &&
  (media.kind === "video" ||
    media.kind === "audio" ||
    media.contentType === "image/jpeg" ||
    media.contentType === "image/png");

const storedIn = (studio: Studio, files: ReadonlyMap<string, Media>) =>
  storedOf(
    studio.getEdit(),
    (address) => mediaIdAt(files.values(), address),
    window.location.origin
  );

/** The editor, once the draft's library files are read. */
export const StudioEditor = (props: EditorProps) => {
  const t = useTranslations("Studio");
  const newText = t("newText");

  // The SDK loads an edit only with a clip: a new one starts with a text.
  const initial = useMemo<StudioEdit>(
    () =>
      readDraft(props.workspaceId).pipe(
        Option.filter(hasClips),
        Option.getOrElse(() => emptyEdit([textClipOf(newText, 0)]))
      ),
    [newText, props.workspaceId]
  );

  const files = useLibraryFiles(props.workspaceId, mediaIdsOf(initial));

  return files.loading ? (
    <Skeleton className="h-[70dvh] w-full" />
  ) : (
    <LoadedStudio {...props} files={files.byId} initial={initial} />
  );
};

// Why the last export was refused, where an export goes and how many are
// left today.
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

const LoadedStudio = ({
  files: initialFiles,
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
  const timelineBox = useRef<HTMLDivElement>(null);
  // The library's files the editor knows, to show and send each one.
  const files = useRef(new Map(initialFiles));
  const [studio, setStudio] = useState<Studio | null>(null);
  const [broken, setBroken] = useState(false);
  const [full, setFull] = useState(true);
  // Set once the person starts over: nothing of this draft is kept again.
  const forgotten = useRef(false);

  const exporting = useStudioExport(workspaceId);
  const frame = useStudioFrame(workspaceId);
  const generator = useStudioGenerator(workspaceId, status);
  useFullWindow(full);

  const handleGeneration = useEffectEvent(
    async (from: Studio, generation: Generation): Promise<Generated> => {
      const media = await generator.make(
        generation,
        imageAspectOf(from.getEdit())
      );

      files.current.set(media.id, media);

      if (media.url === null) {
        throw new Error(t("notGenerated"));
      }

      return { seconds: playedSecondsOf(media), url: media.url };
    }
  );

  // Read as the SDK starts: a change to what AI makes, or to a label, never
  // starts it again, which would lose what is not in the draft it opened.
  const toolsOf = useEffectEvent((): readonly StudioTool[] => [
    textTool(t("addText"), t("newText")),
    figureTool("rectangle", t("addRectangle")),
    figureTool("circle", t("addCircle")),
    ...(status.images.available
      ? [imageTool(t("generateImage"), t("imagePrompt"))]
      : []),
    ...(status.videos.available
      ? [filmTool(t("generateVideo"), t("videoPrompt"))]
      : []),
    ...(status.voiceovers.available
      ? [voiceTool(t("generateVoice"), t("voiceWords"))]
      : []),
    captionsTool(t("addCaptions"), () => {
      toast.info(t("captionsNeedVoice"));
    }),
  ]);

  // The SDK starts once, and stops with the page.
  useEffect(() => {
    const box = timelineBox.current;
    let running: Studio | null = null;
    let stopped = false;

    const start = async (element: HTMLElement) => {
      try {
        const started = await startStudio({
          generate: handleGeneration,
          initial: previewOf(
            initial,
            (mediaId) => files.current.get(mediaId)?.url ?? null,
            window.location.origin
          ),
          timelineBox: element,
          tools: toolsOf(),
        });

        if (stopped) {
          started.dispose();
        } else {
          running = started;
          setStudio(started);
        }
      } catch {
        // A draft the SDK refuses, a browser without WebGL, or a download
        // that failed: the draft is kept, for another try or to start over.
        if (!stopped) {
          setBroken(true);
        }
      }
    };

    if (box !== null) {
      void start(box);
    }

    return () => {
      stopped = true;
      running?.dispose();
    };
  }, [initial]);

  // The draft is kept a moment after each change, and what is not kept yet
  // as the page is left.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let waits = false;

    const keep = () => {
      clearTimeout(timer);

      if (studio !== null && waits && !forgotten.current) {
        waits = false;
        writeDraft(workspaceId, storedIn(studio, files.current));
      }
    };

    const unsubscribe = studio?.onChange(() => {
      waits = true;
      clearTimeout(timer);
      timer = setTimeout(keep, saveDelayMs);
    });

    window.addEventListener("pagehide", keep);

    return () => {
      window.removeEventListener("pagehide", keep);
      keep();
      unsubscribe?.();
    };
  }, [studio, workspaceId]);

  // Pictures and films go on a track over the others, at the playhead;
  // sounds on one under them.
  const addFiles = async (picked: readonly Media[]) => {
    if (studio === null) {
      return;
    }

    for (const media of picked) {
      files.current.set(media.id, media);
    }

    const clipsOf = (some: readonly Media[]) =>
      laidEnd(some, studio.time()).map((clip) =>
        clipPreviewOf(
          clip,
          (mediaId) => files.current.get(mediaId)?.url ?? null,
          window.location.origin
        )
      );

    const pictures = clipsOf(picked.filter(({ kind }) => kind !== "audio"));
    const sounds = clipsOf(picked.filter(({ kind }) => kind === "audio"));

    if (pictures.length > 0) {
      await studio.addTrack("over", pictures);
    }

    if (sounds.length > 0) {
      await studio.addTrack("under", sounds);
    }
  };

  const handleExport = () => {
    if (studio !== null) {
      studio.pause();

      const edit = storedIn(studio, files.current);

      if (waitsToBeGenerated(edit)) {
        toast.error(t("generateFirst"));
      } else {
        exporting.exportVideo(renderedOf(edit));
      }
    }
  };

  const handleStartOver = () => {
    forgotten.current = true;
    clearDraft(workspaceId);
    window.location.reload();
  };

  return (
    <div className="flex flex-1 flex-col gap-3">
      <PageActions>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setFull(!full);
          }}
        >
          {full ? <MinimizeIcon aria-hidden /> : <MaximizeIcon aria-hidden />}
          {full ? t("exitFullScreen") : t("fullScreen")}
        </Button>
        <MediaPicker
          accepts={isEditable}
          attached={[]}
          disabled={studio === null}
          room={filesAtOnce}
          texts={{
            attach: t("addFilesConfirm"),
            description: t("addFilesDescription"),
            open: t("addFiles"),
            title: t("addFilesTitle"),
          }}
          workspaceId={workspaceId}
          onPick={(picked) => {
            void addFiles(picked);
          }}
        />
        <Button
          size="sm"
          variant="ghost"
          disabled={studio === null || frame.saving}
          onClick={() => {
            if (studio !== null) {
              frame.saveFrame(studio);
            }
          }}
        >
          <CameraIcon aria-hidden />
          {t("saveFrame")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={studio === null && !broken}
          onClick={handleStartOver}
        >
          <FilePlusIcon aria-hidden />
          {t("startOver")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={studio === null || exporting.sending}
          onClick={handleExport}
        >
          <DownloadIcon aria-hidden />
          {exporting.sending ? t("exporting") : t("export")}
        </Button>
      </PageActions>
      {status.slideshows.sandbox ? (
        <Alert>
          <AlertTitle>{slideshows("sandbox")}</AlertTitle>
        </Alert>
      ) : null}
      {broken ? (
        <Alert variant="destructive">
          <AlertTitle>{t("engineFailed")}</AlertTitle>
        </Alert>
      ) : null}
      <div data-peal-studio="" className="flex flex-1 flex-col gap-3">
        <div
          {...{ [canvasAttribute]: "" }}
          className={cn(
            "bg-muted relative min-h-72 overflow-hidden rounded-lg border",
            full ? "flex-1 basis-0" : "h-[48dvh]"
          )}
        />
        <div
          ref={timelineBox}
          data-shotstack-timeline=""
          className="h-72 shrink-0 overflow-hidden rounded-lg border"
        />
      </div>
      <ExportNotice
        exporting={exporting}
        mayConfigure={mayConfigure}
        remaining={status.slideshows.remaining}
        workspaceId={workspaceId}
      />
      <SlideshowJobs workspaceId={workspaceId} />
    </div>
  );
};
