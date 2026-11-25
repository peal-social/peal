import { layouts } from "../../src/lib/pixel-glow";

/** A colour's red, green and blue. */
export type Rgb = readonly [red: number, green: number, blue: number];

/** A `#rrggbb` colour. */
export const rgbOf = (hex: string): Rgb => {
  const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((start) =>
    Number.parseInt(hex.slice(start, start + 2), 16)
  );

  return [red, green, blue];
};

// A token's value in the text of `tokens.css`, or the colour itself.
const colourOf = (tone: string, tokens: string) => {
  if (!tone.startsWith("--")) {
    return tone;
  }

  const value = new RegExp(`${tone}: (?<value>#[0-9a-f]{6});`, "u").exec(tokens)
    ?.groups?.["value"];

  if (value === undefined) {
    throw new Error(`tokens.css gives ${tone} no colour.`);
  }

  return value;
};

// Every tone of every glow, once. The palette's first colour is the clear
// one, so a tone's index is one more than its place here.
const tones = [
  ...new Set<string>(
    Object.values(layouts).flatMap((glows) =>
      glows.flatMap((glow) => [...glow.tones])
    )
  ),
];

/** The palette's index of a glow's tone. */
export const toneIndex = (tone: string): number => tones.indexOf(tone) + 1;

/** The palette of the art: clear, then the glows' tones. */
export const paletteOf = (tokens: string): readonly Rgb[] => [
  [0, 0, 0],
  ...tones.map((tone) => rgbOf(colourOf(tone, tokens))),
];
