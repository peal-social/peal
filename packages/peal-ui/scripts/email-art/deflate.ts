import { bitWriter } from "./bits";
import type { BitWriter } from "./bits";

// A zlib stream (RFC 1950, RFC 1951) of one block with the fixed codes.
// Node's own zlib writes other bytes on another processor, and the committed
// files are compared with fresh ones on every machine.

const shortestMatch = 3;

const longestMatch = 258;

// Length codes from 257, and distance codes from 0: where each starts, and
// how many more bits say how far past it.
const lengthCodes = [
  ...Array.from({ length: 8 }, (_, code) => ({ extra: 0, from: code + 3 })),
  ...Array.from({ length: 20 }, (_, code) => {
    const extra = Math.floor(code / 4) + 1;

    return { extra, from: (4 + (code % 4)) * 2 ** extra + 3 };
  }),
  { extra: 0, from: longestMatch },
];

const distanceCodes = [
  ...Array.from({ length: 4 }, (_, code) => ({ extra: 0, from: code + 1 })),
  ...Array.from({ length: 26 }, (_, code) => {
    const extra = Math.floor(code / 2) + 1;

    return { extra, from: (2 + (code % 2)) * 2 ** extra + 1 };
  }),
];

// A Huffman code is written from its highest bit.
const writeCode = (out: BitWriter, code: number, count: number) => {
  for (let bit = count - 1; bit >= 0; bit -= 1) {
    out.write(Math.floor(code / 2 ** bit) % 2, 1);
  }
};

const writeSymbol = (out: BitWriter, symbol: number) => {
  if (symbol < 144) {
    writeCode(out, 0x30 + symbol, 8);
  } else if (symbol < 256) {
    writeCode(out, 0x1_90 + symbol - 144, 9);
  } else if (symbol < 280) {
    writeCode(out, symbol - 256, 7);
  } else {
    writeCode(out, 0xc0 + symbol - 280, 8);
  }
};

const endOfBlock = 256;

const writeMatch = (out: BitWriter, length: number, distance: number) => {
  const code = lengthCodes.findLastIndex(({ from }) => from <= length);
  const start = lengthCodes[code] ?? { extra: 0, from: length };

  writeSymbol(out, endOfBlock + 1 + code);
  out.write(length - start.from, start.extra);

  const farCode = distanceCodes.findLastIndex(({ from }) => from <= distance);
  const farStart = distanceCodes[farCode] ?? { extra: 0, from: distance };

  writeCode(out, farCode, 5);
  out.write(distance - farStart.from, farStart.extra);
};

// How many bytes at `position` repeat those `distance` before.
const matchAt = (bytes: Uint8Array, position: number, distance: number) => {
  if (distance > position) {
    return 0;
  }

  let length = 0;

  while (
    length < longestMatch &&
    position + length < bytes.length &&
    bytes[position + length] === bytes[position + length - distance]
  ) {
    length += 1;
  }

  return length;
};

const adler32 = (bytes: Uint8Array) => {
  let a = 1;
  let b = 0;

  for (const byte of bytes) {
    a = (a + byte) % 65_521;
    b = (b + a) % 65_521;
  }

  return [Math.floor(b / 256), b % 256, Math.floor(a / 256), a % 256];
};

/**
 * Bytes as a zlib stream, which finds what repeats one of `repeats` bytes
 * before: a pixel, a row.
 */
export const deflated = (
  bytes: Uint8Array,
  repeats: readonly number[]
): Uint8Array => {
  const out = bitWriter();

  // The last block, with the fixed codes.
  out.write(1, 1);
  out.write(1, 2);

  let position = 0;

  while (position < bytes.length) {
    let length = 0;
    let distance = 0;

    for (const repeat of repeats) {
      const found = matchAt(bytes, position, repeat);

      if (found > length) {
        length = found;
        distance = repeat;
      }
    }

    if (length >= shortestMatch) {
      writeMatch(out, length, distance);
      position += length;
    } else {
      writeSymbol(out, bytes[position] ?? 0);
      position += 1;
    }
  }

  writeSymbol(out, endOfBlock);

  return Uint8Array.from([0x78, 0x01, ...out.finish(), ...adler32(bytes)]);
};
