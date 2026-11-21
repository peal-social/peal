"use client";

import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { ChannelPlatform } from "peal-contract";
import { useState } from "react";

import { platformCapabilities } from "#analytics/api.ts";
import { channelsOf, connectablePlatformsOf } from "#channels/channels-api.ts";
import {
  channelCategories,
  channelFeatures,
  defaultCounted,
} from "#channels/platform-features.ts";
import { countedOn } from "#components/analytics/post-metrics.tsx";
import {
  LoadFailed,
  Loading,
} from "#components/channels/channels-settings.tsx";
import {
  ConnectForm,
  connectablesOf,
} from "#components/channels/connect-forms.tsx";
import type { Connectable } from "#components/channels/connect-forms.tsx";
import { PlatformCatalogueView } from "#components/channels/platform-catalogue-view.tsx";
import type { CatalogueFilter } from "#components/channels/platform-catalogue-view.tsx";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { PageTitle } from "#components/shell/frame-view.tsx";
import { useWorkspaceHref } from "#components/shell/workspace-addresses.tsx";
import { AppLink } from "#components/shell/workspace-shell.tsx";
import { usePathname, useRouter } from "#i18n/navigation.ts";

interface Params {
  readonly get: (name: string) => string | null;
}

// The catalogue's type and features as the address says them; what it
// does not know is left out.
const catalogueOf = (params: Params) => {
  const features = new Set((params.get("feature") ?? "").split(","));

  return {
    category:
      channelCategories.find((category) => category === params.get("type")) ??
      null,
    features: channelFeatures.filter((feature) => features.has(feature)),
  };
};

const catalogueQueryOf = (filter: CatalogueFilter): string => {
  const query = new URLSearchParams();

  if (filter.category !== null) {
    query.set("type", filter.category);
  }

  if (filter.features.length > 0) {
    query.set("feature", filter.features.join(","));
  }

  return query.toString().replaceAll("%2C", ",");
};

// How many of the workspace's channels each platform holds; none while
// they load.
const useConnectedCounts = (
  workspaceId: string
): ReadonlyMap<ChannelPlatform, number> => {
  const channels = useAtomValue(channelsOf(workspaceId));
  const counts = new Map<ChannelPlatform, number>();

  if (AsyncResult.isSuccess(channels)) {
    for (const { platform } of channels.value) {
      counts.set(platform, (counts.get(platform) ?? 0) + 1);
    }
  }

  return counts;
};

const Catalogue = ({
  connectable,
  workspaceId,
}: {
  readonly connectable: Connectable;
  readonly workspaceId: string;
}) => {
  const workspaceHref = useWorkspaceHref();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const asked = catalogueOf(params);
  const [query, setQuery] = useState("");
  const capabilities = useAtomValue(platformCapabilities(workspaceId));
  const connected = useConnectedCounts(workspaceId);

  const counted = AsyncResult.isSuccess(capabilities)
    ? new Set<ChannelPlatform>(countedOn(capabilities.value))
    : defaultCounted;

  const onFilter = (next: CatalogueFilter) => {
    setQuery(next.query);

    const written = catalogueQueryOf(next);

    if (written !== catalogueQueryOf({ ...asked, query: "" })) {
      router.replace(written === "" ? pathname : `${pathname}?${written}`, {
        scroll: false,
      });
    }
  };

  return (
    <PlatformCatalogueView
      connected={connected}
      counted={counted}
      filter={{ ...asked, query }}
      platforms={connectablesOf(connectable)}
      hrefOf={(platform) =>
        workspaceHref(workspaceId, `/channels/new/${platform}`)
      }
      link={AppLink}
      onFilter={onFilter}
    />
  );
};

// One platform's form, the platform named in the header's breadcrumb
// (Channels › New channel › Mastodon), whose steps lead back.
const PlatformForm = ({
  connectable,
  docsUrl,
  platform,
  workspaceId,
}: {
  readonly connectable: Connectable;
  readonly docsUrl: string | null;
  readonly platform: ChannelPlatform;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ChannelsPage");
  const offered = connectablesOf(connectable).includes(platform);

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageTitle>{t("platform", { platform })}</PageTitle>
      {offered ? (
        <ConnectForm
          connectable={connectable}
          docsUrl={docsUrl}
          platform={platform}
          workspaceId={workspaceId}
        />
      ) : (
        <p className="text-muted-foreground text-sm">
          {t("catalogue.unknown")}
        </p>
      )}
    </div>
  );
};

// What the server connects, read by the browser with the member's session:
// the catalogue, or one platform's form.
const LoadedNewChannel = ({
  docsUrl,
  platform,
  workspaceId,
}: {
  readonly docsUrl: string | null;
  readonly platform: ChannelPlatform | null;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("PlatformConnect");
  const platforms = useAtomValue(connectablePlatformsOf(workspaceId));
  const handleRetry = useAtomRefresh(connectablePlatformsOf(workspaceId));

  if (AsyncResult.isFailure(platforms)) {
    return <LoadFailed message={t("loadFailed")} onRetry={handleRetry} />;
  }

  if (!AsyncResult.isSuccess(platforms)) {
    return <Loading />;
  }

  return platform === null ? (
    <Catalogue connectable={platforms.value} workspaceId={workspaceId} />
  ) : (
    <PlatformForm
      connectable={platforms.value}
      docsUrl={docsUrl}
      platform={platform}
      workspaceId={workspaceId}
    />
  );
};

/**
 * New channel: the platforms this server connects, to pick one; with a
 * `platform`, its form (`…/channels/new/<platform>`), where the member
 * signs in on the platform or gives what it asks. A member who may not
 * connect is told who can.
 */
export const NewChannel = ({
  canConnect,
  docsUrl,
  platform = null,
  workspaceId,
}: {
  readonly canConnect: boolean;
  readonly docsUrl: string | null;
  readonly platform?: ChannelPlatform | null;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("ChannelsPage");
  const hydrated = useHydrated();

  if (!canConnect) {
    return <p className="text-muted-foreground text-sm">{t("noPermission")}</p>;
  }

  return hydrated ? (
    <LoadedNewChannel
      docsUrl={docsUrl}
      platform={platform}
      workspaceId={workspaceId}
    />
  ) : (
    <Loading />
  );
};
