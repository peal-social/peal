"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import { Skeleton } from "peal-ui/components/skeleton";

import { platformCapabilities } from "#analytics/api.ts";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { PlatformsView } from "#components/platforms/platforms-view.tsx";
import { platformRowsOf } from "#platforms/rows.ts";
import { workspaceChannels } from "#posts/api.ts";

const Loading = () => {
  const t = useTranslations("Platforms");

  return (
    <div aria-busy="true">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-96 w-full" />
    </div>
  );
};

const LoadedPlatforms = ({ workspaceId }: { readonly workspaceId: string }) => {
  const t = useTranslations("Platforms");
  const capabilitiesQuery = platformCapabilities(workspaceId);
  const channelsQuery = workspaceChannels(workspaceId);
  const capabilities = useAtomValue(capabilitiesQuery);
  const channels = useAtomValue(channelsQuery);
  const retryCapabilities = useAtomRefresh(capabilitiesQuery);
  const retryChannels = useAtomRefresh(channelsQuery);

  if (AsyncResult.isFailure(capabilities) || AsyncResult.isFailure(channels)) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{t("loadFailed")}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            retryCapabilities();
            retryChannels();
          }}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (
    !AsyncResult.isSuccess(capabilities) ||
    !AsyncResult.isSuccess(channels)
  ) {
    return <Loading />;
  }

  return (
    <PlatformsView rows={platformRowsOf(capabilities.value, channels.value)} />
  );
};

/**
 * PealAPI's Platforms page: what this server says a post may hold on
 * each platform, beside the workspace's channels there. Both are read
 * with the visitor's cookies, which only the browser sends, so they load
 * once the page has hydrated: the server renders the loading state, as
 * the browser's first render does.
 */
export const PlatformsScreen = ({
  workspaceId,
}: {
  readonly workspaceId: string;
}) => {
  const hydrated = useHydrated();

  return (
    <div className="flex flex-col gap-6">
      {hydrated ? <LoadedPlatforms workspaceId={workspaceId} /> : <Loading />}
    </div>
  );
};
