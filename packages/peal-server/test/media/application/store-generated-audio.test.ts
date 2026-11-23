import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { assert, layer } from "@effect/vitest";
import { Duration, Effect, Layer, Option } from "effect";

import { MediaLibrary } from "#media/container.ts";
import { DrizzleMediaAssetsLive } from "#media/infrastructure/drizzle-media-assets.ts";
import { S3MediaStorageLive } from "#media/infrastructure/s3-media-storage.ts";
import { Ids } from "#shared/application/ids.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { UnmeteredTest } from "#test/billing/support.ts";
import {
  DatabaseTest,
  hasFfmpeg,
  mediaTestWith,
  memberIn,
  storageSettings,
  syntheticVideo,
} from "#test/media/support.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// A voice-over the assistant made arrives whole on the server: stored as
// it came, marked, probed by ffprobe; a file to transcribe is read whole,
// audio and video alone.

const generating = Layer.mergeAll(
  mediaTestWith(UnmeteredTest),
  S3MediaStorageLive,
  DrizzleMediaAssetsLive
).pipe(Layer.provideMerge(DatabaseTest), Layer.provide(storageSettings));

const freshWorkspace = Ids.use((ids) => ids.next).pipe(
  Effect.map((uuid) => WorkspaceIdSchema.make(uuid))
);

// One second of a tone, as WAV, which every FFmpeg build writes.
const syntheticWav = (): Uint8Array<ArrayBuffer> => {
  const folder = mkdtempSync(path.join(os.tmpdir(), "peal-audio-"));
  const file = path.join(folder, "tone.wav");

  try {
    execFileSync(
      "ffmpeg",
      [
        "-v",
        "error",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440",
        "-t",
        "1",
        file,
      ],
      { stdio: "ignore" }
    );

    return new Uint8Array(readFileSync(file));
  } finally {
    rmSync(folder, { force: true, recursive: true });
  }
};

layer(generating, { timeout: "60 seconds" })("audio in the library", (it) => {
  it.effect.skipIf(!hasFfmpeg)(
    "keeps a voice-over untouched, marked, and probed",
    () =>
      Effect.gen(function* stores() {
        const workspaceId = yield* freshWorkspace;
        const wav = syntheticWav();

        const stored = yield* MediaLibrary.use((library) =>
          library.storeGeneratedAudio(memberIn(workspaceId), wav)
        );

        assert.strictEqual(stored.asset.status._tag, "ready");
        assert.strictEqual(stored.asset.kind, "audio");
        assert.strictEqual(stored.asset.contentType, "audio/wav");
        assert.isTrue(stored.asset.aiGenerated);
        assert.isTrue(
          Option.exists(stored.asset.metadata.duration, (duration) =>
            Duration.isGreaterThan(duration, Duration.millis(900))
          )
        );

        const read = yield* MediaLibrary.use((library) =>
          library.readMedia(memberIn(workspaceId), {
            assetId: stored.asset.id,
            kinds: ["audio", "video"],
            maxBytes: 25_000_000,
          })
        );

        assert.deepStrictEqual(read.bytes, wav);

        const tooLarge = yield* MediaLibrary.use((library) =>
          library.readMedia(memberIn(workspaceId), {
            assetId: stored.asset.id,
            kinds: ["audio"],
            maxBytes: 16,
          })
        ).pipe(Effect.flip);

        assert.deepInclude(tooLarge, {
          _tag: "MediaNotReadable",
          reason: "tooLarge",
        });
      })
  );

  it.effect.skipIf(!hasFfmpeg)(
    "takes no video for a voice-over, and nothing from a viewer",
    () =>
      Effect.gen(function* refuses() {
        const workspaceId = yield* freshWorkspace;

        const video = yield* MediaLibrary.use((library) =>
          library.storeGeneratedAudio(memberIn(workspaceId), syntheticVideo())
        ).pipe(Effect.flip);

        const viewer = yield* MediaLibrary.use((library) =>
          library.storeGeneratedAudio(
            memberIn(workspaceId, permissionsFor("viewer")),
            syntheticWav()
          )
        ).pipe(Effect.flip);

        assert.strictEqual(video._tag, "GeneratedAudioUnusable");
        assert.strictEqual(viewer._tag, "MissingPermission");
      })
  );
});
