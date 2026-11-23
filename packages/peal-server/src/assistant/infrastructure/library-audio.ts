import { Duration, Effect, Layer, Option, Schema } from "effect";

import { AudioFailed } from "#assistant/application/audio-failed.ts";
import { AudioMediaNotFound } from "#assistant/application/audio-media-not-found.ts";
import { AudioNotStored } from "#assistant/application/audio-not-stored.ts";
import { AudioNotTranscribable } from "#assistant/application/audio-not-transcribable.ts";
import { AudioLibrary } from "#assistant/application/ports/audio-library.ts";
import type { GeneratedAudio } from "#assistant/application/ports/audio-library.ts";
import { maxVoiceoverBytes } from "#assistant/domain/audio-limits.ts";
import { MediaLibrary } from "#media/application/media-library.ts";
import type { MediaStorageFailed } from "#media/application/media-storage-failed.ts";
import type { MediaItem } from "#media/application/use-cases/view-media.ts";
import { MediaAssetIdSchema } from "#shared/domain/ids.ts";
import type { MediaAssetId } from "#shared/domain/ids.ts";

const decodeAssetId = Schema.decodeUnknownOption(MediaAssetIdSchema);

// The asset a media id names, or none for one that is no id.
const assetIdOf = (
  mediaId: string
): Effect.Effect<MediaAssetId, AudioMediaNotFound> =>
  Option.match(decodeAssetId(mediaId), {
    onNone: () => Effect.fail(new AudioMediaNotFound()),
    onSome: Effect.succeed,
  });

const unusable = () =>
  new AudioFailed({ capability: "speech", reason: "unusableAnswer" });

// Why, for whoever runs the server: the failure names the store, never
// the file.
const storeFailed = (failure: MediaStorageFailed) =>
  Effect.logWarning("The media store failed", failure).pipe(
    Effect.andThen(Effect.fail(new AudioNotStored()))
  );

// The library's asset as the assistant answers it: the media context
// stores only audio here, and answers only ready files.
const generatedAudioOf = (
  item: MediaItem
): Effect.Effect<GeneratedAudio, AudioFailed> => {
  const { asset } = item;
  const { contentType } = asset;

  if (
    asset.status._tag !== "ready" ||
    !asset.aiGenerated ||
    (contentType !== "audio/mp4" &&
      contentType !== "audio/mpeg" &&
      contentType !== "audio/wav")
  ) {
    return Effect.fail(unusable());
  }

  return Effect.succeed({
    aiGenerated: true,
    altText: null,
    byteSize: asset.byteSize,
    codec: Option.getOrNull(asset.metadata.codec),
    contentType,
    createdAt: asset.createdAt,
    dimensions: null,
    durationMs: asset.metadata.duration.pipe(
      Option.map(Duration.toMillis),
      Option.getOrNull
    ),
    fileName: null,
    id: asset.id,
    kind: "audio",
    pageCount: null,
    status: { _tag: "ready" },
    updatedAt: asset.updatedAt,
    url: Option.getOrNull(item.url),
  });
};

/**
 * AudioLibrary in the media context's library (`MediaLibrary`, which
 * checks its own permissions): a voice-over arrives as an image the
 * assistant made does (`storeGeneratedAudio`), a file to transcribe is
 * read whole (`readMedia`, audio and video alone), and a transcript
 * becomes a description as a member's would (`describeMedia`). The
 * composition root provides the media context's MediaLibrary.
 */
export const LibraryAudioLive = Layer.effect(
  AudioLibrary,
  Effect.gen(function* LibraryAudioLive() {
    const library = yield* MediaLibrary;

    return AudioLibrary.of({
      describe: (actor, mediaId, text) =>
        assetIdOf(mediaId).pipe(
          Effect.flatMap((assetId) =>
            library.describeMedia(actor, assetId, Option.some(text))
          ),
          Effect.as(true),
          Effect.catchTags({
            // Longer than a description may be: the transcript is still
            // answered.
            AltTextTooLong: () => Effect.succeed(false),
            MediaAssetNotFound: () => Effect.fail(new AudioMediaNotFound()),
            MediaStorageFailed: storeFailed,
          })
        ),
      read: (actor, mediaId, maxBytes) =>
        assetIdOf(mediaId).pipe(
          Effect.flatMap((assetId) =>
            library.readMedia(actor, {
              assetId,
              kinds: ["audio", "video"],
              maxBytes,
            })
          ),
          Effect.map(({ bytes }) => bytes),
          Effect.catchTags({
            MediaAssetNotFound: () => Effect.fail(new AudioMediaNotFound()),
            MediaNotReadable: ({ reason }) =>
              Effect.fail(
                new AudioNotTranscribable({
                  reason: reason === "wrongKind" ? "notAudio" : reason,
                })
              ),
            MediaStorageFailed: storeFailed,
          })
        ),
      roomFor: (actor) => library.roomForAudio(actor, maxVoiceoverBytes),
      store: (actor, bytes) =>
        library.storeGeneratedAudio(actor, bytes).pipe(
          Effect.catchTags({
            GeneratedAudioUnusable: () => Effect.fail(unusable()),
            MediaStorageFailed: storeFailed,
          }),
          Effect.flatMap(generatedAudioOf)
        ),
    });
  })
);
