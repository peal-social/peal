import { Buffer } from "node:buffer";
import { crc32 } from "node:zlib";

import type { Rgb } from "./colours";
import { deflated } from "./deflate";
import type { Picture } from "./picture";

const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const uint32 = (value: number) =>
  [24, 16, 8, 0].map((shift) => Math.floor(value / 2 ** shift) % 256);

const chunkOf = (type: string, data: Iterable<number>) => {
  const body = Uint8Array.from([...Buffer.from(type, "latin1"), ...data]);

  return [...uint32(body.length - 4), ...body, ...uint32(crc32(body))];
};

const headerOf = (
  { height, width }: Pick<Picture, "height" | "width">,
  depth: number,
  colourType: number
) =>
  chunkOf("IHDR", [
    ...uint32(width),
    ...uint32(height),
    depth,
    colourType,
    0,
    0,
    0,
  ]);

// A picture's rows, each after the byte that says it is not filtered.
const rowsOf = (bytes: Uint8Array, stride: number) => {
  const height = bytes.length / stride;
  const rows = new Uint8Array((stride + 1) * height);

  for (let row = 0; row < height; row += 1) {
    rows.set(
      bytes.subarray(row * stride, (row + 1) * stride),
      row * (stride + 1) + 1
    );
  }

  return rows;
};

const fileOf = (chunks: readonly (readonly number[])[]) =>
  Uint8Array.from([...signature, ...chunks.flat(), ...chunkOf("IEND", [])]);

/** A palette PNG, 16 colours at most, of an even width; index 0 is clear. */
export const palettePng = (
  picture: Picture,
  palette: readonly Rgb[]
): Uint8Array => {
  const { height, pixels, width } = picture;
  // Two pixels a byte.
  const stride = width / 2;

  const packed = Uint8Array.from(
    { length: stride * height },
    (_, index) => (pixels[index * 2] ?? 0) * 16 + (pixels[index * 2 + 1] ?? 0)
  );

  return fileOf([
    headerOf(picture, 4, 3),
    chunkOf("PLTE", palette.flat()),
    chunkOf("tRNS", [0]),
    chunkOf("IDAT", deflated(rowsOf(packed, stride), [1, stride + 1])),
  ]);
};

/** A PNG of red, green, blue and alpha bytes, `size` pixels square. */
export const rgbaPng = (bytes: Uint8Array, size: number): Uint8Array => {
  const stride = size * 4;

  return fileOf([
    headerOf({ height: size, width: size }, 8, 6),
    chunkOf("IDAT", deflated(rowsOf(bytes, stride), [4, stride + 1])),
  ]);
};
