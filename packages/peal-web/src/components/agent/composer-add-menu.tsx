"use client";

import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import {
  BarChart3Icon,
  BoxIcon,
  CalendarRangeIcon,
  ClockIcon,
  MessageSquareReplyIcon,
  PenLineIcon,
  PaperclipIcon,
  PlusIcon,
  RepeatIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { MediaContentTypeSchema } from "peal-contract";
import { Button } from "peal-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "peal-ui/components/dropdown-menu";
import { useRef } from "react";

import { panelWasLast } from "#agent/agent-surface.ts";
import { agentChatKeys } from "#shell/keys.ts";

/**
 * The agent's skills: ready-made requests for what a marketing team asks
 * most, each put in the composer to send as it is or finish.
 */
export const agentSkills = [
  "planWeek",
  "draft",
  "replies",
  "report",
  "adapt",
  "bestTimes",
] as const;

export type AgentSkill = (typeof agentSkills)[number];

const skillIcons: Readonly<Record<AgentSkill, LucideIcon>> = {
  adapt: RepeatIcon,
  bestTimes: ClockIcon,
  draft: PenLineIcon,
  planWeek: CalendarRangeIcon,
  replies: MessageSquareReplyIcon,
  report: BarChart3Icon,
};

// What the media library takes, as the uploader offers it.
const accept = MediaContentTypeSchema.literals.join(",");

/**
 * The composer's **+**: **File** (⌘⇧U), a file from the computer added to
 * the library and attached to the message, and **Skill**, a ready-made
 * request put in the composer.
 */
export const ComposerAddMenu = ({
  disabled,
  keys,
  onFiles,
  onSkill,
}: {
  readonly disabled: boolean;
  /** Where ⌘⇧U acts: this chat's page or the panel, as the chat's keys. */
  readonly keys?: "page" | "panel" | undefined;
  readonly onFiles: (files: readonly File[]) => void;
  readonly onSkill: (prompt: string) => void;
}) => {
  const t = useTranslations("Agent");
  const picker = useRef<HTMLInputElement>(null);
  const hint = useShortcutHint(agentChatKeys.attach);

  const choose = () => {
    picker.current?.click();
  };

  // ⌘⇧U writes nothing in a field, so it works while typing too.
  useShortcut(agentChatKeys.attach, choose, {
    description: t("add.file"),
    when: () =>
      keys !== undefined && !disabled && (keys === "panel") === panelWasLast(),
  });

  return (
    <>
      <input
        ref={picker}
        type="file"
        multiple
        hidden
        accept={accept}
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];

          // The same file can be chosen again.
          event.target.value = "";

          if (files.length > 0) {
            onFiles(files);
          }
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              corners="round"
              disabled={disabled}
              aria-label={t("add.label")}
            />
          }
        >
          <PlusIcon aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-52">
          <DropdownMenuItem onClick={choose}>
            <PaperclipIcon aria-hidden />
            {t("add.file")}
            <DropdownMenuShortcut>{hint.text}</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <BoxIcon aria-hidden />
              {t("add.skill")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-64">
              {agentSkills.map((skill) => {
                const Icon = skillIcons[skill];

                return (
                  <DropdownMenuItem
                    key={skill}
                    onClick={() => {
                      onSkill(t(`skills.${skill}.prompt`));
                    }}
                  >
                    <Icon aria-hidden />
                    {t(`skills.${skill}.title`)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
