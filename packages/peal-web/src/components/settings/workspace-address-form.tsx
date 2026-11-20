"use client";

import { useTranslations } from "next-intl";
import { isWorkspaceSlug } from "peal-contract/workspace-slug";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { authClient } from "#auth/client.ts";
import { FormField } from "#components/auth/form-field.tsx";
import { useRouter } from "#i18n/navigation.ts";
import { settingsErrorKey } from "#settings/errors.ts";
import type { SettingsErrorKey } from "#settings/errors.ts";
import { workspacePath } from "#shell/workspace-path.ts";

import { SettingsError } from "./settings-error.tsx";

// Changes the workspace's slug, the address its pages go by, through Better
// Auth's organization route, which checks organization:update and that no
// other workspace holds it; the server's hook checks the web app can route
// it. Once changed, the page opens under the new address.
export const WorkspaceAddressForm = ({
  slug,
  workspaceId,
}: {
  readonly slug: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("WorkspaceSettings.address");
  const settings = useTranslations("Settings");
  const router = useRouter();
  const [value, setValue] = useState(slug);
  const [error, setError] = useState<SettingsErrorKey | null>(null);
  const [isPending, startTransition] = useTransition();
  const chosen = value.trim();
  const valid = isWorkspaceSlug(chosen);

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const result = await authClient.organization.update({
        data: { slug: chosen },
        organizationId: workspaceId,
      });

      if (result.error === null) {
        setError(null);
        toast.success(t("changed", { slug: chosen }));
        router.replace(workspacePath(chosen, "/settings"));
        router.refresh();
      } else {
        setError(settingsErrorKey(result.error));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex max-w-sm flex-col gap-4">
      <SettingsError error={error} />
      <FormField
        id="workspace-address"
        type="text"
        autoComplete="off"
        label={t("label")}
        hint={valid || chosen === "" ? t("hint") : t("invalid")}
        value={value}
        onChange={setValue}
      />
      <div>
        <Button
          type="submit"
          disabled={isPending || !valid || chosen === slug}
          focusableWhenDisabled
        >
          {isPending ? settings("saving") : t("change")}
        </Button>
      </div>
    </form>
  );
};
