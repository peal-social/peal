"use client";

import { Option } from "effect";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { authClient } from "#auth/client.ts";
import { authErrorKey } from "#auth/errors.ts";
import type { AuthErrorKey } from "#auth/errors.ts";
import { FormError } from "#components/auth/form-error.tsx";
import {
  createWorkspace,
  CreateWorkspaceForm,
} from "#components/create-workspace-form.tsx";
import type { Created } from "#components/create-workspace-form.tsx";
import { useRouter } from "#i18n/navigation.ts";
import { workspacePath } from "#shell/workspace-path.ts";
import {
  decodeInvitations,
  openInvitationOf,
  slugTaken,
} from "#workspaces/new-workspace.ts";

// Creates the workspace under its own slug, the first of `slugs`. When
// that slug is taken, by this very workspace made meanwhile in another tab
// (none: `/` now opens it) or by one the person left, the others are
// tried, so two tabs never make two.
const createFirst = async (
  name: string,
  slugs: readonly string[]
): Promise<Created | null> => {
  const [own, ...others] = slugs;
  const first = await createWorkspace(name, own === undefined ? [] : [own]);

  if ("slug" in first || !slugTaken(first.error.code)) {
    return first;
  }

  const listed = await authClient.organization.list();

  return (listed.data ?? []).length > 0
    ? null
    : await createWorkspace(name, others);
};

/**
 * For someone who reaches `/` with no workspace, after signing up or in:
 * an invitation still open opens, so they join that workspace; otherwise
 * the workspace made for them (`name`, under the first of `slugs` the
 * server takes) is created, once, and opened. Should creating it fail, the
 * form to create one by hand shows, with why.
 */
export const FirstWorkspace = ({
  name,
  slugs,
}: {
  readonly name: string;
  readonly slugs: readonly string[];
}) => {
  const t = useTranslations("AppPage");
  const router = useRouter();
  // Once a page load, whatever React mounts twice.
  const started = useRef(false);
  const [failed, setFailed] = useState<AuthErrorKey | null>(null);

  useEffect(() => {
    if (started.current) {
      return;
    }

    started.current = true;

    const settle = async () => {
      const invitations = await authClient.organization.listUserInvitations();

      const invitation = decodeInvitations(invitations.data).pipe(
        Option.map((listed) => openInvitationOf(listed, new Date())),
        Option.getOrNull
      );

      if (invitation !== null) {
        router.replace(`/invitations/${invitation}`);

        return;
      }

      const created = await createFirst(name, slugs);

      if (created === null) {
        router.refresh();

        return;
      }

      if ("slug" in created) {
        router.replace(workspacePath(created.slug));
        router.refresh();

        return;
      }

      setFailed(authErrorKey(created.error));
    };

    void settle();
  }, [name, router, slugs]);

  if (failed === null) {
    return <output className="text-muted-foreground">{t("settingUp")}</output>;
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      <FormError error={failed} />
      <p className="text-muted-foreground">{t("createDescription")}</p>
      <CreateWorkspaceForm />
    </div>
  );
};
