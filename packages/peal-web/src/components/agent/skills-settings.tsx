"use client";

import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { DateTime, Exit } from "effect";
import { AsyncResult } from "effect/reactivity";
import {
  EllipsisIcon,
  MessageSquarePlusIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { AgentSkill } from "peal-contract/agent";
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
import { Button, buttonVariants } from "peal-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "peal-ui/components/dropdown-menu";
import {
  SettingsCard,
  SettingsRow,
  SettingsRowControl,
  SettingsRowDescription,
} from "peal-ui/components/settings";
import { toast } from "peal-ui/components/toast";
import { useState } from "react";

import {
  draftOf,
  emptySkillDraft,
  isSavable,
  skillRequestOf,
  skillUpdateOf,
} from "#agent/skill-draft.ts";
import type { SkillDraft } from "#agent/skill-draft.ts";
import { skillProblemOf } from "#agent/skill-refusal.ts";
import type { SkillProblem } from "#agent/skill-refusal.ts";
import {
  agentSkills,
  agentSkillsChanged,
  createAgentSkill,
  deleteAgentSkill,
  updateAgentSkill,
} from "#agent/skills.ts";
import {
  SkillFormView,
  SkillListView,
  skillProblemText,
} from "#components/agent/skill-views.tsx";
import { AppLink } from "#components/shell/app-link.tsx";
import { PageActions, PageTitle } from "#components/shell/frame-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { useRouter } from "#i18n/navigation.ts";
import { useMounted } from "#posts/use-mounted.ts";

/** Where the agent's settings and a skill's page are, in the workspace. */
const useSkillHrefs = (workspaceId: string) => {
  const workspaceHref = useWorkspaceHref();

  return {
    list: workspaceHref(workspaceId, "/settings/agent"),
    newSkill: workspaceHref(workspaceId, "/settings/agent/skills/new"),
    skill: (skillId: string) =>
      workspaceHref(workspaceId, `/settings/agent/skills/${skillId}`),
    chatWith: (skillId: string) =>
      workspaceHref(
        workspaceId,
        `/agent?${new URLSearchParams({ skill: skillId }).toString()}`
      ),
  };
};

/** The skills, once read in the browser, which has the person's cookies. */
const useSkillList = (workspaceId: string) => {
  const query = agentSkills(workspaceId);
  const result = useAtomValue(query);
  const refresh = useAtomRefresh(query);
  const mounted = useMounted();

  return { mounted, refresh, result };
};

const ListFailed = ({ onRetry }: { readonly onRetry: () => void }) => {
  const t = useTranslations("AgentSkills");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="text-destructive-text text-sm">{t("loadFailed")}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
};

/**
 * The agent's settings (`…/settings/agent`): the skills the person may
 * use, theirs and the workspace's, with **New skill** in the header.
 */
export const AgentSettingsScreen = ({
  workspaceId,
}: {
  readonly workspaceId: string;
}) => {
  const t = useTranslations("AgentSkills");
  const hrefs = useSkillHrefs(workspaceId);
  const { mounted, refresh, result } = useSkillList(workspaceId);

  const newSkill = (
    <AppLink href={hrefs.newSkill} className={buttonVariants()}>
      {t("new")}
    </AppLink>
  );

  return (
    <>
      <PageActions>
        <AppLink
          href={hrefs.newSkill}
          className={buttonVariants({ size: "sm", variant: "ghost" })}
        >
          <PlusIcon aria-hidden />
          {t("new")}
        </AppLink>
      </PageActions>
      {mounted && AsyncResult.isFailure(result) ? (
        <ListFailed onRetry={refresh} />
      ) : null}
      {mounted && AsyncResult.isSuccess(result) ? (
        <SkillListView
          hrefOf={hrefs.skill}
          link={AppLink}
          newSkill={newSkill}
          skills={result.value.skills}
        />
      ) : null}
    </>
  );
};

/** A skill's **…**: Use in chat, then Delete for one the person may change. */
const SkillMenu = ({
  onDelete,
  skill,
  chatHref,
}: {
  readonly onDelete: () => Promise<void>;
  readonly skill: AgentSkill;
  readonly chatHref: string;
}) => {
  const t = useTranslations("AgentSkills");
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

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
              router.push(chatHref);
            }}
          >
            <MessageSquarePlusIcon aria-hidden />
            {t("menu.useInChat")}
          </DropdownMenuItem>
          {skill.editable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setDeleting(true);
                }}
              >
                <Trash2Icon aria-hidden />
                {t("menu.delete")}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("menu.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("menu.deleteLine", { name: skill.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("menu.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void onDelete();
              }}
            >
              {t("menu.deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

/** A skill's form, saved as a new skill or as changes to `skill`. */
const SkillForm = ({
  mayShare,
  skill,
  workspaceId,
}: {
  readonly mayShare: boolean;
  /** The skill to change; none for a new one. */
  readonly skill: AgentSkill | null;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("AgentSkills");
  const router = useRouter();
  const hrefs = useSkillHrefs(workspaceId);
  const create = useAtomSet(createAgentSkill, { mode: "promiseExit" });
  const update = useAtomSet(updateAgentSkill, { mode: "promiseExit" });
  const remove = useAtomSet(deleteAgentSkill, { mode: "promiseExit" });

  const [draft, setDraft] = useState<SkillDraft>(() =>
    skill === null ? emptySkillDraft : draftOf(skill)
  );

  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<SkillProblem | null>(null);
  const reactivityKeys = agentSkillsChanged(workspaceId);
  const editable = skill?.editable ?? true;

  const save = async () => {
    setTried(true);

    if (!isSavable(draft)) {
      return;
    }

    if (
      skill !== null &&
      Object.keys(skillUpdateOf(skill, draft)).length === 0
    ) {
      router.push(hrefs.list);

      return;
    }

    setBusy(true);

    const exit =
      skill === null
        ? await create({
            params: { workspaceId },
            payload: skillRequestOf(draft),
            reactivityKeys,
          })
        : await update({
            params: { skillId: skill.id, workspaceId },
            payload: skillUpdateOf(skill, draft),
            reactivityKeys,
          });

    setBusy(false);
    setProblem(skillProblemOf(exit));

    if (Exit.isSuccess(exit)) {
      toast.success(skill === null ? t("created") : t("saved"));
      router.push(hrefs.list);
    }
  };

  const deleteSkill = async () => {
    if (skill === null) {
      return;
    }

    const exit = await remove({
      params: { skillId: skill.id, workspaceId },
      reactivityKeys,
    });

    const failed = skillProblemOf(exit);

    if (failed === null) {
      toast.success(t("deleted"));
      router.push(hrefs.list);
    } else {
      toast.error(
        failed === "unexpected"
          ? t("errors.deleteFailed")
          : skillProblemText(t, failed)
      );
    }
  };

  return (
    <>
      {skill === null ? null : (
        <>
          <PageTitle>{skill.name}</PageTitle>
          <PageActions>
            <SkillMenu
              skill={skill}
              chatHref={hrefs.chatWith(skill.id)}
              onDelete={deleteSkill}
            />
          </PageActions>
        </>
      )}
      <SkillFormView
        busy={busy}
        draft={draft}
        editable={editable}
        mayShare={mayShare}
        problem={problem}
        tried={tried}
        cancel={
          editable ? (
            <AppLink
              href={hrefs.list}
              className={buttonVariants({ variant: "outline" })}
            >
              {t("form.cancel")}
            </AppLink>
          ) : null
        }
        onChange={(changed) => {
          setDraft(changed);
          setProblem(null);
        }}
        onSave={() => {
          void save();
        }}
      />
    </>
  );
};

/**
 * A skill's page (`…/settings/agent/skills/<id>`, or `…/new` for a new
 * one): its form, and, for an existing one, its **…** in the header.
 * Who can use it is offered to those who may share a skill with the
 * workspace (`mayShare`, `assistant:configure`) only.
 */
export const SkillScreen = ({
  mayShare,
  skillId,
  workspaceId,
}: {
  readonly mayShare: boolean;
  /** The skill to open; null for a new one. */
  readonly skillId: string | null;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("AgentSkills");
  const hrefs = useSkillHrefs(workspaceId);
  const { mounted, refresh, result } = useSkillList(workspaceId);

  if (skillId === null) {
    return (
      <SkillForm mayShare={mayShare} skill={null} workspaceId={workspaceId} />
    );
  }

  if (!mounted || AsyncResult.isInitial(result)) {
    return null;
  }

  if (AsyncResult.isFailure(result)) {
    return <ListFailed onRetry={refresh} />;
  }

  const skill = result.value.skills.find(({ id }) => id === skillId);

  if (skill === undefined) {
    return (
      <SettingsCard>
        <SettingsRow>
          <SettingsRowDescription>{t("gone")}</SettingsRowDescription>
          <SettingsRowControl>
            <AppLink
              href={hrefs.list}
              className="text-brand-text text-sm underline-offset-2 hover:underline"
            >
              {t("backToList")}
            </AppLink>
          </SettingsRowControl>
        </SettingsRow>
      </SettingsCard>
    );
  }

  return (
    <SkillForm
      // A skill changed elsewhere starts the form again from it.
      key={`${skill.id}:${String(DateTime.toEpochMillis(skill.updatedAt))}`}
      mayShare={mayShare}
      skill={skill}
      workspaceId={workspaceId}
    />
  );
};
