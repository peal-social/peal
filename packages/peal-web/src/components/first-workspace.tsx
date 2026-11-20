"use client";

import { Option } from "effect";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { authClient } from "#auth/client.ts";
import { CreateWorkspaceForm } from "#components/create-workspace-form.tsx";
import { useRouter } from "#i18n/navigation.ts";
import {
  decodeInvitations,
  openInvitationOf,
} from "#workspaces/new-workspace.ts";

/**
 * For someone who reaches `/` with no workspace, after signing up or in:
 * an invitation still open opens, so they join that workspace; otherwise
 * they make their first one, its name (`name`, after them) and its
 * address offered and theirs to replace, which opens once made.
 */
export const FirstWorkspace = ({ name }: { readonly name: string }) => {
  const t = useTranslations("AppPage");
  const router = useRouter();
  // Once a page load, whatever React mounts twice.
  const started = useRef(false);
  const [invited, setInvited] = useState<boolean | null>(null);

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

      if (invitation === null) {
        setInvited(false);

        return;
      }

      setInvited(true);
      router.replace(`/invitations/${invitation}`);
    };

    void settle();
  }, [router]);

  if (invited !== false) {
    return <output className="text-muted-foreground">{t("settingUp")}</output>;
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 py-[12vh]">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("createTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("firstDescription")}</p>
      </div>
      <CreateWorkspaceForm initialName={name} />
    </div>
  );
};
