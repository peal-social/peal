import { paletteOf } from "./colours";
import { frameDelay, framesOf, stillOf } from "./frames";
import type { Piece } from "./frames";
import { gifOf } from "./gif";
import { markPixels } from "./mark";
import { palettePng, rgbaPng } from "./png";

// The header: the right half of a field of the hero's glow, whose left
// half, where the mark and the name stand, is clear.
const header: Piece = { columns: [60, 120], field: [600, 90], layout: "hero" };

// The foot: a whole field of the closing band's.
const footer: Piece = { columns: [0, 120], field: [600, 80], layout: "band" };

// Four times the size it is shown at: a mail client that darkens an email
// may recolour an image under 100 px a side.
const markSize = 112;

/** What the art is drawn from, as text. */
export interface ArtSources {
  /** The mark: peal-web's `icon.svg`. */
  readonly mark: string;
  /** The glows' tokens: `tokens.css`. */
  readonly tokens: string;
}

/**
 * The art of Peal's emails, as files: the same bytes on every machine, so
 * a test can compare the committed ones with fresh ones.
 */
export const emailArt = ({
  mark,
  tokens,
}: ArtSources): ReadonlyMap<string, Uint8Array> => {
  const palette = paletteOf(tokens);

  return new Map([
    ["footer.png", palettePng(stillOf(footer), palette)],
    ["header.gif", gifOf(framesOf(header), palette, frameDelay)],
    ["header.png", palettePng(stillOf(header), palette)],
    ["mark.png", rgbaPng(markPixels(mark, markSize), markSize)],
  ]);
};
