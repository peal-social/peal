import { useTranslations } from "next-intl";
import { Suspense } from "react";
import type { ReactNode } from "react";

import { AccountMenu } from "#components/account-menu.tsx";
import { ImpersonationBanner } from "#components/impersonation-banner.tsx";
import { LanguageSwitcher } from "#components/language-switcher.tsx";
import { ShellFrame } from "#components/shell-frame.tsx";
import { PealMark } from "#components/shell/peal-mark.tsx";
import { Link } from "#i18n/navigation.ts";

// The app's header: the product name, the language switcher and the
// account menu.
export const AppHeader = () => {
  const t = useTranslations("AppShell");

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <PealMark className="size-6" />
          {t("productName")}
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <Suspense fallback={null}>
            <AccountMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
};

/**
 * The app's frame, for a workspace's page shown without the workspace's
 * own (to someone not a member, or who must first turn on two-step
 * verification): `ShellFrame` leaves workspace pages to their layout.
 */
export const PlainFrame = ({ children }: { readonly children: ReactNode }) => (
  <>
    <AppHeader />
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      {children}
    </main>
  </>
);

// The frame around every page: the impersonation banner while staff act as
// someone, a header with the product name, the language switcher and the
// account menu, then the page itself. The sign-in pages have no header. A
// connect link's pages, whose visitors have no Peal account, get a plain
// footer in its place (ShellFrame).
export const AppShell = ({ children }: { readonly children: ReactNode }) => {
  const t = useTranslations("AppShell");

  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={null}>
        <ImpersonationBanner />
      </Suspense>
      <ShellFrame
        header={<AppHeader />}
        hosted={
          <footer className="border-t">
            <div className="text-muted-foreground mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 text-sm">
              <span>{t("hostedBy", { product: t("productName") })}</span>
              <LanguageSwitcher />
            </div>
          </footer>
        }
      >
        {children}
      </ShellFrame>
    </div>
  );
};
