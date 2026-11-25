/** Bits packed into bytes, the lowest first, as GIF and deflate want them. */
export interface BitWriter {
  /** The bytes, the last one filled with zeros. */
  readonly finish: () => Uint8Array;
  /** Adds the `count` lowest bits of `value`. */
  readonly write: (value: number, count: number) => void;
}

/** A writer of bits. */
export const bitWriter = (): BitWriter => {
  const bytes: number[] = [];
  let held = 0;
  let bits = 0;

  return {
    finish: () => Uint8Array.from(bits > 0 ? [...bytes, held] : bytes),
    write: (value, count) => {
      held += value * 2 ** bits;
      bits += count;

      while (bits >= 8) {
        bytes.push(held % 256);
        held = Math.floor(held / 256);
        bits -= 8;
      }
    },
  };
};
