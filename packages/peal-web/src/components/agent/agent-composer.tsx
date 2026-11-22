"use client";

import {
  LoaderCircleIcon,
  PaperclipIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import { cn } from "peal-ui/lib/utils";
import type { ComponentProps, RefObject } from "react";

import { ComposerView } from "#components/agent/chat-views.tsx";
import { ComposerAddMenu } from "#components/agent/composer-add-menu.tsx";
import { useAttachments } from "#components/agent/use-attachments.ts";
import type { Attachment } from "#components/agent/use-attachments.ts";

// A chip's mark: a spinner on its way, a warning when it failed, a clip
// once in the library.
const AttachmentIcon = ({ item }: { readonly item: Attachment }) => {
  const t = useTranslations("Agent");

  if (item.state === "uploading") {
    return (
      <LoaderCircleIcon
        aria-label={t("add.uploading", { name: item.name })}
        className="size-3.5 shrink-0 animate-spin"
      />
    );
  }

  if (item.state === "failed") {
    return (
      <TriangleAlertIcon
        aria-label={t("add.failed", { name: item.name })}
        className="size-3.5 shrink-0"
      />
    );
  }

  return <PaperclipIcon aria-hidden className="size-3.5 shrink-0" />;
};

/**
 * The files attached to a message, as chips above its text: each one's
 * name, a spinner while it goes to the library, and a way to take it off.
 */
export const AttachmentsView = ({
  items,
  onRemove,
}: {
  readonly items: readonly Attachment[];
  readonly onRemove: (key: string) => void;
}) => {
  const t = useTranslations("Agent");

  if (items.length === 0) {
    return null;
  }

  return (
    <ul
      aria-label={t("add.attachments")}
      className="flex flex-wrap gap-1.5 px-1"
    >
      {items.map((item) => (
        <li
          key={item.key}
          className={cn(
            "bg-muted flex h-7 max-w-56 items-center gap-1.5 rounded-md ps-2 text-xs",
            item.state === "failed" && "text-destructive-text"
          )}
        >
          <AttachmentIcon item={item} />
          <span className="truncate">{item.name}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("add.remove", { name: item.name })}
            onClick={() => {
              onRemove(item.key);
            }}
          >
            <XIcon aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
};

/**
 * The agent's composer with its **+**: files attached to the message, and
 * skills put in the text. `onSend` gets the text and the library's ids of
 * the files attached, then the list empties.
 */
export const AgentComposer = ({
  inputRef,
  keys,
  onSend,
  workspaceId,
  ...composer
}: Omit<
  ComponentProps<typeof ComposerView>,
  "addMenu" | "attachments" | "blocked" | "inputRef" | "onSend"
> & {
  readonly inputRef?: RefObject<HTMLTextAreaElement | null> | undefined;
  /** Where ⌘⇧U acts: this chat's page or the panel. */
  readonly keys?: "page" | "panel" | undefined;
  readonly onSend: (text: string, mediaIds: readonly string[]) => void;
  readonly workspaceId: string;
}) => {
  const attachments = useAttachments(workspaceId);
  const { add: handleFiles, remove: handleRemove } = attachments;

  return (
    <ComposerView
      {...composer}
      inputRef={inputRef}
      blocked={attachments.blocked}
      attachments={
        <AttachmentsView items={attachments.items} onRemove={handleRemove} />
      }
      addMenu={
        <ComposerAddMenu
          disabled={composer.disabled || composer.running}
          keys={keys}
          onFiles={handleFiles}
          onSkill={(prompt) => {
            composer.onChange(prompt);
            inputRef?.current?.focus();
          }}
        />
      }
      onSend={() => {
        onSend(composer.value.trim(), attachments.mediaIds);
        attachments.clear();
      }}
    />
  );
};
