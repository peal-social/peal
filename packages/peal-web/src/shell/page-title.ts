import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import type { Messages } from "next-intl";
import { getTranslations } from "next-intl/server";
import { ChannelPlatformSchema } from "peal-contract";

import { routing } from "#i18n/routing.ts";

// The browser tab names the page, then where it is: "Analytics · Client A"
// in a workspace (its layout's template adds the name), "Create a
// workspace · Peal" on the setup page (the locale layout's).

type WorkspacePage = keyof Messages["WorkspaceShell"]["pages"];

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

/**
 * A platform's form's `generateMetadata`, under New channel: the
 * platform's name ("Mastodon · Client A"), or the page's when the address
 * names no platform a channel connects to.
 */
export const platformPageTitle = async (
  props: TitledProps & {
    readonly params: Promise<{ readonly platform: string }>;
  }
): Promise<Metadata> => {
  const { platform: word } = await props.params;
  const locale = await localeOf(props);

  const platform = ChannelPlatformSchema.literals.find((each) => each === word);

  if (platform === undefined) {
    return await workspacePageTitle("channelPlatform")(props);
  }

  const t = await getTranslations({ locale, namespace: "ChannelsPage" });

  return { title: t("platform", { platform }) };
};

/** The second setup step's `generateMetadata`: connecting channels. */
export const setupChannelsPageTitle = async (
  props: TitledProps
): Promise<Metadata> => {
  const t = await getTranslations({
    locale: await localeOf(props),
    namespace: "SetupCard",
  });

  return { title: t("title") };
};

/** The setup page's `generateMetadata`, at `/` and `/create`: its title. */
export const setupPageTitle = async (props: TitledProps): Promise<Metadata> => {
  const t = await getTranslations({
    locale: await localeOf(props),
    namespace: "AppPage",
  });

  return { title: t("createTitle") };
};
