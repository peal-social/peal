"use client";

import { DateTime, Match } from "effect";
import { BotIcon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import {
  maxAgentSkillInstructionsLength,
  maxAgentSkillNameLength,
  maxAgentSkills,
} from "peal-contract/agent";
import type { AgentSkill, AgentSkillScope } from "peal-contract/agent";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Badge } from "peal-ui/components/badge";
import { Button } from "peal-ui/components/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "peal-ui/components/empty-state";
import { Input } from "peal-ui/components/input";
import { Label } from "peal-ui/components/label";
import { Textarea } from "peal-ui/components/textarea";
import { useId } from "react";
import type { ReactNode } from "react";

import { problemsOf } from "#agent/skill-draft.ts";
import type { SkillDraft } from "#agent/skill-draft.ts";
import type { SkillProblem } from "#agent/skill-refusal.ts";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";

// The views of the agent's settings: the person's skills, and a skill's
// form, whatever fetched them. The pages' state is in skills-settings.tsx.

type Translate = ReturnType<typeof useTranslations<"AgentSkills">>;

/** Whose a skill is: "Personal" or "Workspace". */
export const SkillScopeBadge = ({
  scope,
}: {
  readonly scope: AgentSkillScope;
}) => {
  const t = useTranslations("AgentSkills");

  return <Badge variant="outline">{t("scope", { scope })}</Badge>;
};

/**
 * The person's skills in one bordered list, each row its name, whose it
 * is and when it last changed, opening its page; or, with none, the empty
 * state saying what a skill is, with **New skill**.
 */
export const SkillListView = ({
  hrefOf,
  link: AppLink,
  newSkill,
  skills,
}: {
  readonly hrefOf: (skillId: string) => string;
  readonly link: LinkComponent;
  /** The way to make one, as the empty state's next step. */
  readonly newSkill: ReactNode;
  readonly skills: readonly AgentSkill[];
}) => {
  const t = useTranslations("AgentSkills");
  const format = useFormatter();

  if (skills.length === 0) {
    return (
      <EmptyState>
        <EmptyStateIcon icon={<BotIcon />} />
        <EmptyStateTitle>{t("emptyTitle")}</EmptyStateTitle>
        <EmptyStateDescription>{t("empty")}</EmptyStateDescription>
        <EmptyStateActions>{newSkill}</EmptyStateActions>
      </EmptyState>
    );
  }

  return (
    <ul className="bg-card divide-y rounded-lg border">
      {skills.map((skill) => (
        <li key={skill.id}>
          <AppLink
            href={hrefOf(skill.id)}
            className="hover:bg-muted focus-visible:ring-ring/50 flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm outline-none focus-visible:ring-3"
          >
            <span className="min-w-0 truncate font-medium">{skill.name}</span>
            <SkillScopeBadge scope={skill.scope} />
            <span className="text-muted-foreground ms-auto text-xs">
              {t("updated", {
                at: format.dateTime(DateTime.toDate(skill.updatedAt), {
                  dateStyle: "medium",
                }),
              })}
            </span>
          </AppLink>
        </li>
      ))}
    </ul>
  );
};

/** What to tell the person about a skill that was not saved or deleted. */
export const skillProblemText = (t: Translate, problem: SkillProblem): string =>
  Match.value(problem).pipe(
    Match.when("nameTaken", () => t("errors.nameTaken")),
    Match.when("tooMany", () => t("errors.tooMany", { max: maxAgentSkills })),
    Match.when("notEditable", () => t("errors.notEditable")),
    Match.when("notFound", () => t("errors.notFound")),
    Match.when("forbidden", () => t("errors.forbidden")),
    Match.when("unexpected", () => t("errors.unexpected")),
    Match.exhaustive
  );

const fieldProblem = (
  t: Translate,
  field: "instructions" | "name",
  problem: "empty" | "tooLong" | null
): string | null => {
  if (problem === null) {
    return null;
  }

  const max =
    field === "name"
      ? maxAgentSkillNameLength
      : maxAgentSkillInstructionsLength;

  return problem === "empty"
    ? t(field === "name" ? "form.nameEmpty" : "form.instructionsEmpty")
    : t(field === "name" ? "form.nameTooLong" : "form.instructionsTooLong", {
        max,
      });
};

const scopes: readonly AgentSkillScope[] = ["personal", "workspace"];

/**
 * A skill's form: its name, its instructions counted against the limit,
 * and who can use it, then **Save** and **Cancel**. Who can use it shows
 * only to those who may share a skill with the workspace
 * (`assistant:configure`): anyone else's skills are their own. A skill the
 * person may not change shows read-only, with the line saying why, and no
 * Save. A field says what is wrong only once the person tried to save.
 */
export const SkillFormView = ({
  busy,
  cancel,
  draft,
  editable,
  mayShare,
  onChange,
  onSave,
  problem,
  tried,
}: {
  readonly busy: boolean;
  /** The way back to the list, as a link. */
  readonly cancel: ReactNode;
  readonly draft: SkillDraft;
  readonly editable: boolean;
  /** The person may make a skill the workspace's (`assistant:configure`). */
  readonly mayShare: boolean;
  readonly onChange: (draft: SkillDraft) => void;
  readonly onSave: () => void;
  /** Why the last save was refused, if it was. */
  readonly problem: SkillProblem | null;
  /** Whether the person tried to save, so the fields say what is wrong. */
  readonly tried: boolean;
}) => {
  const t = useTranslations("AgentSkills");
  const id = useId();
  const nameId = `${id}-name`;
  const instructionsId = `${id}-instructions`;
  const problems = problemsOf(draft);
  const disabled = busy || !editable;
  const nameProblem = tried ? fieldProblem(t, "name", problems.name) : null;

  const instructionsProblem = tried
    ? fieldProblem(t, "instructions", problems.instructions)
    : null;

  return (
    <form
      className="flex max-w-3xl flex-col gap-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();

        if (editable && !busy) {
          onSave();
        }
      }}
    >
      {editable ? null : (
        <p className="text-muted-foreground text-sm">{t("readOnly")}</p>
      )}
      {problem === null ? null : (
        <Alert variant="destructive">
          <AlertDescription>{skillProblemText(t, problem)}</AlertDescription>
        </Alert>
      )}
      <div className="flex max-w-sm flex-col gap-2">
        <Label htmlFor={nameId}>{t("form.name")}</Label>
        <Input
          id={nameId}
          value={draft.name}
          maxLength={maxAgentSkillNameLength}
          disabled={disabled}
          required
          aria-invalid={nameProblem !== null}
          aria-describedby={`${nameId}-hint`}
          onChange={(event) => {
            onChange({ ...draft, name: event.target.value });
          }}
        />
        <p
          id={`${nameId}-hint`}
          className={
            nameProblem === null
              ? "text-muted-foreground text-xs"
              : "text-destructive-text text-xs"
          }
        >
          {nameProblem ?? t("form.nameHint", { max: maxAgentSkillNameLength })}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={instructionsId}>{t("form.instructions")}</Label>
        <Textarea
          id={instructionsId}
          value={draft.instructions}
          rows={10}
          disabled={disabled}
          required
          aria-invalid={
            instructionsProblem !== null || problems.instructions === "tooLong"
          }
          aria-describedby={`${instructionsId}-hint ${instructionsId}-count`}
          onChange={(event) => {
            onChange({ ...draft, instructions: event.target.value });
          }}
        />
        <div className="flex flex-wrap justify-between gap-2 text-xs">
          <p
            id={`${instructionsId}-hint`}
            className={
              instructionsProblem === null
                ? "text-muted-foreground"
                : "text-destructive-text"
            }
          >
            {instructionsProblem ?? t("form.instructionsHint")}
          </p>
          <p
            id={`${instructionsId}-count`}
            className={
              problems.instructions === "tooLong"
                ? "text-destructive-text tabular-nums"
                : "text-muted-foreground tabular-nums"
            }
          >
            {t("form.instructionsCount", {
              count: draft.instructions.length,
              max: maxAgentSkillInstructionsLength,
            })}
          </p>
        </div>
      </div>
      {mayShare ? (
        <fieldset className="flex flex-col gap-3" disabled={disabled}>
          <legend className="mb-3 text-sm font-medium">
            {t("form.scope")}
          </legend>
          {scopes.map((scope) => {
            const optionId = `${id}-scope-${scope}`;

            return (
              <div key={scope} className="flex items-start gap-2">
                <input
                  id={optionId}
                  type="radio"
                  name={`${id}-scope`}
                  className="accent-primary mt-0.5"
                  checked={draft.scope === scope}
                  aria-describedby={`${optionId}-hint`}
                  onChange={() => {
                    onChange({ ...draft, scope });
                  }}
                />
                <div className="flex flex-col gap-0.5">
                  <label htmlFor={optionId} className="text-sm">
                    {scope === "personal"
                      ? t("form.personal")
                      : t("form.workspace")}
                  </label>
                  <p
                    id={`${optionId}-hint`}
                    className="text-muted-foreground text-xs"
                  >
                    {scope === "personal"
                      ? t("form.personalHint")
                      : t("form.workspaceHint")}
                  </p>
                </div>
              </div>
            );
          })}
        </fieldset>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {editable ? (
          <Button type="submit" disabled={busy}>
            {t("form.save")}
          </Button>
        ) : null}
        {cancel}
      </div>
    </form>
  );
};
