import { Context } from "effect";
import type { Effect, Option } from "effect";

import type { AudioCapability } from "#assistant/domain/audio-use.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import type { LocalDate } from "#shared/domain/wall-clock.ts";

/**
 * How many voice-overs and transcripts each workspace asked its own
 * providers for each UTC day: a bound, not a price, which nobody reads
 * but the assistant. A database failure is a defect.
 */
export class OwnAudioCounts extends Context.Service<
  OwnAudioCounts,
  {
    /**
     * Counts one for the day and use, in one conditional upsert, unless
     * the day already holds `dailyLimit`: the day's count, or none.
     */
    readonly claim: (
      workspaceId: WorkspaceId,
      capability: AudioCapability,
      day: LocalDate,
      dailyLimit: number
    ) => Effect.Effect<Option.Option<number>>;
    /** How many the day holds for the use. */
    readonly countOn: (
      workspaceId: WorkspaceId,
      capability: AudioCapability,
      day: LocalDate
    ) => Effect.Effect<number>;
  }
>()("peal-server/assistant/application/OwnAudioCounts") {}
