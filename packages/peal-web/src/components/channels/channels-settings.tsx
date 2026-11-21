"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { ChannelPlatform } from "peal-contract";
import { Alert, AlertDescription } from "peal-ui/components/alert";
import { Button, buttonVariants } from "peal-ui/components/button";
import { Skeleton } from "peal-ui/components/skeleton";

import { platformCapabilities } from "#analytics/api.ts";
import { channelFilterOf, channelQueryOf } from "#channels/channel-filter.ts";
import type { ChannelFilter } from "#channels/channel-filter.ts";
import { channelsOf } from "#channels/channels-api.ts";
import { defaultCounted } from "#channels/platform-features.ts";
import { countedOn } from "#components/analytics/post-metrics.tsx";
import { ChannelListView } from "#components/channels/channel-list-view.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { PageActions } from "#components/shell/frame-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { Link, usePathname, useRouter } from "#i18n/navigation.ts";

export const LoadFailed = ({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}) => {
  const t = useTranslations("ChannelsPage");

  return (
    <div className="flex flex-col items-start gap-4">
      <Alert variant="destructive">
        <AlertDescription>{message}</AlertDescription>
      </Alert>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
};

export const Loading = () => (
  <div className="flex flex-col gap-3" aria-busy>
    <Skeleton className="h-8 w-64" />
    <Skeleton className="h-40 w-full" />
  </div>
);

// The platforms this server reads counts on, from its capabilities; every
// platform Peal has a reader for until they are known, or when they cannot
// be read.
const useCounted = (workspaceId: string): ReadonlySet<ChannelPlatform> => {
  const capabilities = useAtomValue(platformCapabilities(workspaceId));

  return AsyncResult.isSuccess(capabilities)
    ? new Set<ChannelPlatform>(countedOn(capabilities.value))
    : defaultCounted;
};

interface LoadedChannelsProps {
  readonly canConnect: boolean;
  readonly canDisconnect: boolean;
  readonly docsHref: string | null;
  readonly workspaceId: string;
}

// The list, fetched by the browser: the server has no session to fetch it
// with, so it never renders this. What it shows lives in the address
// (DESIGN.md, "Filters and display").
const LoadedChannels = ({
  canConnect,
  canDisconnect,
  docsHref,
  workspaceId,
}: LoadedChannelsProps) => {
  const t = useTranslations("ChannelsPage");
  const workspaceHref = useWorkspaceHref();
  const router = useRouter();
  const pathname = usePathname();
  const filter = channelFilterOf(useSearchParams());
  const channels = useAtomValue(channelsOf(workspaceId));
  const handleRetry = useAtomRefresh(channelsOf(workspaceId));
  const counted = useCounted(workspaceId);

  const onFilter = (next: ChannelFilter) => {
    const query = channelQueryOf(next);

    router.replace(query === "" ? pathname : `${pathname}?${query}`, {
      scroll: false,
    });
  };

  if (AsyncResult.isSuccess(channels)) {
    return (
      <ChannelListView
        canConnect={canConnect}
        canDisconnect={canDisconnect}
        channels={channels.value}
        counted={counted}
        docsHref={docsHref}
        filter={filter}
        newChannel={
          <Link
            href={workspaceHref(workspaceId, "/channels/new")}
            className={buttonVariants()}
          >
            {t("list.createChannel")}
          </Link>
        }
        workspaceId={workspaceId}
        onFilter={onFilter}
      />
    );
  }

  return AsyncResult.isFailure(channels) ? (
    <LoadFailed message={t("loadFailed")} onRetry={handleRetry} />
  ) : (
    <Loading />
  );
};

interface ChannelsSettingsProps {
  readonly canConnect: boolean;
  readonly canDisconnect: boolean;
  /** The docs' guide to channels, in the reader's language, when published. */
  readonly docsHref?: string | null;
  readonly workspaceId: string;
}

/**
 * The workspace's channels, loaded by the browser with the member's
 * session: one list with its views, its Filter and its Display, and, in
 * the header, New channel for a member who may connect, which opens the
 * platforms.
 */
export const ChannelsSettings = ({
  canConnect,
  canDisconnect,
  docsHref = null,
  workspaceId,
}: ChannelsSettingsProps) => {
  const t = useTranslations("ChannelsPage");
  const workspaceHref = useWorkspaceHref();
  const hydrated = useHydrated();

  return (
    <>
      {canConnect ? (
        <PageActions>
          <Link
            href={workspaceHref(workspaceId, "/channels/new")}
            className={buttonVariants({ size: "sm", variant: "ghost" })}
          >
            <PlusIcon aria-hidden />
            {t("list.newChannel")}
          </Link>
        </PageActions>
      ) : null}
      {hydrated ? (
        <LoadedChannels
          workspaceId={workspaceId}
          canConnect={canConnect}
          canDisconnect={canDisconnect}
          docsHref={docsHref}
        />
      ) : (
        <Loading />
      )}
    </>
  );
};
