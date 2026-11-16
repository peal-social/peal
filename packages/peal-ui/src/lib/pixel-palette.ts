// What every piece of pixel art shares (DESIGN.md, Pixel art): the 5 px
// cell, the 4x4 Bayer dither, and the four tones of the mark's colours it
// draws in, read from the tokens on the page.

/** A cell's side in CSS pixels; tokens.css's --pixel-cell. */
export const pixelCell = 5;

const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The 4x4 Bayer threshold of a cell, between 0 and 1. */
export const threshold = (column: number, row: number) =>
  ((bayer[(row % 4) * 4 + (column % 4)] ?? 0) + 0.5) / 16;

/** Where the art is drawn: on the brand field, or on the page. */
export type PixelGround = "field" | "page";

/** Four CSS colours, dim to bright. */
export type PixelTones = readonly [string, string, string, string];

// On the field, white is the brightest tone; on the page, the deep blue
// stands in for it, since white would not show.
const toneTokens = {
  field: ["--brand", "--lavender", "--field-foreground", "--sun"],
  page: ["--lavender", "--brand", "--brand-hover", "--sun"],
} as const;

/** The art's tones, read from the tokens where the element sits. */
export const pixelTones = (element: Element, on: PixelGround): PixelTones => {
  const style = getComputedStyle(element);

  const [first, second, third, fourth] = toneTokens[on].map((name) =>
    style.getPropertyValue(name).trim()
  );

  return [first ?? "", second ?? "", third ?? "", fourth ?? ""];
};

/** Whether the reader asked for less motion. */
export const prefersReducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
