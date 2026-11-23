"use client";

import { MenuTrigger } from "@ui-sdk/react/menu";
import {
  Toolbar,
  ToolbarButton,
  ToolbarSeparator,
} from "@ui-sdk/react/toolbar";
import {
  CaptionsIcon,
  ChevronDownIcon,
  CircleIcon,
  CopyIcon,
  FilePlusIcon,
  MinusIcon,
  PentagonIcon,
  Redo2Icon,
  SquareIcon,
  Trash2Icon,
  TypeIcon,
  Undo2Icon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Media } from "peal-contract";
import { buttonVariants } from "peal-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "peal-ui/components/dropdown-menu";

import { MediaPicker } from "#components/posts/media-picker.tsx";
import { figureKinds } from "#studio/figures.ts";
import type { FigureKind } from "#studio/figures.ts";

const toolButton = buttonVariants({ size: "sm", variant: "ghost" });

const iconButton = buttonVariants({ size: "icon-sm", variant: "ghost" });

// The most files added at once.
const filesAtOnce = 20;

// What the editor may add from the library: pictures, films and sounds
// that are ready.
const isEditable = (media: Media): boolean =>
  media.status._tag === "ready" &&
  (media.kind === "video" ||
    media.kind === "audio" ||
    (media.kind === "image" &&
      (media.contentType === "image/jpeg" ||
        media.contentType === "image/png")));

const figureIcons: Readonly<Record<FigureKind, LucideIcon>> = {
  circle: CircleIcon,
  line: MinusIcon,
  rectangle: SquareIcon,
};

/** What the toolbar asks the editor to do, and what it may. */
export interface ToolbarActions {
  readonly canAdd: boolean;
  /** Whether a sound or a film is there for captions to transcribe. */
  readonly canCaption: boolean;
  readonly canEdit: boolean;
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly hasChoice: boolean;
  readonly handleAddFiles: (picked: readonly Media[]) => void;
  readonly handleAddCaptions: () => void;
  readonly handleAddFigure: (kind: FigureKind) => void;
  readonly handleAddText: () => void;
  readonly handleDelete: () => void;
  readonly handleDuplicate: () => void;
  readonly handleRedo: () => void;
  readonly handleStartOver: () => void;
  readonly handleUndo: () => void;
}

// Add shape: a menu of the shapes Shotstack draws, its trigger one of the
// toolbar's items (ui-sdk's menu trigger, as its toolbar takes one).
const FigureMenu = ({ actions }: { readonly actions: ToolbarActions }) => {
  const t = useTranslations("Studio");

  return (
    <DropdownMenu>
      <ToolbarButton
        className={toolButton}
        disabled={!actions.canAdd}
        render={<MenuTrigger />}
      >
        <PentagonIcon aria-hidden />
        {t("addShape")}
        <ChevronDownIcon aria-hidden />
      </ToolbarButton>
      <DropdownMenuContent className="w-44">
        {figureKinds.map((kind) => {
          const Icon = figureIcons[kind];

          return (
            <DropdownMenuItem
              key={kind}
              onSelect={() => {
                actions.handleAddFigure(kind);
              }}
            >
              <Icon aria-hidden />
              {t(`shapes.${kind}`)}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/**
 * The editor's tools, one tab stop with arrow keys between them: add
 * files, a text, a shape or captions, undo and redo, duplicate or delete
 * the chosen clip, start over.
 */
export const StudioToolbar = ({
  actions,
  workspaceId,
}: {
  readonly actions: ToolbarActions;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Studio");

  return (
    <Toolbar
      aria-label={t("toolbar")}
      className="flex flex-wrap items-center gap-1"
    >
      <MediaPicker
        accepts={isEditable}
        attached={[]}
        disabled={!actions.canAdd}
        room={filesAtOnce}
        texts={{
          attach: t("addFilesConfirm"),
          description: t("addFilesDescription"),
          open: t("addFiles"),
          title: t("addFilesTitle"),
        }}
        workspaceId={workspaceId}
        onPick={actions.handleAddFiles}
      />
      <ToolbarButton
        className={toolButton}
        disabled={!actions.canAdd}
        onClick={actions.handleAddText}
      >
        <TypeIcon aria-hidden />
        {t("addText")}
      </ToolbarButton>
      <FigureMenu actions={actions} />
      <ToolbarButton
        className={toolButton}
        disabled={!actions.canAdd || !actions.canCaption}
        onClick={actions.handleAddCaptions}
      >
        <CaptionsIcon aria-hidden />
        {t("addCaptions")}
      </ToolbarButton>
      <ToolbarSeparator className="bg-border mx-1 h-5 w-px" />
      <ToolbarButton
        aria-label={t("undo")}
        className={iconButton}
        disabled={!actions.canUndo}
        onClick={actions.handleUndo}
      >
        <Undo2Icon aria-hidden />
      </ToolbarButton>
      <ToolbarButton
        aria-label={t("redo")}
        className={iconButton}
        disabled={!actions.canRedo}
        onClick={actions.handleRedo}
      >
        <Redo2Icon aria-hidden />
      </ToolbarButton>
      <ToolbarSeparator className="bg-border mx-1 h-5 w-px" />
      <ToolbarButton
        className={toolButton}
        disabled={!actions.canEdit || !actions.hasChoice}
        onClick={actions.handleDuplicate}
      >
        <CopyIcon aria-hidden />
        {t("duplicate")}
      </ToolbarButton>
      <ToolbarButton
        className={toolButton}
        disabled={!actions.canEdit || !actions.hasChoice}
        onClick={actions.handleDelete}
      >
        <Trash2Icon aria-hidden />
        {t("delete")}
      </ToolbarButton>
      <ToolbarSeparator className="bg-border mx-1 h-5 w-px" />
      <ToolbarButton
        className={toolButton}
        disabled={!actions.canEdit}
        onClick={actions.handleStartOver}
      >
        <FilePlusIcon aria-hidden />
        {t("startOver")}
      </ToolbarButton>
    </Toolbar>
  );
};
