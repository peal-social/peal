"use client";

import { Option } from "effect";
import { BellIcon, LifeBuoyIcon, LogOutIcon, UserIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "peal-ui/components/avatar";
import { Button } from "peal-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "peal-ui/components/dropdown-menu";
import { toast } from "peal-ui/components/toast";
import {
  listenToSupportUnread,
  openSupportChat,
} from "peal-ui/lib/support/events";
import { useEffect, useState, useTransition } from "react";

import { authClient } from "#auth/client.ts";
import { useSignOut } from "#auth/use-sign-out.ts";
import { useHydrated } from "#components/media/use-hydrated.ts";
import { useUnreadNotices } from "#components/notices/use-unread-notices.ts";
import { useRouter } from "#i18n/navigation.ts";
import { hrefOf } from "#shell/navigation.ts";

interface AccountMenuViewProps {
  readonly email: string;
  readonly image?: string | null;
  readonly name: string;
  /**
   * Whether the server names a support chat (DESIGN.md, "Support chat"):
   * the menu then has Support, which opens it, with the count of replies
   * waiting, which the avatar's dot shows too.
   */
  readonly supportChat?: boolean;
  /**
   * The workspace whose settings hold the person's pages (the one open, or
   * their first): none for someone without any, who has only Sign out.
   */
  readonly workspaceSlug: string | null;
}

// The account's round avatar: its picture, or its first letter; a blue dot
// at its corner while notices wait unread.
const AccountAvatar = ({
  image,
  name,
  unread,
}: {
  readonly image: string | null;
  readonly name: string;
  readonly unread: boolean;
}) => (
  <span className="relative flex">
    <Avatar size="sm">
      {image === null ? null : <AvatarImage src={image} alt="" />}
      <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
    </Avatar>
    {unread ? (
      <span className="bg-brand ring-background absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2" />
    ) : null}
  </span>
);

// The menu itself, with the unread count once it is known.
const Menu = ({
  announcement,
  email,
  image,
  name,
  supportChat = false,
  unread,
  workspaceSlug,
}: AccountMenuViewProps & {
  readonly announcement: string;
  readonly unread: Option.Option<number>;
}) => {
  const t = useTranslations("UserMenu");
  const account = useTranslations("AccountSettings");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { leaving, signOut } = useSignOut();
  const count = Option.getOrElse(unread, () => 0);
  const [supportUnread, setSupportUnread] = useState(0);

  useEffect(() => listenToSupportUnread(setSupportUnread), []);

  // Asks Better Auth for the session as pages open and the tab regains
  // focus. That is what extends the session, and renews the copy cached in
  // a cookie: GET /api/me, which pages read, leaves both as they are.
  authClient.useSession();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut({
        refused: () => {
          toast.error(t("signOutFailed"));
        },
        to: "/",
      });
    });
  };

  const go = (href: string) => () => {
    router.push(href);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={isPending || leaving}
              focusableWhenDisabled
            />
          }
          aria-label={t("trigger", { count, name })}
        >
          <AccountAvatar
            image={image ?? null}
            name={name}
            unread={count > 0 || supportUnread > 0}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{t("signedInAs", { email })}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          {workspaceSlug === null ? null : (
            <>
              <DropdownMenuItem
                onSelect={go(hrefOf(workspaceSlug, "notifications"))}
              >
                <BellIcon aria-hidden />
                <span className="flex-1">{t("notifications")}</span>
                {count > 0 ? (
                  <span className="text-brand-text text-xs font-medium tabular-nums">
                    {count}
                  </span>
                ) : null}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={go(hrefOf(workspaceSlug, "account"))}>
                <UserIcon aria-hidden />
                {account("menu")}
              </DropdownMenuItem>
              {supportChat ? (
                <DropdownMenuItem onSelect={openSupportChat}>
                  <LifeBuoyIcon aria-hidden />
                  <span className="flex-1">{t("support")}</span>
                  {supportUnread > 0 ? (
                    <span className="text-brand-text text-xs font-medium tabular-nums">
                      {supportUnread}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={handleSignOut}>
            <LogOutIcon aria-hidden />
            {t("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <output className="sr-only">{announcement}</output>
    </>
  );
};

// Once hydrated, the menu polls the unread count with the visitor's
// cookies.
const LiveMenu = (props: AccountMenuViewProps) => {
  const { announcement, unread } = useUnreadNotices();

  return <Menu {...props} announcement={announcement} unread={unread} />;
};

/**
 * The signed-in person's corner, at the bottom left of the frame (DESIGN.md,
 * "The frame"): their avatar alone, with a dot while notices wait
 * unread, opening their notifications (with the count) and their account
 * (its language among its settings), both in a workspace's settings, and
 * signing out, after which the browser loads the app anew without the
 * session (`useSignOut`).
 */
export const AccountMenuView = (props: AccountMenuViewProps) => {
  const hydrated = useHydrated();

  return hydrated ? (
    <LiveMenu {...props} />
  ) : (
    <Menu {...props} announcement="" unread={Option.none()} />
  );
};
