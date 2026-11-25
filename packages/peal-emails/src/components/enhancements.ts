import { phoneGutter } from "./theme.ts";

// What an email gains where a mail client keeps its stylesheet: every style
// that matters is inline. Each rule has its class here alone, and is written
// so that no `{word}` in it reads as a placeholder.

/** A cell whose sides are the card's gutters, narrower on a phone. */
export const gutterClass = "peal-gutter";

/** The header's art that moves, and what holds its still, for reduced motion. */
export const movingClass = "peal-moving";

export const stillClass = "peal-still";

export const enhancements = [
  ":root{color-scheme:light only}",
  `@media (prefers-reduced-motion:reduce){.${movingClass}{display:none!important}.${stillClass}{display:block!important;max-height:none!important;overflow:visible!important}}`,
  `@media (max-width:480px){.${gutterClass}{padding-left:${phoneGutter}!important;padding-right:${phoneGutter}!important}}`,
].join("");
