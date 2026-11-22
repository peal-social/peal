"use client";

import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import { DateTime } from "effect";
import {
  ChevronDownIcon,
  CopyIcon,
  EllipsisIcon,
  PencilIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { useFormatter, useTimeZone, useTranslations } from "next-intl";
import type { AgentChat } from "peal-contract/agent";
import { maxAgentChatTitleLength } from "peal-contract/agent";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "peal-ui/components/alert-dialog";
import { Button } from "peal-ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "peal-ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "peal-ui/components/dropdown-menu";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import { useId, useState } from "react";

import { panelWasLast } from "#agent/agent-surface.ts";
import { dayGroupsOf } from "#agent/history.ts";
import { AgeText, chatTitle } from "#components/agent/agent-views.tsx";
import { agentChatKeys } from "#shell/keys.ts";

/**
 * The chat switcher: **New chat**, then the person's chats by the day
 * they last moved, each with how long ago.
 */
export const ChatSwitcher = ({
  chats,
  current,
  now,
  onChoose,
  onNewChat,
}: {
  readonly chats: readonly AgentChat[];
  readonly current: string | null;
  readonly now: DateTime.Utc | null;
  readonly onChoose: (chatId: string) => void;
  readonly onNewChat: () => void;
}) => {
  const t = useTranslations("Agent");
  const format = useFormatter();
  const timeZone = useTimeZone() ?? "UTC";
  const groups = now === null ? [] : dayGroupsOf(chats, now, timeZone);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("menu.switch")}
          />
        }
      >
        <ChevronDownIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 w-72">
        <DropdownMenuItem onClick={onNewChat}>
          <PlusIcon aria-hidden />
          {t("newChat")}
        </DropdownMenuItem>
        {groups.map(({ chats: those, day, key }) => (
          <DropdownMenuGroup key={key}>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              {DateTime.isDateTime(day)
                ? format.dateTime(DateTime.toDate(day), { dateStyle: "medium" })
                : t(`groups.${day}`)}
            </DropdownMenuLabel>
            {those.map((chat) => (
              <DropdownMenuItem
                key={chat.id}
                aria-current={chat.id === current ? "true" : undefined}
                onClick={() => {
                  onChoose(chat.id);
                }}
              >
                <span className="min-w-0 flex-1 truncate">
                  {chatTitle(t, chat.title)}
                </span>
                {now === null ? null : (
                  <AgeText at={chat.updatedAt} now={now} />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

/** The star that keeps a chat among the person's favourites. */
export const StarButton = ({
  onStar,
  starred,
}: {
  readonly onStar: (starred: boolean) => void;
  readonly starred: boolean;
}) => {
  const t = useTranslations("Agent");

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t("menu.star")}
      aria-pressed={starred}
      onClick={() => {
        onStar(!starred);
      }}
    >
      <StarIcon aria-hidden className={starred ? "fill-current" : undefined} />
    </Button>
  );
};

const RenameDialog = ({
  onOpenChange,
  onRename,
  open,
  title,
}: {
  readonly onOpenChange: (open: boolean) => void;
  readonly onRename: (title: string) => Promise<boolean>;
  readonly open: boolean;
  readonly title: string;
}) => {
  const t = useTranslations("Agent");
  const fieldId = useId();
  const [value, setValue] = useState(title);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const trimmed = value.trim();

  const save = async (next: string) => {
    setSaving(true);

    const done = await onRename(next);

    setSaving(false);
    setFailed(!done);

    if (done) {
      onOpenChange(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setValue(title);
          setFailed(false);
        }

        onOpenChange(next);
      }}
    >
      <DialogContent closeLabel={t("menu.cancel")}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            if (trimmed === "" || saving) {
              return;
            }

            void save(trimmed);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("menu.renameTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={fieldId}>{t("menu.titleLabel")}</Label>
            <Input
              id={fieldId}
              value={value}
              maxLength={maxAgentChatTitleLength}
              aria-invalid={failed}
              onChange={(event) => {
                setValue(event.target.value);
              }}
            />
            {failed ? (
              <p role="alert" className="text-destructive-text text-sm">
                {t("errors.generic")}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t("menu.cancel")}
            </Button>
            <Button type="submit" disabled={trimmed === "" || saving}>
              {t("menu.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Focus in a field keeps ⌘⌫ for the text.
const typing = (): boolean =>
  document.activeElement?.matches(
    "input, textarea, select, [contenteditable]:not([contenteditable='false'])"
  ) ?? false;

/**
 * The chat's **…**: Rename (⇧R), Copy as markdown and Delete (⌘⌫), which
 * asks first. `keys` binds the shortcuts, on the chat's own page only.
 */
export const ChatMoreMenu = ({
  keys,
  onCopy,
  onDelete,
  onRename,
  title,
}: {
  /**
   * Where the menu's keys act: the chat's page or the panel, whichever
   * the person last used when both show a chat; none without it.
   */
  readonly keys?: "page" | "panel" | undefined;
  readonly onCopy: () => void;
  readonly onDelete: () => void;
  readonly onRename: (title: string) => Promise<boolean>;
  readonly title: string;
}) => {
  const t = useTranslations("Agent");
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const renameHint = useShortcutHint(agentChatKeys.rename);
  const deleteHint = useShortcutHint(agentChatKeys.delete);

  // Never while typing: ⇧R writes an R there, ⌘⌫ deletes a word.
  const active = () =>
    keys !== undefined && !typing() && (keys === "panel") === panelWasLast();

  useShortcut(
    agentChatKeys.rename,
    () => {
      setRenaming(true);
    },
    { description: t("menu.rename"), when: active }
  );

  useShortcut(
    agentChatKeys.delete,
    () => {
      setDeleting(true);
    },
    { description: t("menu.delete"), when: active }
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("menu.label")}
            />
          }
        >
          <EllipsisIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onClick={() => {
              setRenaming(true);
            }}
          >
            <PencilIcon aria-hidden />
            {t("menu.rename")}
            <DropdownMenuShortcut>{renameHint.text}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopy}>
            <CopyIcon aria-hidden />
            {t("menu.copyMarkdown")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setDeleting(true);
            }}
          >
            <Trash2Icon aria-hidden />
            {t("menu.delete")}
            <DropdownMenuShortcut>{deleteHint.text}</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <RenameDialog
        // A title that changed (the chat read, or named) starts the field
        // again from it: the menu opens the dialog without its handler.
        key={title}
        open={renaming}
        title={title}
        onOpenChange={setRenaming}
        onRename={onRename}
      />
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("menu.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("menu.deleteLine")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("menu.cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={onDelete}>
              {t("menu.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
