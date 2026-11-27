"use client";

import { useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/reactivity";
import { useTranslations } from "next-intl";
import type { Channel } from "peal-contract";

import { workspaceSites } from "#articles/api.ts";
import { channelTitle } from "#channels/channel-name.ts";
import { useHydrated } from "#components/media/use-hydrated.ts";

/**
 * What names a blog: its website's name while the website is connected,
 * none once it is not (a website disconnected since, whose articles stay).
 */
export const blogNameOf = (
  sites: readonly Channel[],
  channelId: string
): string | null => {
  const site = sites.find(({ id }) => id === channelId);

  return site === undefined ? null : channelTitle(site);
};

const LoadedBlogName = ({
  channelId,
  workspaceId,
}: {
  readonly channelId: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("WorkspaceShell.pages");
  const tPosts = useTranslations("Posts");
  const sites = useAtomValue(workspaceSites(workspaceId));

  if (!AsyncResult.isSuccess(sites)) {
    return t("blog");
  }

  return blogNameOf(sites.value, channelId) ?? tPosts("disconnectedChannel");
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
    <LoadedBlogName channelId={channelId} workspaceId={workspaceId} />
  ) : (
    t("blog")
  );
};
