import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import type { Messages } from "next-intl";
import { getTranslations } from "next-intl/server";

import { routing } from "#i18n/routing.ts";

// The browser tab names the page, then where it is: "Analytics · Client A"
// in a workspace (its layout's template adds the name), "Report · Peal" on
// the person's own pages (the locale layout's).

type WorkspacePage = keyof Messages["WorkspaceShell"]["pages"];

type PersonalPage = keyof Messages["PersonalShell"]["pages"];

interface TitledProps {
  readonly params: Promise<{ readonly locale: string }>;
}

const localeOf = async ({ params }: TitledProps) => {
  const { locale } = await params;

  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
};

/** A workspace page's `generateMetadata`: its name, as the sidebar says it. */
export const workspacePageTitle =
  (page: WorkspacePage) =>
  async (props: TitledProps): Promise<Metadata> => {
    const t = await getTranslations({
      locale: await localeOf(props),
      namespace: "WorkspaceShell.pages",
    });

    return { title: t(page) };
  };

/** One of the person's own pages' `generateMetadata`. */
export const personalPageTitle =
  (page: PersonalPage) =>
  async (props: TitledProps): Promise<Metadata> => {
    const t = await getTranslations({
      locale: await localeOf(props),
      namespace: "PersonalShell.pages",
    });

    return { title: t(page) };
  };
