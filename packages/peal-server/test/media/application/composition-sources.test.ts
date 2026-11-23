import { assert, layer } from "@effect/vitest";
import { Duration, Effect, Layer, Option } from "effect";

import { GeneratedMedia } from "#media/application/generated-media.ts";
import { DrizzleMediaAssetsLive } from "#media/infrastructure/drizzle-media-assets.ts";
import { S3MediaStorageLive } from "#media/infrastructure/s3-media-storage.ts";
import { Ids } from "#shared/application/ids.ts";
import { MediaAssetIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { UnmeteredTest } from "#test/billing/support.ts";
import {
  DatabaseTest,
  fetchBytes,
  hasFfmpeg,
  mediaTestWith,
  storageSettings,
  syntheticVideo,
} from "#test/media/support.ts";

// What a slide video hands its service: a ready file described, and a
// presigned link to it that stops working, whether or not the bucket is
// served publicly; and the video it gets back, kept as it came, not marked
// as made by AI.

const sources = Layer.mergeAll(
  mediaTestWith(UnmeteredTest),
  S3MediaStorageLive,
  DrizzleMediaAssetsLive
).pipe(Layer.provideMerge(DatabaseTest), Layer.provide(storageSettings));

const freshWorkspace = Ids.use((ids) => ids.next).pipe(
  Effect.map((uuid) => WorkspaceIdSchema.make(uuid))
);

layer(sources, { timeout: "60 seconds" })("a composition's files", (it) => {
  it.effect.skipIf(!hasFfmpeg)(
    "describes a ready file and links to it for an hour, the video kept unmarked",
    () =>
      Effect.gen(function* links() {
        const workspaceId = yield* freshWorkspace;
        const video = syntheticVideo();
        const media = yield* GeneratedMedia;

        const stored = yield* media.storeVideo(workspaceId, video, {
          aiGenerated: false,
        });

        assert.isFalse(stored.asset.aiGenerated);

        const described = yield* media.describeSource(
          workspaceId,
          stored.asset.id
        );

        assert.isTrue(Option.isSome(described));
        assert.strictEqual(Option.getOrThrow(described).kind, "video");
        assert.isTrue(
          Option.isSome(Option.getOrThrow(described).durationSeconds)
        );

        const link = yield* media.sourceLink(
          workspaceId,
          stored.asset.id,
          Duration.hours(1)
        );

        const signed = new URL(Option.getOrThrow(link));

        assert.strictEqual(signed.searchParams.get("X-Amz-Expires"), "3600");

        const { bytes, response } = yield* fetchBytes(signed.toString());

        assert.strictEqual(response.status, 200);
        assert.deepStrictEqual(bytes, video);

        // Another workspace's file is none of this one's.
        const elsewhere = yield* media.sourceLink(
          yield* freshWorkspace,
          stored.asset.id,
          Duration.hours(1)
        );

        assert.isTrue(Option.isNone(elsewhere));
      })
  );

  it.effect("links to nothing that is not a ready file of the workspace", () =>
    Effect.gen(function* none() {
      const media = yield* GeneratedMedia;
      const workspaceId = yield* freshWorkspace;

      const missing = MediaAssetIdSchema.make(
        "019a0000-0000-7000-8000-00000000dead"
      );

      assert.isTrue(
        Option.isNone(yield* media.describeSource(workspaceId, missing))
      );
      assert.isTrue(
        Option.isNone(
          yield* media.sourceLink(workspaceId, missing, Duration.hours(1))
        )
      );
    })
  );
});
