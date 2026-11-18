// Geist and Geist Mono for the Astro apps of peal.social (the site and the
// blog), self-hosted from the geist package: peal-ui's theme reads them as
// --font-geist-sans and --font-geist-mono. Each app adds
// `provider: fontProviders.local()` to both and keeps `geist` in its own
// dependencies, since the paths resolve from the app's root.

/** A font as Astro's local font provider takes it, without the provider. */
export interface SiteFont {
  cssVariable: string;
  fallbacks: string[];
  name: string;
  options: { variants: [FontVariant, ...FontVariant[]] };
}

interface FontVariant {
  src: [string, ...string[]];
  style: "normal";
  weight: string;
}

/** Both fonts, fresh for each app's config. */
export const siteFonts = (): SiteFont[] => [
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
  },
];
