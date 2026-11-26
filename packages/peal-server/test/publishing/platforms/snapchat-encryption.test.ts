import { assert, describe, expect, it, layer } from "@effect/vitest";
import { Effect, Layer, Stream } from "effect";
import { Cipher, SecureRandom } from "effect/crypto";

import {
  encryptedParts,
  encryptedSizeOf,
  maxParts,
  partCountOf,
  snapchatPartSize,
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
    partSize - 17,
    partSize - 16,
    partSize - 1,
    partSize,
    partSize + 1,
    2 * partSize - 1,
    2 * partSize,
    3 * partSize + 1,
  ])(
    "of %d bytes is one encryption of the whole, cut as split cuts it",
    (size) =>
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

        // One part when the encryption fits in one, as `split` leaves it;
        // else every part but the last is a whole part's size.
        assert.strictEqual(
          parts.length,
          Math.ceil(encryptedSizeOf(size) / partSize)
        );

        for (const [index, { bytes }] of parts.entries()) {
          assert.isAtMost(bytes.length, partSize);

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

describe(partCountOf, () => {
  it("cuts every 32 MiB of the encryption, as split -b 32m does", () => {
    expect(snapchatPartSize).toBe(33_554_432);
    expect(partCountOf(1, snapchatPartSize)).toBe(1);
    // The encryption of 32 MiB less 16 bytes takes 32 MiB: one part.
    expect(partCountOf(snapchatPartSize - 16, snapchatPartSize)).toBe(1);
    // Of 32 MiB, its padding makes a second part of 16 bytes.
    expect(partCountOf(snapchatPartSize, snapchatPartSize)).toBe(2);
  });

  it("keeps the largest video Snap takes within 35 parts and 1 GB", () => {
    const largest = 999_999_984;

    expect(encryptedSizeOf(largest)).toBe(1_000_000_000);
    expect(partCountOf(largest, snapchatPartSize)).toBe(30);
    expect(partCountOf(largest, snapchatPartSize)).toBeLessThanOrEqual(
      maxParts
    );
  });
});
