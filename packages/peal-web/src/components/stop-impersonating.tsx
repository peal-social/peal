"use client";

import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import { toast } from "peal-ui/components/toast";
import { useState, useTransition } from "react";

import { authClient } from "#auth/client.ts";
import { tellOtherTabs } from "#auth/session-news.ts";
import { useLoadAnew } from "#auth/use-load-anew.ts";

// Ends the impersonation: Better Auth deletes its session and signs the
// staff member's own back in, then the console opens the account's page,
// loaded anew (`useLoadAnew`), so nothing the tab held while acting as
// the account stays; the other tabs are told the staff member is back.
export const StopImpersonating = ({
  staffId,
  userId,
}: {
  /** The staff member acting as the account, who is signed in again. */
  readonly staffId: string;
  /** The account acted as. */
  readonly userId: string;
}) => {
  const t = useTranslations("Impersonation");
  const loadAnew = useLoadAnew();
  const [isPending, startTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);
  const busy = isPending || leaving;

  const handleStop = () => {
    startTransition(async () => {
      const result = await authClient.admin.stopImpersonating();

      if (result.error === null) {
        tellOtherTabs({ kind: "signedIn", userId: staffId });
        setLeaving(true);
        loadAnew(`/admin/users/${userId}`);
      } else {
        toast.error(t("stopFailed"));
      }
    });
  };

  return (
    <Button
      size="sm"
      disabled={busy}
      focusableWhenDisabled
      onClick={handleStop}
    >
      {busy ? t("stopping") : t("stop")}
    </Button>
  );
};
