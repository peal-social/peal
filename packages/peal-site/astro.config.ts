import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";

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
      // `on` builds the blocks showcase at /blocks, which `astro dev` always
      // serves: every peal-ui block with synthetic content, for review,
      // kept out of search engines. Off, the build has no such page.
      SITE_BLOCKS: optional,
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

  // Geist and Geist Mono from the geist package, self-hosted: peal-ui's
  // theme reads them as --font-geist-sans and --font-geist-mono.
  fonts: [
    {
      cssVariable: "--font-geist-sans",
      fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
      name: "Geist",
      options: {
        variants: [
          {
            src: [
              "./node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2",
            ],
            style: "normal",
            weight: "100 900",
          },
        ],
      },
      provider: fontProviders.local(),
    },
    {
      cssVariable: "--font-geist-mono",
      fallbacks: ["ui-monospace", "monospace"],
      name: "Geist Mono",
      options: {
        variants: [
          {
            src: [
              "./node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
            ],
            style: "normal",
            weight: "100 900",
          },
        ],
      },
      provider: fontProviders.local(),
    },
  ],
});

if (site !== undefined && site !== "") {
  config.site = site;
}

export default config;
