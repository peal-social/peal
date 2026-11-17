// Writes public/platform-marks/<slug>.svg, the mark each Platforms page shows
// in the sidebar, in the brand's colour, as the web app's BrandMark draws
// it: from simple-icons (CC0), or, for a brand it does not hold (LinkedIn,
// Slack, Google Business Profile), from the file its owner publishes, in
// peal-ui's src/brand-marks. Never draw a logo from memory (DESIGN.md,
// "Icons"). Run after upgrading simple-icons or changing a brand mark:
// bun packages/peal-docs/scripts/platform-marks.ts
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { linkedin } from "peal-ui/lib/brand-marks";
import {
  siBluesky,
  siDiscord,
  siFacebook,
  siInstagram,
  siMastodon,
  siPinterest,
  siTelegram,
  siThreads,
  siTiktok,
  siX,
  siYoutube,
} from "simple-icons";

/** A mark in one colour on its box, or the owner's file in its colours. */
type Mark =
  | {
      readonly hex: string;
      readonly path: string;
      readonly viewBox?: string | undefined;
    }
  | { readonly file: string };

const brandFile = (name: string): Mark => ({
  file: fileURLToPath(import.meta.resolve(`peal-ui/brand-marks/${name}`)),
});

const marks = {
  bluesky: siBluesky,
  discord: siDiscord,
  facebook: siFacebook,
  "google-business": brandFile("google-business-profile.svg"),
  instagram: siInstagram,
  linkedin,
  mastodon: siMastodon,
  pinterest: siPinterest,
  slack: brandFile("slack-color.svg"),
  telegram: siTelegram,
  threads: siThreads,
  tiktok: siTiktok,
  x: siX,
  youtube: siYoutube,
} satisfies Readonly<Record<string, Mark>>;

const svgOf = (mark: {
  hex: string;
  path: string;
  viewBox?: string | undefined;
}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox ?? "0 0 24 24"}" fill="#${mark.hex}"><path d="${mark.path}"/></svg>\n`;

const folder = path.join(import.meta.dirname, "..", "public", "platform-marks");

await mkdir(folder, { recursive: true });

await Promise.all(
  Object.entries(marks).map(async ([slug, mark]) => {
    const target = path.join(folder, `${slug}.svg`);

    await ("file" in mark
      ? copyFile(mark.file, target)
      : writeFile(target, svgOf(mark)));
  })
);
