"use client";

import { useAtomSet } from "@effect/atom-react";
import { Option } from "effect";
import { constVoid } from "effect/Function";
import { useTranslations } from "next-intl";
import { forWorkspace } from "peal-contract";
import type { OAuthSitePlatform, SiteSignInCallback } from "peal-contract";
import { Alert, AlertDescription, AlertTitle } from "peal-ui/components/alert";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useChannelErrorText } from "#channels/channel-error-text.ts";
import { completeSiteSignIn, failureOf } from "#channels/channels-api.ts";
import type { ChannelErrorKey } from "#channels/channels-api.ts";
import {
  forgetConnection,
  pendingWorkspace,
} from "#channels/pending-connection.ts";
import { useOfferUpgrade } from "#components/billing/use-offer-upgrade.ts";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link, useRouter } from "#i18n/navigation.ts";

const ignoreChanges = () => constVoid;

// The server cannot read the tab's storage: it renders the waiting state.
const notYetKnown = "";

const unknownOnServer = () => notYetKnown;

interface CompleteSiteSignInProps {
  readonly callback: SiteSignInCallback | null;
  readonly platform: OAuthSitePlatform;
}

/**
 * Hands what the website's platform sent back to the server, for the
 * workspace this tab started the sign-in in, then returns to its
 * channels; a failure says why.
 */
export const CompleteSiteSignIn = ({
  callback,
  platform,
}: CompleteSiteSignInProps) => {
  const workspaceHref = useWorkspaceHref();
  const t = useTranslations("ConnectCallbackPage");
  const errors = useChannelErrorText();
  const router = useRouter();
  const complete = useAtomSet(completeSiteSignIn, { mode: "promiseExit" });
  const offerUpgrade = useOfferUpgrade();
  const started = useRef(false);

  const [failure, setFailure] = useState<{
    readonly error: ChannelErrorKey;
    readonly workspaceId: string | null;
  } | null>(null);

  const workspaceId = useSyncExternalStore(
    ignoreChanges,
    () => pendingWorkspace(platform),
    unknownOnServer
  );

  useEffect(() => {
    if (
      started.current ||
      workspaceId === notYetKnown ||
      workspaceId === null ||
      callback === null
    ) {
      return;
    }

    started.current = true;

    const finish = async (workspace: string, payload: SiteSignInCallback) => {
      const exit = await complete({
        headers: forWorkspace(workspace),
        params: { platform },
        payload,
      });

      forgetConnection();

      if (exit._tag === "Success") {
        toast.success(t("connected", { handle: exit.value.handle }));
        router.replace(workspaceHref(workspace, "/channels"));

        return;
      }

      setFailure({
        error: Option.getOrElse(failureOf(exit), () => "unknown" as const),
        workspaceId: workspace,
      });
      offerUpgrade(exit, workspace);
    };

    void finish(workspaceId, callback);
  }, [
    callback,
    complete,
    offerUpgrade,
    platform,
    router,
    t,
    workspaceHref,
    workspaceId,
  ]);

  const failed = (message: string, workspace: string | null) => (
    <div className="flex flex-col gap-4">
      <Alert variant="destructive">
        <AlertTitle>{t("failedTitle")}</AlertTitle>
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button
        variant="outline"
        render={
          <Link
            href={
              workspace === null ? "/" : workspaceHref(workspace, "/channels")
            }
          />
        }
      >
        {workspace === null ? t("toWorkspaces") : t("toChannels")}
      </Button>
    </div>
  );

  if (failure !== null) {
    return failed(errors(failure.error), failure.workspaceId);
  }

  if (workspaceId === null) {
    return failed(t("lost"), null);
  }

  if (workspaceId !== notYetKnown && callback === null) {
    return failed(errors("invalidState"), workspaceId);
  }

  return (
    <p className="text-muted-foreground text-sm" aria-live="polite">
      {t("connecting")}
    </p>
  );
};
