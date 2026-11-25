import { forWorkspace } from "peal-contract";
import type { CalendarDay, ExportKind } from "peal-contract";

import { PealApi } from "#api/client.ts";

// The analytics queries. Counts change only when the server reads them,
// every hour at most, so nothing here polls.

export const analyticsKeys = ["analytics"];

/** The days a summary covers, as days run in `timeZone`. */
export interface SummaryRange {
  readonly from: CalendarDay;
  readonly timeZone: string;
  readonly to: CalendarDay;
}

/**
 * A post's counts on each of its channels, over time, read once for each
 * state of its channels (`revision`, `channelsRevisionOf`): a channel
 * going out, sent again or removed from its platform reads them again.
 */
export const postAnalytics = (
  workspaceId: string,
  postId: string,
  revision: string
) =>
  PealApi.query("analytics", "post", {
    headers: forWorkspace(workspaceId),
    params: { postId },
    reactivityKeys: [...analyticsKeys, `analytics:post:${postId}:${revision}`],
  });

/**
 * What a post may hold on every platform, which says where this server
 * reads each post's counts. It changes with the server's settings only.
 */
export const platformCapabilities = (workspaceId: string) =>
  PealApi.query("channels.capabilities", "platforms", {
    headers: forWorkspace(workspaceId),
  });

/**
 * The workspace's analytics over the range beside the range before it,
 * with the accounts' followers.
 */
export const analyticsDashboard = (workspaceId: string, range: SummaryRange) =>
  PealApi.query("analytics", "dashboard", {
    headers: forWorkspace(workspaceId),
    query: range,
    reactivityKeys: analyticsKeys,
  });

/**
 * The address of an export of the range, as CSV. It names no workspace:
 * the request does, in its `Peal-Workspace` header (`downloadExport`).
 */
export const exportUrl = (kind: ExportKind, range: SummaryRange): string =>
  `/api/v1/analytics/export?${new URLSearchParams({
    ...range,
    format: "csv",
    kind,
  }).toString()}`;

/** When one channel's posts did best over the last `days`, in the zone. */
export const bestTimes = (
  workspaceId: string,
  channelId: string,
  days: 30 | 90 | 180,
  timeZone: string
) =>
  PealApi.query("analytics", "bestTimes", {
    headers: forWorkspace(workspaceId),
    query: { channelId, days, timeZone },
    reactivityKeys: analyticsKeys,
  });

/** One channel's numbers day by day over the range. */
export const analyticsChannel = (
  workspaceId: string,
  channelId: string,
  range: SummaryRange
) =>
  PealApi.query("analytics", "channel", {
    headers: forWorkspace(workspaceId),
    params: { channelId },
    query: range,
    reactivityKeys: analyticsKeys,
  });
