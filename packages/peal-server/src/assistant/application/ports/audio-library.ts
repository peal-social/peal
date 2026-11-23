import { Context } from "effect";
import type { DateTime, Effect } from "effect";

import type { AudioFailed } from "#assistant/application/audio-failed.ts";
import type { AudioMediaNotFound } from "#assistant/application/audio-media-not-found.ts";
import type { AudioNotStored } from "#assistant/application/audio-not-stored.ts";
import type { AudioNotTranscribable } from "#assistant/application/audio-not-transcribable.ts";
import type { Actor } from "#shared/domain/access.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";
import type { PlanLimitReached } from "#shared/domain/plan-limit-reached.ts";

/**
 * A voice-over the assistant made, as the media library keeps it: ready,
 * marked as made by AI, without a description.
 */
export interface GeneratedAudio {
  readonly aiGenerated: true;
  readonly altText: null;
  readonly byteSize: number;
  readonly codec: string | null;
  readonly contentType: "audio/mp4" | "audio/mpeg" | "audio/wav";
  readonly createdAt: DateTime.Utc;
  readonly dimensions: null;
  readonly durationMs: number | null;
  /** A file the assistant made was never called anything. */
  readonly fileName: null;
  readonly id: string;
  readonly kind: "audio";
  readonly pageCount: null;
  readonly status: { readonly _tag: "ready" };
  readonly updatedAt: DateTime.Utc;
  /** Where the file can be read for a while. */
  readonly url: string | null;
}

/**
 * The media library of the actor's workspace, for audio: where
 * voice-overs are kept, where files to transcribe are read, and where a
 * transcript becomes a description. Each checks the library's own
 * permission (media:upload to keep and describe, media:read to read).
 */
export class AudioLibrary extends Context.Service<
  AudioLibrary,
  {
    /** Fails when the storage has no room for the largest voice-over. */
    readonly roomFor: (
      actor: Actor
    ) => Effect.Effect<void, MissingPermission | PlanLimitReached>;
    /**
     * Keeps the bytes as they came. Bytes that are no audio the library
     * takes fail with `AudioFailed` `unusableAnswer`, and nothing of them
     * is kept.
     */
    readonly store: (
      actor: Actor,
      bytes: Uint8Array
    ) => Effect.Effect<
      GeneratedAudio,
      AudioFailed | AudioNotStored | MissingPermission | PlanLimitReached
    >;
    /** A ready audio or video file's bytes, at most `maxBytes`. */
    readonly read: (
      actor: Actor,
      mediaId: string,
      maxBytes: number
    ) => Effect.Effect<
      Uint8Array,
      | AudioMediaNotFound
      | AudioNotStored
      | AudioNotTranscribable
      | MissingPermission
    >;
    /**
     * Makes the text the file's description: false when it is longer
     * than a description may be, and nothing changed.
     */
    readonly describe: (
      actor: Actor,
      mediaId: string,
      text: string
    ) => Effect.Effect<
      boolean,
      AudioMediaNotFound | AudioNotStored | MissingPermission
    >;
  }
>()("peal-server/assistant/application/AudioLibrary") {}
