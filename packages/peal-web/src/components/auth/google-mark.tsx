import { Option, Schema } from "effect";

import googleButton from "./google-g.svg";

// Google's "G", in Google's own file: the icon-only light button its
// branding guidelines publish (https://developers.google.com/identity/branding-guidelines,
// read on 2026-11-16: branding_guideline_sample_lt_sq_sl.svg), kept byte
// for byte, drawn with paths alone. The button is 40 units wide with its
// G at 10 to 30; the mark shows that G through a window of the same 20
// units, at half the control's height, as Google's 20 in its 40, scaled
// with its aspect ratio as the guidelines allow. Never a monochrome or
// redrawn G.

// Next types an imported SVG as anything: it is the file's address, which
// Next's build hands over as a static image and Vite's as a string.
const decodeStaticImage = Schema.decodeUnknownOption(
  Schema.Struct({ src: Schema.String })
);

const decodeAddress = Schema.decodeUnknownOption(Schema.String);

const googleButtonAddress = decodeStaticImage(googleButton).pipe(
  Option.map(({ src }) => src),
  Option.orElse(() => decodeAddress(googleButton)),
  Option.getOrElse(() => "")
);

export const GoogleMark = () => (
  <svg aria-hidden width={16} height={16} viewBox="10 10 20 20">
    <image href={googleButtonAddress} width={40} height={40} />
  </svg>
);
