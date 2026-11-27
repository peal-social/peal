"use client";

import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";

import { workspaceSites } from "#articles/api.ts";
import { channelTitle } from "#channels/channel-name.ts";
import { useHydrated } from "#components/media/use-hydrated.ts";

const LoadedBlogName = ({
  channelId,
  fallback,
  workspaceId,
}: {
  readonly channelId: string;
  readonly fallback: string;
  readonly workspaceId: string;
}) => {
  const sites = useAtomValue(workspaceSites(workspaceId));

  const site = AsyncResult.isSuccess(sites)
    ? sites.value.find(({ id }) => id === channelId)
    : undefined;

  return site === undefined ? fallback : channelTitle(site);
};

/**
 * A blog's step in the breadcrumb: its website's name, read with the
 * visitor's cookies once the page has hydrated, and "Blog" until then.
 */
export const BlogName = ({
  channelId,
  workspaceId,
}: {
  readonly channelId: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("WorkspaceShell.pages");
  const hydrated = useHydrated();

  return hydrated ? (
    <LoadedBlogName
      channelId={channelId}
      fallback={t("blog")}
      workspaceId={workspaceId}
    />
  ) : (
    t("blog")
  );
};
