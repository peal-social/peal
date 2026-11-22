"use client";

import { useAtomValue } from "@effect/atom-react";
import { TriggerMenu, textFieldAdapter } from "@ui-sdk/react/trigger-menu";
import type {
  TextEditorAdapter,
  TriggerDefinition,
} from "@ui-sdk/react/trigger-menu";
import { AsyncResult } from "effect/reactivity";
import {
  LoaderCircleIcon,
  PaperclipIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { maxAgentSkillNameLength } from "peal-contract/agent";
import type {
  AgentMedia,
  AgentMessageSkill,
  AgentSkill,
} from "peal-contract/agent";
import { Button } from "peal-ui/components/button";
import { cn } from "peal-ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps, RefObject } from "react";

import {
  offeredSkills,
  pickSkill,
  sentTextOf,
  slashSkillsOf,
} from "#agent/skill-picker.ts";
import { agentSkills } from "#agent/skills.ts";
import { ComposerView } from "#components/agent/chat-views.tsx";
import { ComposerAddMenu } from "#components/agent/composer-add-menu.tsx";
import {
  SkillChipsView,
  SlashMenuView,
  createSkillValue,
} from "#components/agent/skill-picker-views.tsx";
import { useAttachments } from "#components/agent/use-attachments.ts";
import type { Attachment } from "#components/agent/use-attachments.ts";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { useRouter } from "#i18n/navigation.ts";

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

const noSkills: readonly AgentSkill[] = [];

/** The person's skills in the workspace, or none while they are read. */
const useSkills = (workspaceId: string): readonly AgentSkill[] => {
  const skills = useAtomValue(agentSkills(workspaceId));

  return AsyncResult.isSuccess(skills) ? skills.value.skills : noSkills;
};

// "/" at the start of the text or of a word, followed by a skill's name
// as it is typed, spaces and all; the composer lists the skills itself.
const slashTrigger: TriggerDefinition = {
  boundary: "word",
  char: "/",
  filter: false,
  maxLength: maxAgentSkillNameLength,
  pattern: /\S/u,
  spaces: true,
};

const slashTriggers = [slashTrigger];

/**
 * The trigger menu's hold on the composer's field, made once the field
 * is drawn, and the ref that draws it, which also fills `fieldRef`, the
 * field the page and the panel focus.
 */
const useFieldEditor = (fieldRef: RefObject<HTMLTextAreaElement | null>) => {
  const [editor, setEditor] = useState<TextEditorAdapter>();

  const attach = useCallback(
    (field: HTMLTextAreaElement | null) => {
      fieldRef.current = field;

      if (field !== null) {
        setEditor((held) =>
          held?.element === field ? held : textFieldAdapter(field)
        );
      }
    },
    [fieldRef]
  );

  return { attach, editor };
};

/**
 * The "/" menu, ui-sdk's trigger menu on the composer's field, apart from
 * the composer: what it lists and whether it is open are its own state,
 * so typing "/" re-renders it alone. Re-rendering the composer from the
 * field's own input listener, before React reads the field, would put
 * the text back without the "/". `openRef` tells the composer's keys
 * whether it is open.
 */
const SlashSkillMenu = ({
  disabled,
  editor,
  offered,
  onCreate,
  onPick,
  openRef,
  skills,
}: {
  readonly disabled: boolean;
  readonly editor: TextEditorAdapter | undefined;
  /** The skills the message may still pick. */
  readonly offered: readonly AgentSkill[];
  readonly onCreate: () => void;
  readonly onPick: (skill: AgentSkill) => void;
  readonly openRef: RefObject<boolean>;
  /** Every skill the person may use. */
  readonly skills: readonly AgentSkill[];
}) => {
  const [wanted, setWanted] = useState(false);
  const [query, setQuery] = useState("");
  const listed = slashSkillsOf(query, offered);
  const open = wanted && listed !== null && !disabled;

  useEffect(() => {
    if (open) {
      openRef.current = true;
    }

    // Picking with Enter closes the menu, and React may render that
    // before the composer's own handler reads the same key, which would
    // then send the message: the menu reads as open until the key's event
    // is over.
    const later = window.setTimeout(() => {
      openRef.current = open;
    }, 0);

    return () => {
      window.clearTimeout(later);
    };
  }, [open, openRef]);

  return (
    <TriggerMenu
      {...(editor === undefined ? {} : { editor })}
      open={open}
      triggers={slashTriggers}
      onOpenChange={(next) => {
        setWanted(next);
      }}
      onQueryChange={(next) => {
        setQuery(next);
      }}
      onSelect={(value, details) => {
        // The "/" and what follows it leave the text: the skill is a chip.
        details.insert("");

        const skill = skills.find(({ id }) => id === value);

        if (skill !== undefined) {
          onPick(skill);
        } else if (value === createSkillValue) {
          onCreate();
        }
      }}
    >
      <SlashMenuView skills={listed ?? noSkills} />
    </TriggerMenu>
  );
};

/**
 * The agent's composer with its **+**, its "/" menu and its chips: files
 * attached to the message, and skills picked for it (three at most).
 * `onSend` gets the text, or the skills' names when only skills are
 * picked, the files as the library names them and the skills; then the
 * files empty, and the chat empties the skills.
 */
export const AgentComposer = ({
  inputRef,
  keys,
  onSend,
  onSkills,
  skills: picked,
  workspaceId,
  ...composer
}: Omit<
  ComponentProps<typeof ComposerView>,
  | "addMenu"
  | "attachments"
  | "blocked"
  | "inputRef"
  | "isMenuOpen"
  | "menu"
  | "onSend"
  | "picked"
> & {
  readonly inputRef?: RefObject<HTMLTextAreaElement | null> | undefined;
  /** Where ⌘⇧U acts: this chat's page or the panel. */
  readonly keys?: "page" | "panel" | undefined;
  readonly onSend: (
    text: string,
    media: readonly AgentMedia[],
    skills: readonly AgentMessageSkill[]
  ) => void;
  /** The skills picked once one is added or taken off. */
  readonly onSkills: (skills: readonly AgentMessageSkill[]) => void;
  /** The skills picked for this message. */
  readonly skills: readonly AgentMessageSkill[];
  readonly workspaceId: string;
}) => {
  const attachments = useAttachments(workspaceId);
  const { add: handleFiles, remove: handleRemove } = attachments;
  const router = useRouter();
  const workspaceHref = useWorkspaceHref();
  const ownInputRef = useRef<HTMLTextAreaElement>(null);
  const fieldRef = inputRef ?? ownInputRef;
  const { attach, editor } = useFieldEditor(fieldRef);
  const skills = useSkills(workspaceId);
  const offered = offeredSkills(skills, picked);
  const menuOpenRef = useRef(false);

  const createSkill = () => {
    router.push(workspaceHref(workspaceId, "/settings/agent/skills/new"));
  };

  const add = (skill: AgentSkill) => {
    onSkills(pickSkill(picked, skill));
    fieldRef.current?.focus();
  };

  return (
    <ComposerView
      {...composer}
      inputRef={attach}
      blocked={attachments.blocked}
      menu={
        <SlashSkillMenu
          disabled={composer.disabled}
          editor={editor}
          offered={offered}
          openRef={menuOpenRef}
          skills={skills}
          onCreate={createSkill}
          onPick={(skill) => {
            onSkills(pickSkill(picked, skill));
          }}
        />
      }
      isMenuOpen={() => menuOpenRef.current}
      picked={picked.length > 0}
      attachments={
        picked.length === 0 && attachments.items.length === 0 ? null : (
          <div className="flex flex-col gap-1.5">
            <SkillChipsView
              skills={picked}
              onRemove={(skillId) => {
                onSkills(picked.filter(({ id }) => id !== skillId));
              }}
            />
            <AttachmentsView
              items={attachments.items}
              onRemove={handleRemove}
            />
          </div>
        )
      }
      addMenu={
        <ComposerAddMenu
          disabled={composer.disabled || composer.running}
          keys={keys}
          skills={offered}
          onCreateSkill={createSkill}
          onFiles={handleFiles}
          onSkill={add}
        />
      }
      onSend={() => {
        onSend(sentTextOf(composer.value, picked), attachments.media, picked);
        attachments.clear();
      }}
    />
  );
};
