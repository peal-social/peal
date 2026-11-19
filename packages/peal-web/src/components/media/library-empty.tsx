"use client";

import { ImageIcon, UploadIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import {
  EmptyState,
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateHidden,
  EmptyStateIcon,
  EmptyStateTitle,
} from "peal-ui/components/empty-state";
import type { ReactNode } from "react";

// The count the strip sets in bold.
const strong = (chunks: ReactNode) => <strong>{chunks}</strong>;

/**
 * What the search and the kind hide of the library: how many files its
 * first page holds, and whether more follow, or `unknown` while that page
 * is not read.
 */
export type HiddenFiles =
  | { readonly count: number; readonly more: boolean }
  | "unknown";

/**
 * The library when it shows nothing (DESIGN.md, "Empty states"): the
 * Media page's icon in pixels, then no file yet, with Upload when the
 * member may upload, or none the search and the kind keep, with how many
 * they hide and Clear.
 */
export const LibraryEmptyView = ({
  hidden,
  onClear,
  onUpload,
}: {
  /** What the search hides, or null when the library holds nothing. */
  readonly hidden: HiddenFiles | null;
  readonly onClear: () => void;
  /** Opens the uploader's file picker, when the member may upload. */
  readonly onUpload?: (() => void) | undefined;
}) => {
  const t = useTranslations("Media.library");
  const lists = useTranslations("Lists");

  return (
    <EmptyState>
      <EmptyStateIcon icon={<ImageIcon />} />
      {hidden === null ? (
        <>
          <EmptyStateTitle>{t("emptyTitle")}</EmptyStateTitle>
          <EmptyStateDescription>{t("empty")}</EmptyStateDescription>
          {onUpload === undefined ? null : (
            <EmptyStateActions>
              <Button onClick={onUpload}>
                <UploadIcon aria-hidden />
                {t("upload")}
              </Button>
            </EmptyStateActions>
          )}
        </>
      ) : (
        <>
          <EmptyStateTitle>{t("noMatchTitle")}</EmptyStateTitle>
          <EmptyStateDescription>{t("noMatchHint")}</EmptyStateDescription>
          <EmptyStateHidden>
            <span>
              {hidden === "unknown"
                ? t("hiddenUnknown")
                : t.rich("hiddenByFilters", {
                    count: hidden.count,
                    more: String(hidden.more),
                    strong,
                  })}
            </span>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("clearSearch")}
              onClick={onClear}
            >
              {lists("clear")}
            </Button>
          </EmptyStateHidden>
        </>
      )}
    </EmptyState>
  );
};
