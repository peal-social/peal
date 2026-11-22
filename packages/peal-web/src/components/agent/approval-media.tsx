"use client";

import { Option } from "effect";
import { useTranslations } from "next-intl";
import type { Media } from "peal-contract";
import type { AgentApprovalMedia } from "peal-contract/agent";
import { Skeleton } from "peal-ui/components/skeleton";
import { useRef, useState } from "react";

import {
  MediaPreviewDialog,
  useMediaName,
} from "#components/media/media-preview.tsx";
import { MediaThumbnail } from "#components/media/media-thumbnail.tsx";
import { useAttachedMedia } from "#posts/attached-media.ts";

// The thumbnail, a button that opens the file whole in the library's
// preview dialog (an image at the size the window allows, a video to
// play with its controls), and gives the focus back to it once closed.
const Opener = ({ media }: { readonly media: Media }) => {
  const t = useTranslations("Media.library");
  const nameOf = useMediaName();
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={opener}
        type="button"
        aria-label={t("preview", { name: nameOf(media) })}
        aria-haspopup="dialog"
        className="focus-visible:ring-ring relative block size-full cursor-zoom-in outline-none focus-visible:ring-3 focus-visible:ring-inset"
        onClick={() => {
          setOpen(true);
        }}
      >
        <MediaThumbnail media={media} sizes="5rem" />
      </button>
      <MediaPreviewDialog
        media={media}
        open={open}
        returnFocusTo={() => opener.current}
        onOpenChange={setOpen}
      />
    </>
  );
};

/**
 * A post's media on an approval card, in order, as the workspace's
 * library holds them: each file small, which opens it whole, and beside
 * it the alt text the post sends with it, whole; a file still loading
 * shows its place.
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
    <ul aria-label={t("approval.media")} className="flex flex-col gap-2">
      {attached.map(({ altText, media: file, mediaId }) => (
        <li key={mediaId} className="flex items-start gap-3">
          <div className="bg-muted relative size-20 shrink-0 overflow-hidden rounded-md">
            {Option.isSome(file) ? (
              <Opener media={file.value} />
            ) : (
              <Skeleton className="size-full" />
            )}
          </div>
          <p
            dir="auto"
            className={
              altText === ""
                ? "text-muted-foreground min-w-0 text-xs italic"
                : "text-muted-foreground min-w-0 text-xs break-words whitespace-pre-line"
            }
          >
            {altText === "" ? t("approval.noAltText") : altText}
          </p>
        </li>
      ))}
    </ul>
  );
};
