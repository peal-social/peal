import { Effect, Stream } from "effect";
import { Cipher } from "effect/crypto";

import { inParts } from "#publishing/infrastructure/platforms/byte-parts.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";

// Snap's Profile Asset Management page (developers.snap.com, Public Profile
// API, read 2026-11-26): "First encrypt the file" with AES-256-CBC, a random
// 32-byte key and 16-byte IV (`openssl enc -aes-256-cbc -nosalt`: plain CBC,
// PKCS#7 padding, no salt header), then "If your file is larger than 32 MB,
// split the file into chunks" (`split -b 32m`, pieces of 33,554,432 bytes),
// "Can be between 1 to 35" parts, for "A file of upto 1 GB". Peal follows
// that shape exactly: the whole file is encrypted, an encrypted file of
// 32 MiB or less goes as one part, and a larger one is cut every 32 MiB, the
// last part holding what is left. Whether Snap reads the samples so is
// unverified until a video of several parts plays on Snapchat.
//
// Peal never holds more than a part of the file, so it encrypts part by
// part, which CBC allows: each block is chained to the ciphertext block
// before it. A part that is not the last is 32 MiB of the file, a whole
// number of blocks; its ciphertext is the first 32 MiB of what `encrypt`
// answers (the block after them is the padding of an input that was already
// whole), and the next part's IV is its last block. The last part keeps its
// padding: for a file of a whole number of 32 MiB, it is that padding block
// alone, as `split` would cut it. The parts joined are byte for byte what
// one `encrypt` of the whole file answers.

const block = 16;

/** A part's size, as Snap's sample splits: `split -b 32m`. */
export const snapchatPartSize = 32 * 1024 * 1024;

/** The most parts Snap takes for one file. */
export const maxParts = 35;

/** The size of a file's encryption: PKCS#7 always adds 1 to 16 bytes. */
export const encryptedSizeOf = (byteSize: number): number =>
  byteSize - (byteSize % block) + block;

/**
 * How many parts a file of `byteSize` bytes goes in, cut every `partSize`
 * bytes of its encryption: one when the encryption takes no more than a
 * part.
 */
export const partCountOf = (byteSize: number, partSize: number): number =>
  Math.ceil(encryptedSizeOf(byteSize) / partSize);

/** One part of the encrypted file, numbered from 1 as Snap numbers them. */
export interface EncryptedPart {
  readonly bytes: Uint8Array;
  readonly number: number;
}

// Where the encryption stands: the next part's index and its IV.
interface Chain {
  readonly index: number;
  readonly iv: Uint8Array;
}

type Step =
  | { readonly _tag: "part"; readonly part: EncryptedPart }
  | { readonly _tag: "end"; readonly chain: Chain };

/**
 * The parts of a file of `byteSize` bytes, encrypted as Snap asks: the
 * encryption cut every `partSize` bytes (a whole number of blocks; Snap's
 * 32 MiB in production, a few blocks in tests), one part of the file and
 * its ciphertext held at a time. A stream that disagrees with the size
 * declared (a part short before the last, bytes after it) fails with
 * `PlatformUnavailable` before the last part is answered, so the upload is
 * never finalized: a later attempt reads the file again.
 */
export const encryptedParts =
  (options: {
    readonly byteSize: number;
    readonly iv: Uint8Array;
    readonly key: Uint8Array;
    readonly partSize: number;
  }) =>
  <E, R>(
    stream: Stream.Stream<Uint8Array, E, R>
  ): Stream.Stream<
    EncryptedPart,
    E | PlatformUnavailable,
    R | Cipher.Cipher
  > => {
    const { byteSize, partSize } = options;
    const count = partCountOf(byteSize, partSize);

    // The bytes of the file each part holds; the last may hold none, its
    // ciphertext then being the padding alone.
    const sizeOf = (index: number) =>
      Math.min(partSize, byteSize - index * partSize);

    return Stream.unwrap(
      Effect.gen(function* encrypting() {
        const cipher = yield* Cipher.Cipher;

        const key = yield* Cipher.key(Cipher.aes256Cbc, options.key).pipe(
          Effect.orDie
        );

        const sealed = (chain: Chain, plain: Uint8Array) =>
          Effect.gen(function* sealing() {
            const last = chain.index === count - 1;

            const whole = yield* cipher
              .encrypt(key, plain, { iv: chain.iv })
              .pipe(Effect.orDie);

            const bytes = last ? whole : whole.subarray(0, partSize);

            const next: Chain = {
              index: chain.index + 1,
              iv: bytes.slice(bytes.length - block),
            };

            const part: EncryptedPart = { bytes, number: chain.index + 1 };

            return [next, part] as const;
          });

        const encrypt = (
          chain: Chain,
          plain: Uint8Array
        ): Effect.Effect<
          readonly [Chain, readonly Step[]],
          PlatformUnavailable
        > =>
          Effect.gen(function* encryptingPart() {
            // Bytes after the last part, or a part shorter than declared.
            if (chain.index >= count || plain.length !== sizeOf(chain.index)) {
              return yield* new PlatformUnavailable();
            }

            const [next, part] = yield* sealed(chain, plain);
            const step: Step = { _tag: "part", part };

            return [next, [step]] as const;
          });

        // The stream ended: every part was sent, or only a last part of no
        // bytes of the file is left, its padding block.
        const ended = (chain: Chain) => {
          if (chain.index === count) {
            return Stream.empty;
          }

          return chain.index === count - 1 && sizeOf(chain.index) === 0
            ? Stream.fromEffect(
                sealed(chain, new Uint8Array()).pipe(
                  Effect.map(([, part]) => part)
                )
              )
            : Stream.fail(new PlatformUnavailable());
        };

        return stream.pipe(
          inParts(sizeOf),
          Stream.mapAccumEffect(
            (): Chain => ({ index: 0, iv: options.iv }),
            encrypt,
            { onHalt: (chain): readonly Step[] => [{ _tag: "end", chain }] }
          ),
          Stream.flatMap((step) =>
            step._tag === "part" ? Stream.make(step.part) : ended(step.chain)
          )
        );
      })
    );
  };
