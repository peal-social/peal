import { Option, Schema } from "effect";
import Image from "next/image";

import googleG from "./google-g.svg";

// Google's "G", from the pre-approved sign-in assets Google's branding
// guidelines link (https://developers.google.com/identity/branding-guidelines,
// read on 2026-11-16: signin-assets.zip, Android + Web, SVG, Light, the
// icon-only square), as Google drew it: only the button's fill and border
// are left out and the view box cut to the mark. The guidelines ask for
// this full-colour mark on white, never a monochrome one or a redrawing.

// Next types an imported SVG as anything: it is the file's address, which
// Next's build hands over as a static image and Vite's as a string.
const decodeStaticImage = Schema.decodeUnknownOption(
  Schema.Struct({ src: Schema.String })
);

const decodeAddress = Schema.decodeUnknownOption(Schema.String);

const googleMarkAddress = decodeStaticImage(googleG).pipe(
  Option.map(({ src }) => src),
  Option.orElse(() => decodeAddress(googleG)),
  Option.getOrElse(() => "")
);

export const GoogleMark = () => (
  <Image src={googleMarkAddress} alt="" width={16} height={16} unoptimized />
);
