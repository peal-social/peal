// Reads back the files the emails' art is written in: what a picture's
// bytes say, apart from the code that wrote them.
import { inflateSync } from "node:zlib";

const uint16 = (bytes: Uint8Array, at: number) =>
  (bytes[at] ?? 0) + (bytes[at + 1] ?? 0) * 256;

const latin1 = new TextDecoder("latin1");

/** A colour as `#rrggbb`, of the three bytes at `at`. */
const hexAt = (bytes: Uint8Array, at: number) =>
  `#${[...bytes.subarray(at, at + 3)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;

const coloursOf = (bytes: Uint8Array) =>
  Array.from({ length: bytes.length / 3 }, (_, index) =>
    hexAt(bytes, index * 3)
  );

/** A PNG's chunks, the data of those of one type joined. */
const pngChunks = (file: Uint8Array): ReadonlyMap<string, Uint8Array> => {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const chunks = new Map<string, Uint8Array>();
  let at = 8;

  while (at < file.length) {
    const length = view.getUint32(at);

    chunks.set(
      latin1.decode(file.subarray(at + 4, at + 8)),
      file.subarray(at + 8, at + 8 + length)
    );
    at += length + 12;
  }

  return chunks;
};

const noBytes = new Uint8Array();

// A PNG's rows, without the byte before each that says how it is filtered.
const rowsOf = (file: Uint8Array, stride: number) => {
  const data = inflateSync(pngChunks(file).get("IDAT") ?? noBytes);

  return Array.from({ length: data.length / (stride + 1) }, (_, row) => [
    ...data.subarray(row * (stride + 1) + 1, (row + 1) * (stride + 1)),
  ]).flat();
};

/** A palette PNG of 4 bits an index: its colours, and each pixel's index. */
export const readPalettePng = (file: Uint8Array, width: number) => ({
  clear: [...(pngChunks(file).get("tRNS") ?? noBytes)],
  colours: coloursOf(pngChunks(file).get("PLTE") ?? noBytes),
  pixels: rowsOf(file, width / 2).flatMap((byte) => [
    Math.floor(byte / 16),
    byte % 16,
  ]),
});

/** An RGBA PNG's pixels, as `#rrggbb` and the alpha byte. */
export const readRgbaPng = (file: Uint8Array, width: number) => {
  const bytes = Uint8Array.from(rowsOf(file, width * 4));

  return Array.from({ length: bytes.length / 4 }, (_, index) => ({
    alpha: bytes[index * 4 + 3] ?? 0,
    colour: hexAt(bytes, index * 4),
  }));
};

// LZW as GIF has it, undone.
const expanded = (data: readonly number[], indexBits: number): number[] => {
  const clear = 2 ** indexBits;

  const roots = Array.from({ length: clear + 2 }, (_, index) =>
    index < clear ? [index] : []
  );

  const pixels: number[] = [];
  let table = [...roots];
  let codeBits = indexBits + 1;
  let previous: readonly number[] = [];
  let held = 0;
  let bits = 0;

  for (const byte of data) {
    held += byte * 2 ** bits;
    bits += 8;

    while (bits >= codeBits) {
      const code = held % 2 ** codeBits;

      held = Math.floor(held / 2 ** codeBits);
      bits -= codeBits;

      if (code === clear + 1) {
        return pixels;
      }

      if (code === clear) {
        table = [...roots];
        codeBits = indexBits + 1;
        previous = [];
      } else {
        const entry = table[code] ?? [...previous, previous[0] ?? 0];

        pixels.push(...entry);

        if (previous.length > 0 && table.length < 4096) {
          table.push([...previous, entry[0] ?? 0]);
          codeBits = Math.min(
            12,
            Math.max(codeBits, table.length.toString(2).length)
          );
        }

        previous = entry;
      }
    }
  }

  return pixels;
};

/** One of a GIF's frames. */
export interface GifFrame {
  /** Hundredths of a second. */
  readonly delay: number;
  readonly disposal: number;
  readonly pixels: readonly number[];
}

/** A GIF with one palette, whose frames each fill it. */
export const readGif = (file: Uint8Array) => {
  const tableSize = 2 ** (((file[10] ?? 0) % 8) + 1);
  const frames: GifFrame[] = [];
  const applications: string[] = [];
  let control = { delay: 0, disposal: 0 };
  let at = 13 + tableSize * 3;

  const blocks = () => {
    const data: number[] = [];

    while ((file[at] ?? 0) > 0) {
      const length = file[at] ?? 0;

      data.push(...file.subarray(at + 1, at + 1 + length));
      at += length + 1;
    }

    at += 1;

    return data;
  };

  while (file[at] !== 0x3b && at < file.length) {
    const extension = file[at] === 0x21 ? file[at + 1] : undefined;

    if (extension === undefined) {
      const indexBits = file[at + 10] ?? 0;

      at += 11;
      frames.push({ ...control, pixels: expanded(blocks(), indexBits) });
    } else {
      at += 2;

      const data = Uint8Array.from(blocks());

      if (extension === 0xf9) {
        control = {
          delay: uint16(data, 1),
          disposal: Math.floor((data[0] ?? 0) / 4),
        };
      } else {
        applications.push(latin1.decode(data.subarray(0, 11)));
      }
    }
  }

  return {
    applications,
    colours: coloursOf(file.subarray(13, 13 + tableSize * 3)),
    frames,
    height: uint16(file, 8),
    version: latin1.decode(file.subarray(0, 6)),
    width: uint16(file, 6),
  };
};
