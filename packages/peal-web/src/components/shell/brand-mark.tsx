import googleBusinessProfileFile from "peal-ui/brand-marks/google-business-profile.svg";
import slackFile from "peal-ui/brand-marks/slack-color.svg";
import { linkedin } from "peal-ui/lib/brand-marks";

import {
  assetAddress,
  decodeImportedFile,
} from "#components/shell/asset-address.ts";

/**
 * A brand's mark: one path in the brand's colour (simple-icons', on its
 * 24-unit box, or one of peal-ui's brand marks with its own box), or the
 * address of a file a brand publishes in its colours only.
 */
type Brand =
  | {
      readonly hex: string;
      readonly path: string;
      readonly viewBox?: string | undefined;
    }
  | { readonly src: string };

// The brands simple-icons does not hold, from the files their owners
// publish (peal-ui's src/brand-marks): LinkedIn's one-colour mark in its
// blue, and Slack's and Google Business Profile's files in their colours.
export const linkedinBrand: Brand = linkedin;

export const slackBrand: Brand = {
  src: assetAddress(decodeImportedFile(slackFile)),
};

export const googleBusinessProfileBrand: Brand = {
  src: assetAddress(decodeImportedFile(googleBusinessProfileFile)),
};

/**
 * A brand's own mark, in the brand's colour: from simple-icons (CC0), or
 * from peal-ui's brand marks for a brand it does not hold. Never draw a
 * logo from memory (DESIGN.md, "Icons").
 */
export const BrandMark = ({
  className,
  icon,
}: {
  readonly className?: string;
  readonly icon: Brand;
}) =>
  "src" in icon ? (
    // The owner's file as it is, drawn by an SVG image: square, so it
    // fills the box.
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <image href={icon.src} width={24} height={24} />
    </svg>
  ) : (
    <svg
      viewBox={icon.viewBox ?? "0 0 24 24"}
      aria-hidden
      className={className}
      fill={`#${icon.hex}`}
    >
      <path d={icon.path} />
    </svg>
  );

export type { Brand };
