"use client";

import { Option } from "effect";
import { useTranslations } from "next-intl";
import type { AgentApprovalMedia } from "peal-contract/agent";
import { Skeleton } from "peal-ui/components/skeleton";

import { MediaThumbnail } from "#components/media/media-thumbnail.tsx";
import { useAttachedMedia } from "#posts/attached-media.ts";

/**
 * A post's media on an approval card: each file itself, small, with its
 * alt text under it, in order, as the workspace's library holds them; a
 * file still loading shows its place.
 */
export const ApprovalMedia = ({
  media,
  workspaceId,
}: {
  readonly media: readonly AgentApprovalMedia[];
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Agent");
  const attached = useAttachedMedia(workspaceId, media);

  return (
    <ul aria-label={t("approval.media")} className="flex flex-wrap gap-2">
      {attached.map(({ altText, media: file, mediaId }) => (
        <li key={mediaId} className="flex w-20 flex-col gap-1">
          <div className="bg-muted relative size-20 overflow-hidden rounded-md">
            {Option.isSome(file) ? (
              <MediaThumbnail media={file.value} sizes="5rem" />
            ) : (
              <Skeleton className="size-full" />
            )}
          </div>
          <p dir="auto" className="text-muted-foreground line-clamp-3 text-xs">
            {altText === "" ? t("approval.noAltText") : altText}
          </p>
        </li>
      ))}
    </ul>
  );
};
