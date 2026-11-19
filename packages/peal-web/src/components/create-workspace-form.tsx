"use client";

import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import { useState, useTransition } from "react";
import type { SubmitEvent } from "react";

import { chooseWorkspace } from "#auth/choose-workspace.ts";
import { authClient } from "#auth/client.ts";
import { authErrorKey } from "#auth/errors.ts";
import type { AuthClientError, AuthErrorKey } from "#auth/errors.ts";
import { FormError } from "#components/auth/form-error.tsx";
import { FormField } from "#components/auth/form-field.tsx";
import { useOfferAuthUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { useRouter } from "#i18n/navigation.ts";
import { workspacePath } from "#shell/workspace-path.ts";
import { slugsToTry, slugTaken } from "#workspaces/new-workspace.ts";

/** What creating a workspace answered: its slug, or Better Auth's error. */
export type Created =
  | { readonly slug: string }
  | { readonly error: AuthClientError };

/**
 * Creates a workspace the user owns, named `name`, under the first of
 * its slugs the server takes (`slugsToTry`): a slug another workspace
 * holds tries the next one. The workspace made becomes the session's
 * active one.
 */
export const createWorkspace = async (
  name: string,
  slugs: readonly string[]
): Promise<Created> => {
  const [slug, ...others] = slugs;

  if (slug === undefined) {
    return { error: { status: 400 } };
  }

  const result = await authClient.organization.create({ name, slug });

  if (result.error === null) {
    // Better Auth makes it active in the database, but the session's
    // cached cookie, which `/` reads, still names the last one for five
    // minutes: setting it again renews the cookie.
    chooseWorkspace(result.data.id);

    return { slug: result.data.slug };
  }

  return slugTaken(result.error.code) && others.length > 0
    ? await createWorkspace(name, others)
    : { error: result.error };
};

// Creates a workspace the user owns, then opens it.
export const CreateWorkspaceForm = () => {
  const t = useTranslations("AppPage");
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [isPending, startTransition] = useTransition();
  const offerUpgrade = useOfferAuthUpgrade();

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      const created = await createWorkspace(
        name,
        slugsToTry(name, crypto.randomUUID().slice(0, 8))
      );

      if ("slug" in created) {
        setError(null);
        router.push(workspacePath(created.slug));
        router.refresh();
      } else {
        setError(authErrorKey(created.error));
        offerUpgrade(created.error);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormError error={error} />
      <FormField
        id="workspace-name"
        type="text"
        autoComplete="organization"
        label={t("workspaceName")}
        value={name}
        onChange={setName}
      />
      <Button type="submit" disabled={isPending} focusableWhenDisabled>
        {isPending ? t("creating") : t("create")}
      </Button>
    </form>
  );
};
