"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "peal-ui/components/dialog";

import { CommentForm } from "./comment-form.tsx";

/**
 * Asks why changes are wanted, for `count` posts of the list that wait,
 * before they go back to draft: the comment their authors are told.
 * `onSubmit` sends it, and says whether it was taken.
 */
export const RequestChangesDialog = ({
  count,
  onOpenChange,
  onSubmit,
  open,
}: {
  readonly count: number;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSubmit: (comment: string) => Promise<boolean>;
  readonly open: boolean;
}) => {
  const t = useTranslations("Posts.Selection");
  const review = useTranslations("Review");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={review("close")}>
        <DialogHeader>
          <DialogTitle>{t("changesTitle", { count })}</DialogTitle>
          <DialogDescription>
            {t("changesDescription", { count })}
          </DialogDescription>
        </DialogHeader>
        <CommentForm
          label={review("decide.changesLabel")}
          submitLabel={review("decide.sendBack")}
          submittingLabel={review("form.sending")}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
};
