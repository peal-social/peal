"use client";

import { useTranslations } from "next-intl";
import { isWorkspaceSlug } from "peal-contract/workspace-slug";
import { Button } from "peal-ui/components/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "peal-ui/components/input-group";
import { Label } from "peal-ui/components/label";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { ChangeEvent, SubmitEvent } from "react";

import { chooseWorkspace } from "#auth/choose-workspace.ts";
import { authClient } from "#auth/client.ts";
import { authErrorKey } from "#auth/errors.ts";
import type { AuthErrorKey } from "#auth/errors.ts";
import { FormError } from "#components/auth/form-error.tsx";
import { FormField } from "#components/auth/form-field.tsx";
import { useOfferAuthUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { useDebounced } from "#components/media/use-debounced.ts";
import { useRouter } from "#i18n/navigation.ts";
import { useMounted } from "#posts/use-mounted.ts";
import { setupChannelsPath } from "#shell/workspace-path.ts";
import {
  createRefusalOf,
  slugAvailabilityOf,
  slugTaken,
  suggestedSlugOf,
} from "#workspaces/new-workspace.ts";
import type { SlugAvailability } from "#workspaces/new-workspace.ts";

// How long the address stays the same before the server is asked whether
// it is free.
const checkDelayMs = 300;

// Whether `slug` is free, from Better Auth's check, asked once the person
// pauses: `checking` until the answer for that very slug comes.
const useSlugAvailability = (slug: string): SlugAvailability => {
  const settled = useDebounced(slug, checkDelayMs);

  const [checked, setChecked] = useState<{
    readonly answer: SlugAvailability;
    readonly slug: string;
  } | null>(null);

  useEffect(() => {
    let current = true;

    const check = async () => {
      const result = await authClient.organization.checkSlug({
        slug: settled,
      });

      if (!current) {
        return;
      }

      if (result.error === null) {
        setChecked({ answer: "free", slug: settled });
      } else {
        setChecked({
          answer: slugTaken(result.error.code) ? "taken" : "unknown",
          slug: settled,
        });
      }
    };

    // A slug the web app cannot route is refused without asking.
    if (isWorkspaceSlug(settled)) {
      void check();
    }

    return () => {
      current = false;
    };
  }, [settled]);

  return slugAvailabilityOf(slug, checked);
};

// Better Auth's answer to making a workspace of this name and address.
const createWorkspace = async (name: string, slug: string) =>
  await authClient.organization.create({ name, slug });

/**
 * Creates a workspace the user owns, then opens it: its name and its
 * address, both offered (`initialName`, the address from its words) and
 * both the person's to replace. The address follows the name until the
 * person writes one, and is checked as it changes: one another workspace
 * holds, while still the one offered, gets a few random letters at its
 * end, and so does one another workspace took between the check and
 * Create, which is then tried again once (`createRefusalOf`); one the
 * person wrote is said taken under the address. The workspace made
 * becomes the session's active one.
 */
export const CreateWorkspaceForm = ({
  initialName = "",
}: {
  readonly initialName?: string;
}) => {
  const t = useTranslations("AppPage");
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [written, setWritten] = useState<string | null>(null);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  // The offered address takes the spare letters once another workspace
  // took its words under Create, until the name changes.
  const [spareNeeded, setSpareNeeded] = useState(false);
  // The address Create was last refused as taken.
  const [refused, setRefused] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // The few random letters an offered address takes when its words are
  // another workspace's, or a word the web app keeps.
  const spare = useMemo(() => crypto.randomUUID().slice(0, 4), []);
  const offerUpgrade = useOfferAuthUpgrade();
  const words = suggestedSlugOf(name, null);
  const wordsAvailability = useSlugAvailability(words);

  const wordsUnusable =
    words !== "" &&
    (wordsAvailability === "taken" || wordsAvailability === "invalid");

  const slug = (
    written ??
    (wordsUnusable || spareNeeded ? suggestedSlugOf(name, spare) : words)
  ).trim();

  const checkedAvailability = useSlugAvailability(slug);
  const availability = refused === slug ? "taken" : checkedAvailability;
  const named = name.trim();
  // The address's start, as the browser has Peal open, once hydrated.
  const host = useMounted() ? globalThis.location.host : "";

  const handleName = (value: string) => {
    setName(value);
    setSpareNeeded(false);
  };

  // What to do once Create is refused for `tried`.
  const refusalOf = (code: string | undefined, tried: string) =>
    createRefusalOf({ code, name, spare, tried, written: written !== null });

  const handleSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    startTransition(async () => {
      let tried = slug;
      let result = await createWorkspace(named, tried);

      // The offered address another workspace took since it was checked:
      // once more, with the spare letters.
      if (result.error !== null) {
        const refusal = refusalOf(result.error.code, tried);

        if (refusal.kind === "retry") {
          setSpareNeeded(true);
          tried = refusal.slug;
          result = await createWorkspace(named, tried);
        }
      }

      if (result.error === null) {
        // Better Auth makes it active in the database, but the session's
        // cached cookie, which `/` reads, still names the last one for
        // five minutes: setting it again renews the cookie.
        chooseWorkspace(result.data.id);
        setError(null);
        router.push(setupChannelsPath(result.data.slug));
        router.refresh();
      } else if (refusalOf(result.error.code, tried).kind === "form") {
        setError(authErrorKey(result.error));
        offerUpgrade(result.error);
      } else {
        setError(null);
        setRefused(tried);
      }
    });
  };

  const handleAddress = (event: ChangeEvent<HTMLInputElement>) => {
    setWritten(event.target.value);
  };

  // Only what stops the workspace being made is said under the address.
  const problem =
    availability === "taken" || (availability === "invalid" && slug !== "")
      ? t(`address.${availability}`, { slug })
      : null;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
      data-create-workspace=""
    >
      <FormError error={error} />
      <FormField
        id="workspace-name"
        type="text"
        autoComplete="organization"
        label={t("workspaceName")}
        value={name}
        onChange={handleName}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="workspace-address">{t("address.label")}</Label>
        <InputGroup>
          <InputGroupAddon variant="segment">
            <InputGroupText>{`${host}/`}</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            id="workspace-address"
            name="workspace-address"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={slug}
            onChange={handleAddress}
            aria-invalid={problem === null ? undefined : true}
            aria-describedby={
              problem === null ? undefined : "workspace-address-problem"
            }
            required
          />
        </InputGroup>
        {problem === null ? null : (
          <p
            id="workspace-address-problem"
            className="text-destructive text-xs"
          >
            {problem}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={
          isPending ||
          named === "" ||
          !(availability === "free" || availability === "unknown")
        }
        focusableWhenDisabled
      >
        {isPending ? t("creating") : t("create")}
      </Button>
    </form>
  );
};
