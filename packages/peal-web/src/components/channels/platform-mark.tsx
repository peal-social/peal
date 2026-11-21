import type { ChannelPlatform } from "peal-contract";
import {
  siBluesky,
  siDevdotto,
  siDiscord,
  siFacebook,
  siHashnode,
  siInstagram,
  siMastodon,
  siPinterest,
  siTelegram,
  siThreads,
  siTiktok,
  siWordpress,
  siX,
  siYoutube,
} from "simple-icons";

import {
  BrandMark,
  googleBusinessProfileBrand,
  linkedinBrand,
  slackBrand,
} from "#components/shell/brand-mark.tsx";
import type { Brand } from "#components/shell/brand-mark.tsx";

// simple-icons' marks, and peal-ui's for the brands it does not hold
// (DESIGN.md, "Icons"). Both kinds of WordPress site show WordPress's.
const marks: Readonly<Record<ChannelPlatform, Brand>> = {
  bluesky: siBluesky,
  devto: siDevdotto,
  discord: siDiscord,
  facebook: siFacebook,
  googleBusiness: googleBusinessProfileBrand,
  hashnode: siHashnode,
  instagram: siInstagram,
  linkedin: linkedinBrand,
  mastodon: siMastodon,
  pinterest: siPinterest,
  slack: slackBrand,
  telegram: siTelegram,
  threads: siThreads,
  tiktok: siTiktok,
  wordpress: siWordpress,
  wordpressCom: siWordpress,
  x: siX,
  youtube: siYoutube,
};

const tileSizes = {
  // Over a channel's avatar, at its corner.
  badge: "size-4.5 rounded-sm [&_svg]:size-3",
  // Before a name in a menu or a chip.
  sm: "size-5 rounded-sm [&_svg]:size-3.5",
  // A platform's tile in the catalogue.
  lg: "size-9 rounded-lg [&_svg]:size-5",
} as const;

/**
 * A platform's own mark on a white tile with a hairline, so a mark in
 * white or in the canvas's colours still shows.
 */
export const PlatformMark = ({
  platform,
  size = "sm",
}: {
  readonly platform: ChannelPlatform;
  readonly size?: keyof typeof tileSizes;
}) => (
  <span
    className={`bg-card ring-border inline-flex shrink-0 items-center justify-center ring-1 ${tileSizes[size]}`}
  >
    <BrandMark icon={marks[platform]} />
  </span>
);
