"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Exit } from "effect";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { ApprovalPolicySchema } from "peal-contract";
import type { ApprovalPolicy } from "peal-contract";
import { toast } from "peal-ui/components/toast";
import { useId, useState, useTransition } from "react";

import { useHydrated } from "#components/media/use-hydrated.ts";
import {
  reviewKeys,
  reviewSettings,
  updateReviewSettings,
} from "#review/api.ts";

interface PolicyFieldsProps {
  readonly disabled: boolean;
  readonly onChange: (policy: ApprovalPolicy) => void;
  readonly value: ApprovalPolicy;
}

/** The three policies, each with what it means for the team. */
export const PolicyFields = ({
  disabled,
  onChange,
  value,
}: PolicyFieldsProps) => {
  const t = useTranslations("Review.policy");
  const name = useId();

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="sr-only">{t("legend")}</legend>
      {ApprovalPolicySchema.literals.map((policy) => {
        const id = `${name}-${policy}`;

        return (
          <div key={policy} className="flex items-start gap-3">
            <input
              id={id}
              type="radio"
              name={name}
              className="accent-primary mt-1"
              checked={value === policy}
              aria-describedby={`${id}-hint`}
              onChange={() => {
                onChange(policy);
              }}
            />
            <div className="flex flex-col gap-1">
              <label htmlFor={id} className="text-sm font-medium">
                {t("option", { policy })}
              </label>
              <p id={`${id}-hint`} className="text-muted-foreground text-xs">
                {t("hint", { policy })}
              </p>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
};

// The choice, once the workspace's policy is known: saved as soon as
// another policy is chosen, and put back when it could not be.
const LoadedForm = ({
  current,
  workspaceId,
}: {
  readonly current: ApprovalPolicy;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Review.policy");
  const update = useAtomSet(updateReviewSettings, { mode: "promiseExit" });
  const [policy, setPolicy] = useState(current);
  const [isPending, startTransition] = useTransition();

  const handleChange = (chosen: ApprovalPolicy) => {
    if (chosen === policy) {
      return;
    }

    const before = policy;

    setPolicy(chosen);

    startTransition(async () => {
      const exit = await update({
        params: { workspaceId },
        payload: { approvalPolicy: chosen },
        reactivityKeys: reviewKeys,
      });

      if (Exit.isSuccess(exit)) {
        toast.success(t("saved"));
      } else {
        setPolicy(before);
        toast.error(t("saveFailed"));
      }
    });
  };

  return (
    <PolicyFields disabled={isPending} value={policy} onChange={handleChange} />
  );
};

const LoadedPolicy = ({ workspaceId }: { readonly workspaceId: string }) => {
  const t = useTranslations("Review.policy");
  const settings = useAtomValue(reviewSettings(workspaceId));

  if (AsyncResult.isFailure(settings)) {
    return <p className="text-muted-foreground text-sm">{t("loadFailed")}</p>;
  }

  return AsyncResult.isSuccess(settings) ? (
    <LoadedForm
      key={settings.value.approvalPolicy}
      current={settings.value.approvalPolicy}
      workspaceId={workspaceId}
    />
  ) : null;
};

/**
 * Chooses which of the workspace's posts wait for an approval, for those
 * who may change the workspace (organization:update). The policy is read
 * with the visitor's cookies, once the page has hydrated.
 */
export const ApprovalPolicyForm = ({
  workspaceId,
}: {
  readonly workspaceId: string;
}) => (useHydrated() ? <LoadedPolicy workspaceId={workspaceId} /> : null);
