"use client";

import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts";
import { BoxIcon, PaperclipIcon, PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { MediaContentTypeSchema } from "peal-contract";
import type { AgentSkill } from "peal-contract/agent";
import { Button } from "peal-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "peal-ui/components/dropdown-menu";
import { useRef } from "react";

import { panelWasLast } from "#agent/agent-surface.ts";
import { agentChatKeys } from "#shell/keys.ts";

// What the media library takes, as the uploader offers it.
const accept = MediaContentTypeSchema.literals.join(",");

/**
 * The composer's **+**: **File** (⌘⇧U), a file from the computer added to
 * the library and attached to the message, and **Skill**, the person's
 * skills the message may still pick, then "Create skill…".
 */
export const ComposerAddMenu = ({
  disabled,
  keys,
  onCreateSkill,
  onFiles,
  onSkill,
  skills,
}: {
  readonly disabled: boolean;
  /** Where ⌘⇧U acts: this chat's page or the panel, as the chat's keys. */
  readonly keys?: "page" | "panel" | undefined;
  readonly onCreateSkill: () => void;
  readonly onFiles: (files: readonly File[]) => void;
  readonly onSkill: (skill: AgentSkill) => void;
  /** The skills the message may still pick. */
  readonly skills: readonly AgentSkill[];
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
            <DropdownMenuSubContent className="w-80 max-w-[calc(100vw-2rem)]">
              {skills.map((skill) => (
                <DropdownMenuItem
                  key={skill.id}
                  onClick={() => {
                    onSkill(skill);
                  }}
                >
                  <BoxIcon aria-hidden />
                  <span className="min-w-0 truncate">{skill.name}</span>
                  {skill.scope === "workspace" ? (
                    <span className="text-muted-foreground ms-auto shrink-0 ps-2 text-xs whitespace-nowrap">
                      {t("add.workspaceSkill")}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ))}
              {skills.length === 0 ? null : <DropdownMenuSeparator />}
              <DropdownMenuItem onClick={onCreateSkill}>
                <PlusIcon aria-hidden />
                {t("add.createSkill")}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};
