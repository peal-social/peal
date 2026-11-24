"use client";

import { useAtomSet } from "@effect/atom-react";
import { Exit, Option } from "effect";
import { useTranslations } from "next-intl";
import { forWorkspace } from "peal-contract";
import type { Permission } from "peal-contract";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { useTransition } from "react";

import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { useRouter } from "#i18n/navigation.ts";
import { duplicatePost, postsKeys } from "#posts/api.ts";
import { duplicateFailureOf, mayDuplicate } from "#posts/duplicate.ts";
import { failureOf } from "#posts/outcome.ts";

interface DuplicatePostProps {
  /** Whether something else runs on the page, which the copy waits for. */
  readonly disabled?: boolean;
  readonly permissions: readonly Permission[];
  /** The post to copy; nothing shows for one not saved yet. */
  readonly postId: string | undefined;
  readonly workspaceId: string;
}

/**
 * Copies a post into a new draft, whatever the post's status, then opens
 * the draft in the composer. The copy has no time: the toast says so. It
 * shows for members who may read and create posts only.
 */
/**
 * Copies a post into a new draft and opens it, saying so in a toast, or
 * why it could not: what the button and the command menu both do.
 */
export const useDuplicatePost = (
  workspaceId: string
): ((postId: string) => Promise<void>) => {
  const t = useTranslations("Posts.Duplicate");
  const router = useRouter();
  const workspaceHref = useWorkspaceHref();
  const duplicate = useAtomSet(duplicatePost, { mode: "promiseExit" });

  return async (postId) => {
    const exit = await duplicate({
      headers: forWorkspace(workspaceId),
      params: { postId },
      reactivityKeys: postsKeys,
    });

    if (Exit.isSuccess(exit)) {
      toast.success(t("done"));
      // The composer, on the new draft.
      router.push(workspaceHref(workspaceId, `/posts/${exit.value.id}`));

      return;
    }

    const tag = failureOf(exit).pipe(
      Option.map(({ _tag }) => _tag),
      Option.getOrUndefined
    );

    toast.error(t("failed", { reason: duplicateFailureOf(tag) }));
  };
};

export const DuplicatePost = ({
  disabled = false,
  permissions,
  postId,
  workspaceId,
}: DuplicatePostProps) => {
  const t = useTranslations("Posts.Duplicate");
  const duplicate = useDuplicatePost(workspaceId);
  const [isCopying, startCopy] = useTransition();

  if (postId === undefined || !mayDuplicate(permissions)) {
    return null;
  }

  const handleDuplicate = () => {
    startCopy(async () => {
      await duplicate(postId);
    });
  };

  return (
    <Button
      variant="outline"
      disabled={disabled || isCopying}
      focusableWhenDisabled
      onClick={handleDuplicate}
    >
      {isCopying ? t("working") : t("open")}
    </Button>
  );
};
