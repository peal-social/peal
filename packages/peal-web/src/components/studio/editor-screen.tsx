"use client";

import { useAtomValue } from "@effect/atom-react";
import { Option } from "effect";
import { AsyncResult } from "effect/reactivity";
import { ClapperboardIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertTitle } from "peal-ui/components/alert";
import { Button, buttonVariants } from "peal-ui/components/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "peal-ui/components/empty-state";
import { Skeleton } from "peal-ui/components/skeleton";

import { assistantStatus } from "#assistant/api.ts";
import { slideshowsNeedPayment } from "#billing/upgrade.ts";
import { useUpgradePrompt } from "#components/billing/upgrade-prompt.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link } from "#i18n/navigation.ts";

import { StudioEditor } from "./studio-editor.tsx";

interface EditorProps {
  /** The member may change the assistant's settings (assistant:configure). */
  readonly mayConfigure: boolean;
  readonly workspaceId: string;
}

// Without a payment method on a server that bills, the editor says so and
// opens the upgrade dialog.
const NeedsPayment = ({ workspaceId }: { readonly workspaceId: string }) => {
  const t = useTranslations("Studio.needsPayment");
  const prompt = useUpgradePrompt();

  return (
    <EmptyState>
      <EmptyStateIcon icon={<ClapperboardIcon />} />
      <EmptyStateTitle>{t("title")}</EmptyStateTitle>
      <EmptyStateDescription>{t("description")}</EmptyStateDescription>
      <EmptyStateActions>
        <Button
          onClick={() => {
            prompt(slideshowsNeedPayment, workspaceId);
          }}
        >
          {t("action")}
        </Button>
      </EmptyStateActions>
    </EmptyState>
  );
};

// Before the workspace chose a service to render with.
const NotConnected = ({ mayConfigure, workspaceId }: EditorProps) => {
  const t = useTranslations("Studio.notConnected");
  const workspaceHref = useWorkspaceHref();

  return (
    <EmptyState>
      <EmptyStateIcon icon={<ClapperboardIcon />} />
      <EmptyStateTitle>{t("title")}</EmptyStateTitle>
      <EmptyStateDescription>
        {mayConfigure ? t("description") : t("askAnOwner")}
      </EmptyStateDescription>
      {mayConfigure ? (
        <EmptyStateActions>
          <Link
            href={workspaceHref(workspaceId, "/settings/assistant")}
            className={buttonVariants()}
          >
            {t("action")}
          </Link>
        </EmptyStateActions>
      ) : null}
    </EmptyState>
  );
};

// The editor's state for the workspace's status: loading, not connected,
// waiting for a payment method, or the editor itself.
const LoadedEditor = (props: EditorProps) => {
  const t = useTranslations("Studio");
  const result = useAtomValue(assistantStatus(props.workspaceId));
  const status = AsyncResult.value(result);

  if (Option.isNone(status)) {
    return AsyncResult.isFailure(result) ? (
      <Alert variant="destructive">
        <AlertTitle>{t("loadFailed")}</AlertTitle>
      </Alert>
    ) : (
      <Skeleton className="h-[70dvh] w-full" />
    );
  }

  const { slideshows } = status.value;

  if (!slideshows.available) {
    return <NotConnected {...props} />;
  }

  return slideshows.paymentMethodRequired ? (
    <NeedsPayment workspaceId={props.workspaceId} />
  ) : (
    <StudioEditor {...props} status={status.value} />
  );
};

/**
 * The Studio's editor (DESIGN.md, "The editor"): a video of the library's
 * files and texts on tracks, edited on Shotstack's Studio SDK as its
 * engine under Peal's own controls, and rendered by the workspace's own
 * Shotstack account into the media library. Render it for members with
 * assistant:use and media:upload. The status it starts from needs the
 * visitor's cookies, so it is read once the page has hydrated.
 */
export const EditorScreen = (props: EditorProps) =>
  useHydrated() ? (
    <LoadedEditor {...props} />
  ) : (
    <Skeleton className="h-[70dvh] w-full" />
  );
