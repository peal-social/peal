import { Option } from "effect";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "peal-ui/components/button";

import { currentUserOrNone } from "#auth/session.ts";
import { AccountMenuView } from "#components/account-menu-view.tsx";
import { Link } from "#i18n/navigation.ts";

// The frame's account corner: the signed-in user, read from GET /api/me
// while the page renders, with their unread notifications, or a way to sign
// in, also when that read fails. Their pages open in the settings of the
// workspace open (`workspaceSlug`), or, outside any, of their first.
export const AccountMenu = async ({
  workspaceSlug,
}: {
  readonly workspaceSlug?: string;
}) => {
  const me = await currentUserOrNone();
  const t = await getTranslations("UserMenu");

  return Option.match(me, {
    onNone: () => (
      <Link
        href="/sign-in"
        className={buttonVariants({ size: "sm", variant: "ghost" })}
      >
        {t("signIn")}
      </Link>
    ),
    onSome: ({ user, workspaces }) => (
      <AccountMenuView
        name={user.name}
        email={user.email}
        image={user.image}
        workspaceSlug={workspaceSlug ?? workspaces[0]?.slug ?? null}
      />
    ),
  });
};
