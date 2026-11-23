import { Console, Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  maxTranscriptionBytes,
  maxVoiceoverTextLength,
  MediaSchema,
  TranscriptSchema,
  transcriptionsPerDay,
  voiceoversPerDay,
} from "peal-contract";

import { explain } from "#explain.ts";
import { jsonFlag, printJson } from "#json.ts";
import { inWorkspace, workspaceFlag } from "#workspace.ts";

/** `peal media voiceover`: a voice-over from a text, into the media. */
export const voiceover = Command.make(
  "voiceover",
  {
    json: jsonFlag,
    text: Flag.String("text").pipe(
      Flag.withMetavar("<text>"),
      Flag.withDescription(
        `What is said, 1 to ${String(maxVoiceoverTextLength)} characters: it is sent as it is to the provider the workspace chose for voice-overs.`
      )
    ),
    voice: Flag.String("voice").pipe(
      Flag.withMetavar("<voice>"),
      Flag.withDescription(
        "The voice that speaks, as the provider names it (OpenAI: alloy, nova…; ElevenLabs: a voice's id). Left out, the provider's default."
      ),
      Flag.optional
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("media.voiceover")(function* voiceover(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const made = yield* client.mediaAudio
      .createVoiceover({
        params: { workspaceId: workspace.id },
        payload: {
          text: input.text,
          ...Option.match(input.voice, {
            onNone: () => ({}),
            onSome: (voice) => ({ voice }),
          }),
        },
      })
      .pipe(Effect.mapError(explain(url)));

    yield* input.json
      ? printJson(MediaSchema, made)
      : Console.log(
          `Made a voice-over into ${workspace.name}'s media: ${made.id}, marked as made by AI. Platforms take no audio file on its own: use it in a video you make.`
        );
  })
).pipe(
  Command.withDescription(
    `Have the provider the workspace chose for voice-overs speak a text, and keep the audio in the workspace's media, marked as made by AI. The workspace's own key pays the provider; Peal bills nothing for it. ${String(voiceoversPerDay)} a day.`
  )
);

/** `peal media transcribe`: what is said in an audio or video file. */
export const transcribe = Command.make(
  "transcribe",
  {
    json: jsonFlag,
    mediaId: Argument.String("media-id").pipe(
      Argument.withDescription(
        "A ready audio or video file of the workspace's media, as peal media list shows its id."
      )
    ),
    saveDescription: Flag.Boolean("save-description").pipe(
      Flag.withDescription(
        "Save the transcript as the file's description (its alt text) when it is short enough for one."
      ),
      Flag.withDefault(false)
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("media.transcribe")(function* transcribe(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const transcript = yield* client.mediaAudio
      .transcribe({
        params: { mediaId: input.mediaId, workspaceId: workspace.id },
        payload: { saveAsDescription: input.saveDescription },
      })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(TranscriptSchema, transcript);

      return;
    }

    yield* Console.log(transcript.text);

    if (input.saveDescription) {
      yield* Console.log(
        transcript.descriptionSaved
          ? `Saved as the description of media ${input.mediaId}.`
          : `Not saved as the description of media ${input.mediaId}: it is longer than a description may be.`
      );
    }
  })
).pipe(
  Command.withDescription(
    `Have the provider the workspace chose for transcripts write what is said in an audio or video file of the media, of at most ${String(maxTranscriptionBytes / 1_000_000)} MB, and print it. The workspace's own key pays the provider; Peal bills nothing for it. ${String(transcriptionsPerDay)} a day.`
  )
);
