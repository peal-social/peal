import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "peal-ui/components/button";
import { Suspense } from "react";
import type { ReactNode } from "react";

import { ContractLinks } from "#components/contract/contract-links.tsx";
import { SignOutButton } from "#components/setup/sign-out-button.tsx";
import { Link } from "#i18n/navigation.ts";

/**
 * The setup page's frame (DESIGN.md, "The frame", `setup`): no sidebar
 * and no bottom bar, the window's background alone. At its top, the way
 * back to the person's workspace when they have one (`back`), and who is
 * signed in with a way to sign out; the contract functions at its foot.
 */
export const SetupFrame = async ({
  back,
  children,
  email,
}: {
  /** The address of the workspace the person came from, if any. */
  readonly back: string | null;
  readonly children: ReactNode;
  readonly email: string;
}) => {
  const t = await getTranslations("AppPage");
  const menu = await getTranslations("UserMenu");

  return (
    <div className="bg-background flex min-h-svh flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-4">
        <div>
          {back === null ? null : (
            <Link
              href={back}
              className={buttonVariants({ size: "sm", variant: "ghost" })}
            >
              <ArrowLeftIcon aria-hidden />
              {t("back")}
            </Link>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <p className="text-muted-foreground truncate text-sm">
            {menu("signedInAs", { email })}
          </p>
          <SignOutButton />
        </div>
      </header>
      <main className="flex flex-1 flex-col px-4">{children}</main>
      <footer className="text-muted-foreground px-4 py-6 text-xs">
        <Suspense fallback={null}>
          <ContractLinks />
        </Suspense>
      </footer>
    </div>
  );
};
