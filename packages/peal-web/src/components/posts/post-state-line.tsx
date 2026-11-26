"use client";

import { useTranslations } from "next-intl";
import type { Post, PostStatus } from "peal-contract";
import { Badge } from "peal-ui/components/badge";

import { PostOrigins } from "#components/posts/post-origins.tsx";
import { PostQueueLine } from "#components/posts/queue-choice.tsx";

/**
 * Where a saved post stands, above its text: its status, how it ended,
 * the queue that placed it and where it came from. A new post has none.
 */
export const PostStateLine = ({
  post,
  status,
  viewerId,
  workspaceId,
}: {
  readonly post: Post | undefined;
  readonly status: PostStatus;
  readonly viewerId: string;
  readonly workspaceId: string;
}) => {
  const t = useTranslations("Posts");

  if (post === undefined) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{t("status", { status })}</Badge>
        {post.outcome === null ? null : (
          <Badge variant="secondary">
            {t("outcome", { outcome: post.outcome })}
          </Badge>
        )}
      </div>
      <PostQueueLine queueId={post.queueId} workspaceId={workspaceId} />
      <PostOrigins post={post} viewerId={viewerId} />
    </div>
  );
};
