import { Match } from "effect";
import { useTranslations } from "next-intl";
import type { LivePostRefusal } from "peal-contract";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "peal-ui/components/alert-dialog";
import { Button } from "peal-ui/components/button";
import { useState } from "react";

import type { LiveState } from "#posts/live-post.ts";

/** A refusal of the server, by reason, or another failure. */
export type UnpublishFailure = LivePostRefusal | "forbidden" | "other";

interface LivePostViewProps {
  /** Whether a request for the channel runs. */
  readonly busy: boolean;
  /**
   * How long after it was sent the platform deletes a post, in hours,
   * where it limits that (Telegram's 48): said beside the action.
   */
  readonly deletesWithinHours?: number | undefined;
  /** The channel, named. */
  readonly channelName: string;
  readonly onUnpublish: () => void;
  /** The channel's platform, named. */
  readonly platform: string;
  readonly state: LiveState;
}

// Asks before anything leaves: the post goes for everyone, for good.
const UnpublishDialog = ({
  busy,
  channelName,
  label,
  onUnpublish,
  platform,
}: Omit<LivePostViewProps, "deletesWithinHours" | "state"> & {
  readonly label: string;
}) => {
  const t = useTranslations("Posts.Live");
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={<Button variant="destructive" size="sm" />}
        disabled={busy}
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmTitle", { platform })}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("confirmDescription", { channel: channelName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              setOpen(false);
              onUnpublish();
            }}
          >
            {t("unpublish")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

// How long the platform deletes a post after it was sent.
const DeletionWindow = ({
  hours,
  platform,
}: {
  readonly hours: number;
  readonly platform: string;
}) => {
  const t = useTranslations("Posts.Live");

  return (
    <p className="text-muted-foreground text-xs">
      {t("deletesWithin", { hours, platform })}
    </p>
  );
};

/**
 * What a member who may remove a live post sees of it on one channel: the
 * action, with its confirmation, a removal under way, one that failed with
 * a way to ask again, or why the platform does not let Peal. Nothing once
 * it was removed (the channel's card says when), nor while an edit runs.
 */
const LiveAction = (props: LivePostViewProps) => {
  const t = useTranslations("Posts.Live");
  const { busy, platform, state } = props;

  return Match.valueTags(state, {
    blocked: ({ by }) => (
      <p className="text-muted-foreground text-sm">
        {t("blocked", { by: by ?? "other", platform })}
      </p>
    ),
    // An edit is under way: the edit's own view says so.
    editing: () => null,
    failed: ({ code }) =>
      // Only the webhook that sent the post may delete it: asking again
      // would meet the same refusal.
      code === "webhookChanged" ? (
        <p className="text-destructive text-sm">
          {t("webhookChanged", { platform })}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-destructive text-sm">
            {t("failed", { code: code ?? "unknown" })}
          </p>
          <UnpublishDialog {...props} label={t("retry")} />
        </div>
      ),
    none: () => null,
    offered: () => (
      <UnpublishDialog
        {...props}
        label={busy ? t("removing") : t("unpublish")}
      />
    ),
    removed: () => null,
    removing: () => (
      <output className="text-muted-foreground text-sm">{t("removing")}</output>
    ),
  });
};

export const LivePostView = (props: LivePostViewProps) => {
  const { deletesWithinHours, platform, state } = props;

  // Where the platform deletes only for a while, said beside the action.
  return deletesWithinHours !== undefined &&
    (state._tag === "offered" || state._tag === "failed") ? (
    <div className="flex flex-col gap-1">
      <LiveAction {...props} />
      <DeletionWindow hours={deletesWithinHours} platform={platform} />
    </div>
  ) : (
    <LiveAction {...props} />
  );
};

/** Why a request to remove the post did not go, in words. */
export const useUnpublishFailureText = () => {
  const t = useTranslations("Posts.Live");

  return (failure: UnpublishFailure) => t("refused", { reason: failure });
};
