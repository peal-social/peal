import { Buffer } from "node:buffer";

import { bitWriter } from "./bits";
import type { Rgb } from "./colours";
import type { Picture } from "./picture";

// The palette is padded to 16 colours: 4 bits an index.
const indexBits = 4;

const colours = 2 ** indexBits;

const longestCode = 12;

// LZW as GIF has it: codes that grow with the table, cleared when full.
const compressed = (indexes: Uint8Array): Uint8Array => {
  const out = bitWriter();
  const clear = colours;
  const end = clear + 1;
  let table = new Map<number, number>();
  let codeBits = indexBits + 1;
  let next = end + 1;
  let prefix = indexes[0] ?? 0;

  out.write(clear, codeBits);

  for (const value of indexes.subarray(1)) {
    const key = prefix * 256 + value;
    const known = table.get(key);

    if (known !== undefined) {
      prefix = known;
      continue;
    }

    out.write(prefix, codeBits);

    if (next === 2 ** longestCode) {
      out.write(clear, codeBits);
      table = new Map();
      codeBits = indexBits + 1;
      next = end + 1;
    } else {
      table.set(key, next);

      if (next === 2 ** codeBits) {
        codeBits += 1;
      }

      next += 1;
    }

    prefix = value;
  }

  out.write(prefix, codeBits);
  out.write(end, codeBits);

  return out.finish();
};

const uint16 = (value: number) => [value % 256, Math.floor(value / 256)];

// Data in blocks of 255 bytes at most, each after its length, then none.
const blocksOf = (data: Uint8Array): number[] => {
  const blocks: number[] = [];

  for (let offset = 0; offset < data.length; offset += 255) {
    const block = data.subarray(offset, offset + 255);

    blocks.push(block.length, ...block);
  }

  return [...blocks, 0];
};

// What is done with a frame before the next one is drawn: nothing, or the
// clear colour in its place.
const leaveInPlace = 1;

const clearAfter = 2;

const frameOf = (
  { height, pixels, width }: Picture,
  delay: number,
  disposal: number
): number[] => [
  // How it goes, its delay, and index 0 as the clear one.
  0x21,
  0xf9,
  4,
  disposal * 4 + 1,
  ...uint16(delay),
  0,
  0,
  // Its place: the whole picture.
  0x2c,
  0,
  0,
  0,
  0,
  ...uint16(width),
  ...uint16(height),
  0,
  indexBits,
  ...blocksOf(compressed(pixels)),
];

/**
 * An animated GIF of pictures of one size and palette, `delay` hundredths
 * of a second each. It says nothing of repeating, so it plays once, and
 * rests on its last frame, which is left in place.
 */
export const gifOf = (
  frames: readonly Picture[],
  palette: readonly Rgb[],
  delay: number
): Uint8Array => {
  const { height, width } = frames[0] ?? { height: 0, width: 0 };

  return Uint8Array.from([
    ...Buffer.from("GIF89a", "latin1"),
    ...uint16(width),
    ...uint16(height),
    // One palette for every frame, of 16 colours.
    0xb3,
    0,
    0,
    ...palette.flat(),
    ...Array.from({ length: (colours - palette.length) * 3 }, () => 0),
    ...frames.flatMap((frame, index) =>
      frameOf(
        frame,
        delay,
        index === frames.length - 1 ? leaveInPlace : clearAfter
      )
    ),
    0x3b,
  ]);
};
