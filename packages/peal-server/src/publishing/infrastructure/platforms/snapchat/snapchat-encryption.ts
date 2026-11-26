import { Effect, Stream } from "effect";
import { Cipher } from "effect/crypto";

import { inParts } from "#publishing/infrastructure/platforms/byte-parts.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";

// Snap's Profile Asset Management page (developers.snap.com, Public Profile
// API, read 2026-11-26): "Encrypt the media file" with AES-256-CBC, a random
// 32-byte key and 16-byte IV (`openssl enc -aes-256-cbc -nosalt`: plain CBC,
// PKCS#7 padding, no salt header), then "If the file is larger than 32MB
// then split it" into "chunks of upto 32 MB", "Can be between 1 to 35"
// parts, for "A file of upto 1 GB". Read as: the whole file is encrypted,
// then the ciphertext is cut (unverified: the page's samples disagree).
//
// Peal never holds a file whole, so it encrypts part by part, which CBC
// allows: each block is chained to the ciphertext block before it. A part
// that is not the last is a whole number of blocks; its ciphertext is the
// first `partSize` bytes of what `encrypt` answers (the block after them is
// the padding of an input that was already whole), and the next part's IV
// is its last block. The last part keeps its padding. The parts joined are
// byte for byte what one `encrypt` of the whole file answers.

const block = 16;

const mebibyte = 1024 * 1024;

/** The smallest part, in bytes of the file: X's appends' 4 MiB. */
export const minPartSize = 4 * mebibyte;

/** The most parts Snap takes for one file. */
export const maxParts = 35;

const ceilToBlock = (bytes: number) => Math.ceil(bytes / block) * block;

/**
 * The size of each part but the last, in bytes of the file: 4 MiB up to a
 * file of 140 MiB, then what keeps the file within 35 parts, always a whole
 * number of blocks. A file of 1,000,000,000 bytes goes in 35 parts of
 * 28,571,440, under 32 MB with the last part's padding in either reading of
 * "MB".
 */
export const partSizeOf = (byteSize: number): number =>
  Math.max(minPartSize, ceilToBlock(Math.ceil(byteSize / maxParts)));

/** How many parts a file of `byteSize` bytes goes in. */
export const partCountOf = (byteSize: number, partSize: number): number =>
  Math.ceil(byteSize / partSize);

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
  | { readonly _tag: "end"; readonly parts: number };

/**
 * The parts of a file of `byteSize` bytes, encrypted as Snap asks: each part
 * of `partSize` bytes of the file (a whole number of blocks) and the last
 * with what is left, one held at a time. A stream that disagrees with the
 * size declared (a part short before the last, bytes after it) fails with
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

    const sizeOf = (index: number) =>
      Math.min(partSize, byteSize - index * partSize);

    return Stream.unwrap(
      Effect.gen(function* encrypting() {
        const cipher = yield* Cipher.Cipher;

        const key = yield* Cipher.key(Cipher.aes256Cbc, options.key).pipe(
          Effect.orDie
        );

        const encrypt = (
          chain: Chain,
          plain: Uint8Array
        ): Effect.Effect<
          readonly [Chain, readonly Step[]],
          PlatformUnavailable
        > =>
          Effect.gen(function* encryptingPart() {
            const { index } = chain;
            const last = index === count - 1;

            // Bytes after the last part, or a part shorter than declared.
            if (index >= count || plain.length !== sizeOf(index)) {
              return yield* new PlatformUnavailable();
            }

            const sealed = yield* cipher
              .encrypt(key, plain, { iv: chain.iv })
              .pipe(Effect.orDie);

            const bytes = last ? sealed : sealed.slice(0, partSize);

            const next: Chain = {
              index: index + 1,
              iv: bytes.slice(bytes.length - block),
            };

            const step: Step = {
              _tag: "part",
              part: { bytes, number: index + 1 },
            };

            return [next, [step]] as const;
          });

        return stream.pipe(
          inParts(sizeOf),
          Stream.mapAccumEffect(
            (): Chain => ({ index: 0, iv: options.iv }),
            encrypt,
            {
              onHalt: ({ index }): readonly Step[] => [
                { _tag: "end", parts: index },
              ],
            }
          ),
          Stream.flatMap((step) => {
            if (step._tag === "part") {
              return Stream.make(step.part);
            }

            // The stream ended before the last part.
            return step.parts === count
              ? Stream.empty
              : Stream.fail(new PlatformUnavailable());
          })
        );
      })
    );
  };
