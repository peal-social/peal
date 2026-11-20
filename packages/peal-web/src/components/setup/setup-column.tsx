import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * The setup page's column (DESIGN.md, "The frame", `setup`): its title,
 * the page's `h1`, one muted line under it, then what the page holds.
 */
export const SetupColumn = ({ children }: { readonly children: ReactNode }) => {
  const t = useTranslations("AppPage");

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-8 py-24">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("createTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("firstDescription")}</p>
      </div>
      {children}
    </div>
  );
};
