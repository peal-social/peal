import node from "@astrojs/node";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";
import emdash, { s3 } from "emdash/astro";
import { postgres } from "emdash/db";
import { siteFonts } from "peal-ui/lib/site/fonts";
import { defaultLocale, locales } from "peal-ui/lib/site/locales";

// The public origin, such as https://peal.social. At build it sets Astro's
// `site` and lets EmDash optimise its media through Astro's image endpoint,
// whose allow-list is fixed at build; at run time EmDash reads
// EMDASH_SITE_URL from the environment.
const site = process.env["BLOG_SITE_URL"]?.trim().replace(/\/+$/u, "");

if (site !== undefined && site !== "") {
  process.env["EMDASH_SITE_URL"] ??= site;
}

const base = process.env["BLOG_BASE"] ?? "/blog";

// The admin builds preview links from the collection's URL pattern without
// Astro's base; this pattern, which EmDash reads at build, puts it back.
// `{id}` is the entry's id, which the entry page also finds it by.
process.env["EMDASH_PREVIEW_PATH_PATTERN"] ??=
  `${base.replace(/\/+$/u, "")}/{locale}/{id}`;

const config = defineConfig({
  adapter: node({ mode: "standalone" }),
  base,
  devToolbar: { enabled: false },
  // Geist and Geist Mono, self-hosted, as the site has them.
  fonts: siteFonts().map((font) => ({
    ...font,
    provider: fontProviders.local(),
  })),
  i18n: {
    defaultLocale,
    locales: [...locales],
    // Never prefixDefaultLocale: EmDash's admin breaks with it.
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    react(),
    // Ahead of EmDash's, whose middleware is also "pre": integrations add
    // theirs in the order they are listed.
    {
      hooks: {
        "astro:config:setup": ({ addMiddleware }) => {
          addMiddleware({
            entrypoint: new URL("src/middleware/guard.ts", import.meta.url),
            order: "pre",
          });
        },
      },
      name: "peal-blog-guard",
    },
    emdash({
      admin: { hiddenNavItems: ["comments", "menus", "redirects", "widgets"] },
      // No connection settings: pg reads PGHOST, PGPORT, PGDATABASE, PGUSER
      // and PGPASSWORD when the server starts, so none is in the build.
      database: postgres({}),
      // S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and
      // S3_REGION, read when the server starts.
      storage: s3(),
      updateCheck: false,
    }),
  ],
  output: "server",
  vite: { plugins: [tailwindcss()] },
});

if (site !== undefined && site !== "") {
  config.site = site;
}

export default config;
