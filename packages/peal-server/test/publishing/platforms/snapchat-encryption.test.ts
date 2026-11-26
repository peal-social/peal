import { assert, describe, expect, it, layer } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import { Cipher, SecureRandom } from "effect/crypto";

import {
  encryptedParts,
  maxParts,
  minPartSize,
  partCountOf,
  partSizeOf,
} from "#publishing/infrastructure/platforms/snapchat/snapchat-encryption.ts";

const CipherTest = Cipher.layerWebCrypto.pipe(
  Layer.provideMerge(SecureRandom.layerWebCrypto)
);

// A few blocks a part, so the cases hold kilobytes.
const partSize = 64;

const key = Uint8Array.from({ length: 32 }, (_, index) => index + 1);

const iv = Uint8Array.from({ length: 16 }, (_, index) => 200 - index);

const fileOf = (size: number) =>
  Uint8Array.from({ length: size }, (_, index) => (index * 7 + 3) % 256);

const joined = (parts: readonly Uint8Array[]) => {
  const whole = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0)
  );

  let offset = 0;

  for (const part of parts) {
    whole.set(part, offset);
    offset += part.length;
  }

  return whole;
};

// The file as the media store sends it: in chunks of their own size.
const chunked = (file: Uint8Array, chunk = 23) =>
  Stream.fromIterable(
    Array.from({ length: Math.ceil(file.length / chunk) }, (_, index) =>
      file.subarray(index * chunk, (index + 1) * chunk)
    )
  );

const partsOf = (file: Uint8Array, declared = file.length) =>
  chunked(file).pipe(
    encryptedParts({ byteSize: declared, iv, key, partSize }),
    Stream.runCollect
  );

layer(CipherTest)("a file encrypted part by part", (withCipher) => {
  withCipher.effect.each([
    1,
    15,
    16,
    17,
    partSize - 1,
    partSize,
    partSize + 1,
    3 * partSize,
    3 * partSize + 1,
  ])("of %d bytes is one encryption of the whole, cut", (size) =>
    Effect.gen(function* encryptsWhole() {
      const cipher = yield* Cipher.Cipher;
      const file = fileOf(size);
      const parts = yield* partsOf(file);
      const sealed = yield* Cipher.key(Cipher.aes256Cbc, key);
      const whole = yield* cipher.encrypt(sealed, file, { iv });
      const ciphertext = joined(parts.map(({ bytes }) => bytes));

      // Byte for byte what `openssl enc -aes-256-cbc -nosalt` answers.
      assert.deepStrictEqual(ciphertext, whole);
      assert.deepStrictEqual(
        yield* cipher.decrypt(sealed, ciphertext, { iv }),
        file
      );
      assert.deepStrictEqual(
        parts.map(({ number }) => number),
        Array.from({ length: partCountOf(size, partSize) }, (_, i) => i + 1)
      );

      for (const [index, { bytes }] of parts.entries()) {
        assert.isAtMost(bytes.length, partSize + 16);

        if (index < parts.length - 1) {
          assert.strictEqual(bytes.length, partSize);
        }
      }
    })
  );

  withCipher.effect("fails on a file shorter or longer than declared", () =>
    Effect.gen(function* disagrees() {
      for (const [actual, declared] of [
        [3 * partSize - 10, 3 * partSize],
        [partSize, partSize + 1],
        [3 * partSize + 5, 3 * partSize],
        [partSize + 1, partSize],
        [0, 1],
      ] as const) {
        const failure = yield* partsOf(fileOf(actual), declared).pipe(
          Effect.flip
        );

        assert.strictEqual(failure._tag, "PlatformUnavailable");
      }
    })
  );
});

describe(partSizeOf, () => {
  const mebibyte = 1024 * 1024;

  it("is 4 MiB up to a file of 140 MiB, and more past it", () => {
    expect(partSizeOf(1)).toBe(minPartSize);
    expect(partSizeOf(20 * mebibyte)).toBe(4 * mebibyte);
    expect(partSizeOf(140 * mebibyte)).toBe(4 * mebibyte);
    expect(partSizeOf(140 * mebibyte + 1)).toBeGreaterThan(4 * mebibyte);
  });

  it("is 28,571,440 bytes, in 35 parts, for a file of 1,000,000,000", () => {
    expect(partSizeOf(1_000_000_000)).toBe(28_571_440);
    expect(partCountOf(1_000_000_000, partSizeOf(1_000_000_000))).toBe(35);
  });

  it.each([1, 4_194_305, 146_800_641, 333_333_333, 999_999_999, 1_000_000_000])(
    "is a whole number of blocks, in 35 parts at most, for %d bytes",
    (size) => {
      const part = partSizeOf(size);

      expect(part % 16).toBe(0);
      expect(partCountOf(size, part)).toBeLessThanOrEqual(maxParts);
      // Under 32 MB with the last part's padding, in either reading.
      expect(part + 16).toBeLessThan(32_000_000);
    }
  );
});
