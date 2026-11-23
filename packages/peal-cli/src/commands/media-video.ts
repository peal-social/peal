import { Console, Duration, Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  ImageAspectSchema,
  maxVideoDurationSeconds,
  maxVideoPromptLength,
  VideoGenerationSchema,
  VideoGenerationsSchema,
  videosPerDay,
} from "peal-contract";
import type { VideoFailureReason, VideoGeneration } from "peal-contract";

import { explain } from "#explain.ts";
import { jsonFlag, printJson } from "#json.ts";
import { Refused } from "#refused.ts";
import { inWorkspace, workspaceFlag } from "#workspace.ts";

/** How long `--wait` waits between two reads of the video's state. */
export const videoPollInterval = Duration.seconds(5);

/**
 * How long `--wait` waits in all: a video takes minutes, and Peal gives a
 * provider 15 of them, after its turn in the queue.
 */
export const videoWaitBound = Duration.minutes(30);

// Why a video failed, as the user reads it.
const reasons: Readonly<Record<VideoFailureReason, string>> = {
  addressRefused: "the provider's address is not one Peal sends to",
  imageUnavailable: "the first frame was deleted, or could not be read",
  interrupted:
    "the server stopped while it was made; Peal never asks for it again, as the provider may have made and billed it",
  keyUnreadable:
    "the provider's key can no longer be read: connect it again with peal assistant providers connect",
  notStored: "the media store failed to keep it",
  redirected: "the provider answered with a redirect, which Peal never follows",
  refused:
    "the provider refused this request (its content rules, or a setting the model does not take)",
  settingsRefused: "the provider refused the key, the account or the model",
  storageFull: "the plan's media storage had no room for it",
  timedOut: "it took longer than Peal waits",
  unavailable: "no provider is chosen for videos any more",
  unreachable: "the provider could not be reached, or was busy",
  unusableAnswer:
    "the provider's answer held no video Peal keeps, or one too large",
};

const ended = (generation: VideoGeneration) =>
  generation.status === "succeeded" || generation.status === "failed";

/** Where a video stands, in a line. */
export const videoLine = (generation: VideoGeneration): string =>
  ({
    failed: `Video ${generation.id} failed: ${generation.reason === null ? "no reason given" : reasons[generation.reason]}. Nothing was kept.`,
    queued: `Video ${generation.id} is queued: it waits its turn.`,
    running: `Video ${generation.id} is being made: it takes minutes.`,
    succeeded: `Video ${generation.id} is ready as media ${generation.mediaId ?? ""}, marked as made by AI: set the platform's AI label in the post's options where it has one.`,
  })[generation.status];

const generate = Command.make(
  "generate",
  {
    aspect: Flag.Literals("aspect", ImageAspectSchema.literals).pipe(
      Flag.withDescription(
        "The video's aspect: landscape (wider than tall), portrait (taller than wide) or square, where the provider makes it."
      ),
      Flag.withDefault("landscape" as const)
    ),
    duration: Flag.Int("duration").pipe(
      Flag.withMetavar("<seconds>"),
      Flag.withDescription(
        "How long the video lasts, within what the provider takes (xAI: 1 to 15 seconds; Gemini picks its own). Left out, the provider picks."
      ),
      Flag.optional
    ),
    image: Flag.String("image").pipe(
      Flag.withMetavar("<media-id>"),
      Flag.withDescription(
        "A ready image of the workspace's media to start the video from, as peal media list --kind image shows its id."
      ),
      Flag.optional
    ),
    json: jsonFlag,
    prompt: Flag.String("prompt").pipe(
      Flag.withMetavar("<text>"),
      Flag.withDescription(
        `What the video should show, 1 to ${String(maxVideoPromptLength)} characters: it is sent as it is to the provider the workspace chose for videos.`
      )
    ),
    wait: Flag.Boolean("wait").pipe(
      Flag.withDescription(
        "Wait until the video is ready or failed, reading its state every 5 seconds for up to 30 minutes, then say how it ended."
      ),
      Flag.withDefault(false)
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("media.video.generate")(function* generate(input) {
    // A length no provider takes is refused before a request leaves.
    yield* Option.exists(
      input.duration,
      (seconds) => seconds < 1 || seconds > maxVideoDurationSeconds
    )
      ? Effect.fail(
          new Refused({
            reason: `--duration takes 1 to ${String(maxVideoDurationSeconds)} seconds.`,
          })
        )
      : Effect.void;

    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const asked = yield* client.videoGenerations
      .create({
        params: { workspaceId: workspace.id },
        payload: {
          aspect: input.aspect,
          prompt: input.prompt,
          ...Option.match(input.duration, {
            onNone: () => ({}),
            onSome: (durationSeconds) => ({ durationSeconds }),
          }),
          ...Option.match(input.image, {
            onNone: () => ({}),
            onSome: (imageMediaId) => ({ imageMediaId }),
          }),
        },
      })
      .pipe(Effect.mapError(explain(url)));

    if (!input.wait) {
      yield* input.json
        ? printJson(VideoGenerationSchema, asked)
        : Console.log(
            `Asked for video ${asked.id} in ${workspace.name}: it takes minutes. peal media video status ${asked.id} says where it stands; you are told in the app once it ends.`
          );

      return;
    }

    if (!input.json) {
      yield* Console.log(
        `Asked for video ${asked.id} in ${workspace.name}: waiting for it.`
      );
    }

    const read = client.videoGenerations
      .get({
        params: { generationId: asked.id, workspaceId: workspace.id },
      })
      .pipe(Effect.mapError(explain(url)));

    // Reads its state until it ends, or the wait's bound passes.
    const rounds = Math.ceil(
      Duration.toMillis(videoWaitBound) / Duration.toMillis(videoPollInterval)
    );

    let last = asked;

    for (let round = 0; round < rounds && !ended(last); round += 1) {
      yield* Effect.sleep(videoPollInterval);
      last = yield* read;
    }

    // A video that failed ends as a refusal, which says why.
    yield* last.status === "failed"
      ? Effect.fail(
          new Refused({ code: "video_failed", reason: videoLine(last) })
        )
      : Effect.void;

    yield* input.json
      ? printJson(VideoGenerationSchema, last)
      : Console.log(
          ended(last)
            ? videoLine(last)
            : `${videoLine(last)} Peal stopped waiting; peal media video status ${last.id} says where it stands later.`
        );
  })
).pipe(
  Command.withDescription(
    `Have the provider the workspace chose for videos make one into the workspace's media, marked as made by AI. It takes minutes: without --wait the command answers at once with the video's id. The workspace's own key pays the provider; Peal bills nothing for it. One video at a time a workspace, ${String(videosPerDay)} a day.`
  )
);

const status = Command.make(
  "status",
  {
    generationId: Argument.String("video-id").pipe(
      Argument.withDescription(
        "The video, as peal media video generate printed its id."
      )
    ),
    json: jsonFlag,
    workspace: workspaceFlag,
  },
  Effect.fn("media.video.status")(function* status(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const found = yield* client.videoGenerations
      .get({
        params: {
          generationId: input.generationId,
          workspaceId: workspace.id,
        },
      })
      .pipe(Effect.mapError(explain(url)));

    yield* input.json
      ? printJson(VideoGenerationSchema, found)
      : Console.log(videoLine(found));
  })
).pipe(
  Command.withDescription(
    "Say where a video stands: queued, being made, ready with its media id, or failed with why."
  )
);

const list = Command.make(
  "list",
  { json: jsonFlag, workspace: workspaceFlag },
  Effect.fn("media.video.list")(function* list(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const found = yield* client.videoGenerations
      .list({ params: { workspaceId: workspace.id }, query: {} })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(VideoGenerationsSchema, found);

      return;
    }

    if (found.generations.length === 0) {
      yield* Console.log(`${workspace.name} asked for no video yet.`);

      return;
    }

    for (const generation of found.generations) {
      yield* Console.log(videoLine(generation));
    }
  })
).pipe(
  Command.withDescription(
    "List the videos the workspace asked for, newest first, with where each stands."
  )
);

export const video = Command.make("video").pipe(
  Command.withDescription(
    "Videos the provider the workspace chose for videos makes into its media: asking for one, and following it."
  ),
  Command.withSubcommands([generate, status, list])
);
