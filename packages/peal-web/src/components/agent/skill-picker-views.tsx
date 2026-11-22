"use client";

import {
  TriggerMenuContent,
  TriggerMenuItem,
  TriggerMenuItemIcon,
  TriggerMenuList,
  TriggerMenuSeparator,
  TriggerMenuStatus,
} from "@ui-sdk/react/trigger-menu";
import { BoxIcon, PlusIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AgentMessageSkill, AgentSkill } from "peal-contract/agent";
import { Button } from "peal-ui/components/button";

// The skills a message picks, as the composer and the person's message
// show them (DESIGN.md, "The agent"), and the "/" menu that picks them.
// Views only: the composer holds what is picked and what is typed.

/**
 * The skills picked for the message being written, as chips beside its
 * files: each one's name, and a way to take it off.
 */
export const SkillChipsView = ({
  onRemove,
  skills,
}: {
  readonly onRemove: (skillId: string) => void;
  readonly skills: readonly AgentMessageSkill[];
}) => {
  const t = useTranslations("Agent");

  if (skills.length === 0) {
    return null;
  }

  return (
    <ul aria-label={t("add.skills")} className="flex flex-wrap gap-1.5 px-1">
      {skills.map((skill) => (
        <li
          key={skill.id}
          className="bg-muted flex h-7 max-w-56 items-center gap-1.5 rounded-md ps-2 text-xs"
        >
          <BoxIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{skill.name}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("add.removeSkill", { name: skill.name })}
            onClick={() => {
              onRemove(skill.id);
            }}
          >
            <XIcon aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
};

/** The skills a message the person sent picked, beside its files. */
export const MessageSkillsView = ({
  skills,
}: {
  readonly skills: readonly AgentMessageSkill[];
}) => {
  const t = useTranslations("Agent");

  return skills.length === 0 ? null : (
    <ul
      aria-label={t("add.skills")}
      className="flex max-w-[85%] flex-wrap justify-end gap-1.5"
    >
      {skills.map((skill) => (
        <li
          key={skill.id}
          className="text-muted-foreground flex h-7 max-w-56 items-center gap-1.5 rounded-md border px-2 text-xs"
        >
          <BoxIcon aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">{skill.name}</span>
        </li>
      ))}
    </ul>
  );
};

/** The "/" menu's row that opens the new skill's page. */
export const createSkillValue = "create-skill";

// A row as peal-ui's menus draw theirs (DESIGN.md, "menu").
const rowClass =
  "flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-sm outline-hidden select-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground";

const iconClass = "flex shrink-0 [&_svg]:size-4";

/**
 * The "/" menu, above the text at the "/": the skills listed (each with
 * the workspace's mark when it is shared), then "Create skill…". ui-sdk's
 * trigger menu, around the composer, opens it and moves its highlight
 * while the focus stays in the field; the composer decides what it lists.
 */
export const SlashMenuView = ({
  skills,
}: {
  readonly skills: readonly AgentSkill[];
}) => {
  const t = useTranslations("Agent");

  return (
    <>
      <TriggerMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="bg-popover text-popover-foreground ring-foreground/10 z-50 max-h-64 w-64 overflow-y-auto rounded-lg p-1 shadow-md ring-1"
      >
        <TriggerMenuList aria-label={t("add.slashMenu")}>
          {skills.map((skill) => (
            <TriggerMenuItem
              key={skill.id}
              value={skill.id}
              label={skill.name}
              className={rowClass}
            >
              <TriggerMenuItemIcon className={iconClass}>
                <BoxIcon />
              </TriggerMenuItemIcon>
              <span className="min-w-0 truncate">{skill.name}</span>
              {skill.scope === "workspace" ? (
                <span className="text-muted-foreground ms-auto text-xs">
                  {t("add.workspaceSkill")}
                </span>
              ) : null}
            </TriggerMenuItem>
          ))}
          {skills.length === 0 ? null : (
            <TriggerMenuSeparator className="bg-border -mx-1 my-1 h-px" />
          )}
          <TriggerMenuItem
            value={createSkillValue}
            label={t("add.createSkill")}
            className={rowClass}
          >
            <TriggerMenuItemIcon className={iconClass}>
              <PlusIcon />
            </TriggerMenuItemIcon>
            {t("add.createSkill")}
          </TriggerMenuItem>
        </TriggerMenuList>
      </TriggerMenuContent>
      {/* In the reader's language; "Create skill…" is the last row. */}
      <TriggerMenuStatus className="sr-only">
        {({ count }) => t("add.slashStatus", { count: Math.max(0, count - 1) })}
      </TriggerMenuStatus>
    </>
  );
};
