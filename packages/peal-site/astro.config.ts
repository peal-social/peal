import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";
import { siteFonts } from "peal-ui/lib/site/fonts";

import { defaultLocale, locales } from "./src/i18n/locales.ts";

// Optional settings read at build time. src/config.ts treats an empty value
// as unset, so a CI variable that is declared but blank turns the feature off.
const optional = envField.string({
  access: "public",
  context: "server",
  optional: true,
});

// The public origin, such as https://example.com, for canonical and
// alternate-language links. Astro reads its config before loading .env
// files, so this one comes from the process environment.
const site = process.env["SITE_URL"]?.trim();

const config = defineConfig({
  env: {
    schema: {
      // The web app's origin, such as https://app.example.com: adds the
      // header's Log in and Get started, and the links to cancel a contract
      // and to withdraw from one, which the app serves, to the foot of
      // every page.
      SITE_APP_URL: optional,
      // The Discord server's invitation, such as https://discord.gg/…: adds
      // Discord to the header, the Resources menu and the footer.
      SITE_DISCORD_URL: optional,
      // The docs site's origin, such as https://docs.example.com: adds links
      // to it.
      SITE_DOCS_URL: optional,
      // Loads Plausible for this domain, from SITE_PLAUSIBLE_HOST when set
      // (a self-hosted instance) or from Plausible's own servers.
      SITE_PLAUSIBLE_DOMAIN: optional,
      SITE_PLAUSIBLE_HOST: optional,
      // Measures the site with PostHog, and asks each visitor with the
      // consent notice, when a key and a host are both set: the project
      // token, where events go (a path on this origin such as /pulse/site,
      // or an https origin), the parent domain the answer cookie is shared
      // on, and every event's environment (production by default).
      SITE_POSTHOG_COOKIE_DOMAIN: optional,
      SITE_POSTHOG_ENVIRONMENT: optional,
      SITE_POSTHOG_HOST: optional,
      SITE_POSTHOG_KEY: optional,
    },
  },
  i18n: {
    defaultLocale,
    locales: [...locales],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [react()],
  output: "static",
  vite: { plugins: [tailwindcss()] },

  // Geist and Geist Mono, self-hosted, as the blog has them.
  fonts: siteFonts().map((font) => ({
    ...font,
    provider: fontProviders.local(),
  })),
});

if (site !== undefined && site !== "") {
  config.site = site;
}

export default config;
