import { Option } from "effect";
import { getTranslations } from "next-intl/server";

import { captchaSiteKey } from "#auth/captcha.ts";
import { needsPassword } from "#auth/password-state.ts";
import { currentUserOrNone } from "#auth/session.ts";
import { SetPassword } from "#components/account/set-password.tsx";
import { TwoStepSection } from "#components/account/two-step-section.tsx";

/**
 * Two-step verification, turned on where something requires it (a
 * workspace, the staff console), as the account page turns it on: the
 * account's settings are a workspace's page, which a workspace that
 * requires it would not open. An account without a password sets one
 * first. Once on, the page renders again and opens.
 */
export const TwoStepTurnOnHere = async () => {
  const me = await currentUserOrNone();

  if (Option.isNone(me)) {
    return null;
  }

  const { user } = me.value;

  if (!needsPassword(user)) {
    return <TwoStepSection emailVerified={user.emailVerified} />;
  }

  const t = await getTranslations("AccountSettings");

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        {t("password.neededFirst")}
      </p>
      <SetPassword
        captchaSiteKey={Option.getOrNull(await captchaSiteKey())}
        email={user.email}
        lead={t("password.setDescription")}
      />
    </div>
  );
};
