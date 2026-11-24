import {
  Console,
  Duration,
  Effect,
  FileSystem,
  Option,
  Path,
  Schema,
} from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  defaultSecondsPerSlide,
  ImageAspectSchema,
  maxEditClips,
  maxEditSeconds,
  maxEditTracks,
  maxSecondsPerSlide,
  maxSlideCaptionLength,
  maxSlides,
  maxSlideshowSeconds,
  minSecondsPerSlide,
  minSlides,
  SlideMotionSchema,
  SlideshowSchema,
  SlideshowsSchema,
  SlideshowStatusSchema,
  slideshowsPerDay,
  SlideTransitionSchema,
} from "peal-contract";
import type {
  Slide,
  SlideMotion,
  Slideshow,
  SlideshowFailureReason,
} from "peal-contract";

import { explain } from "#explain.ts";
import { jsonFlag, printJson } from "#json.ts";
import { cannotRead } from "#media-files.ts";
import { Refused } from "#refused.ts";
import { inWorkspace, workspaceFlag } from "#workspace.ts";

/** How long `--wait` waits between two reads of the slide video's state. */
export const slideshowPollInterval = Duration.seconds(5);

/**
 * How long `--wait` waits in all: Peal gives the service 20 minutes, after
 * the video's turn in the queue.
 */
export const slideshowWaitBound = Duration.minutes(30);

// Why a slide video failed, as the user reads it.
const reasons: Readonly<Record<SlideshowFailureReason, string>> = {
  addressRefused: "the service's address is not one Peal sends to",
  interrupted:
    "the server stopped while it was composed; Peal never asks for it again, as the service may have rendered and billed it",
  keyUnreadable:
    "the service's key can no longer be read: connect it again with peal assistant providers connect",
  mediaUnavailable:
    "an image or the voice-over was deleted, or could not be handed to the service",
  notStored: "the media store failed to keep it",
  redirected: "the service answered with a redirect, which Peal never follows",
  refused: "the service refused this request, or failed to render it",
  settingsRefused:
    "the service refused the key or the account, as when it has no credits left",
  storageFull: "the plan's media storage had no room for it",
  timedOut: "it took longer than Peal waits",
  unavailable: "no service is chosen for slide videos any more",
  unreachable: "the service could not be reached, or was busy",
  unusableAnswer:
    "the service's answer held no video Peal keeps, or one too large",
};

const ended = (slideshow: Slideshow) =>
  slideshow.status === "succeeded" || slideshow.status === "failed";

/** Where a slide video stands, in a line. */
export const slideshowLine = (slideshow: Slideshow): string =>
  ({
    failed: `Slide video ${slideshow.id} failed: ${slideshow.reason === null ? "no reason given" : reasons[slideshow.reason]}. Nothing was kept.`,
    queued: `Slide video ${slideshow.id} is queued: it waits its turn.`,
    running: `Slide video ${slideshow.id} is being composed.`,
    succeeded: `Slide video ${slideshow.id} is ready as media ${slideshow.mediaId ?? ""}${slideshow.sandbox ? ", watermarked by the service's sandbox" : ""}.`,
  })[slideshow.status];

/** A slide as `slidesOf` fills it in, field by field. */
type SlideBeingMade = { -readonly [Key in keyof Slide]: Slide[Key] };

/**
 * The slides of `--image`, `--caption` and `--motion`, paired in the order
 * given: a caption or a motion left out (or a blank caption) is none, and
 * a single `--motion` moves every slide.
 */
export const slidesOf = ({
  captions,
  images,
  motions,
}: {
  readonly captions: readonly string[];
  readonly images: readonly string[];
  readonly motions: readonly SlideMotion[];
}): Slide[] =>
  images.map((mediaId, index) => {
    const caption = captions[index]?.trim() ?? "";
    const motion = motions.length === 1 ? motions[0] : motions[index];

    const slide: SlideBeingMade = { mediaId };

    if (caption !== "") {
      slide.caption = caption;
    }

    if (motion !== undefined) {
      slide.motion = motion;
    }

    return slide;
  });

// What the flags pair badly, refused before a request leaves.
const pairingRefusal = (
  images: number,
  captions: number,
  motions: number
): Option.Option<string> => {
  if (images < minSlides || images > maxSlides) {
    return Option.some(
      `Give ${String(minSlides)} to ${String(maxSlides)} images, one --image each.`
    );
  }

  if (captions > images) {
    return Option.some("Give at most one --caption per --image.");
  }

  return motions > 1 && motions !== images
    ? Option.some("Give one --motion for every slide, or a single one for all.")
    : Option.none();
};

type Workspace = Effect.Success<ReturnType<typeof inWorkspace>>;

/**
 * What follows asking for a video: its id at once, or with `wait` its
 * state read every `slideshowPollInterval` until it ends or the wait's
 * bound passes; one that failed ends as a refusal that says why.
 */
const followed = Effect.fn("media.slideshow.followed")(function* followed({
  asked,
  client,
  json,
  noun,
  url,
  wait,
  workspace,
}: Workspace & {
  readonly asked: Slideshow;
  readonly json: boolean;
  /** What the command calls what it asked for. */
  readonly noun: "slide video" | "video";
  readonly wait: boolean;
}) {
  if (!wait) {
    yield* json
      ? printJson(SlideshowSchema, asked)
      : Console.log(
          `Asked for ${noun} ${asked.id} in ${workspace.name}, ${String(asked.durationSeconds)} seconds long. peal media slideshow status ${asked.id} says where it stands; you are told in the app once it ends.`
        );

    return;
  }

  if (!json) {
    yield* Console.log(
      `Asked for ${noun} ${asked.id} in ${workspace.name}: waiting for it.`
    );
  }

  const read = client.slideshows
    .get({ headers: {}, params: { slideshowId: asked.id } })
    .pipe(Effect.mapError(explain(url)));

  const rounds = Math.ceil(
    Duration.toMillis(slideshowWaitBound) /
      Duration.toMillis(slideshowPollInterval)
  );

  let last = asked;

  for (let round = 0; round < rounds && !ended(last); round += 1) {
    yield* Effect.sleep(slideshowPollInterval);
    last = yield* read;
  }

  yield* last.status === "failed"
    ? Effect.fail(
        new Refused({ code: "slideshow_failed", reason: slideshowLine(last) })
      )
    : Effect.void;

  yield* json
    ? printJson(SlideshowSchema, last)
    : Console.log(
        ended(last)
          ? slideshowLine(last)
          : `${slideshowLine(last)} Peal stopped waiting; peal media slideshow status ${last.id} says where it stands later.`
      );
});

const waitFlag = Flag.Boolean("wait").pipe(
  Flag.withDescription(
    "Wait until the video is ready or failed, reading its state every 5 seconds for up to 30 minutes, then say how it ended."
  ),
  Flag.withDefault(false)
);

// The most a file of an edit may hold: the API takes 1 MiB a request.
const maxEditFileBytes = 1024 * 1024;

const parseEdit = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.JsonObject)
);

// The edit a file holds, read whole and never printed, as a file named by
// mistake holds anything.
const editIn = Effect.fn("media.slideshow.editIn")(function* editIn(
  given: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const file = path.resolve(given);

  const { size } = yield* fs
    .stat(file)
    .pipe(Effect.mapError(cannotRead(given)));

  if (Number(size) > maxEditFileBytes) {
    return yield* new Refused({
      reason: `${given} is larger than one request takes, 1 MiB. Nothing was asked.`,
    });
  }

  const text = yield* fs
    .readFileString(file)
    .pipe(Effect.mapError(cannotRead(given)));

  return yield* Option.match(parseEdit(text), {
    onNone: () =>
      Effect.fail(
        new Refused({
          reason: `${given} does not hold a JSON object: write a Shotstack Edit in it, its library files as peal:media/<media-id>. Nothing was asked.`,
        })
      ),
    onSome: Effect.succeed,
  });
});

const render = Command.make(
  "render",
  {
    edit: Argument.String("edit-file").pipe(
      Argument.withDescription(
        "A JSON file holding a Shotstack Edit (https://shotstack.io/docs/api/#tocs_edit): its timeline and output, each file of the workspace's media named peal:media/<media-id>, as peal media list shows its id."
      )
    ),
    json: jsonFlag,
    wait: waitFlag,
    workspace: workspaceFlag,
  },
  Effect.fn("media.slideshow.render")(function* render(input) {
    const edit = yield* editIn(input.edit);
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const asked = yield* client.slideshows
      .createFromEdit({
        headers: {},
        payload: { edit },
      })
      .pipe(Effect.mapError(explain(url)));

    yield* followed({ ...input, asked, client, url, workspace, noun: "video" });
  })
).pipe(
  Command.withDescription(
    `Have the workspace's Shotstack account render a whole Shotstack Edit from a JSON file, as the web app's editor makes, into an MP4 in its media: any tracks of its pictures, videos, sounds and texts, up to ${String(maxEditSeconds)} seconds, ${String(maxEditTracks)} tracks and ${String(maxEditClips)} clips, MP4 at 1080p at most in 16:9, 9:16 or 1:1. Without --wait the command answers at once with the video's id. The workspace's Shotstack account pays; on a server that bills, the workspace's billing account needs a payment method. One video at a time a workspace, slide videos included, ${String(slideshowsPerDay)} a day.`
  )
);

const create = Command.make(
  "create",
  {
    aspect: Flag.Literals("aspect", ImageAspectSchema.literals).pipe(
      Flag.withDescription(
        "The video's aspect: landscape (16:9), portrait (9:16) or square (1:1), each at 1080 pixels on its short side."
      ),
      Flag.withDefault("portrait" as const)
    ),
    captions: Flag.String("caption").pipe(
      Flag.withMetavar("<text>"),
      Flag.withDescription(
        `A line shown at the bottom of a slide, up to ${String(maxSlideCaptionLength)} characters: the first --caption goes with the first --image, and so on. Give "" for a slide without one.`
      ),
      Flag.atLeast(0)
    ),
    images: Flag.String("image").pipe(
      Flag.withMetavar("<media-id>"),
      Flag.withDescription(
        `A ready JPEG or PNG image of the workspace's media, as peal media list --kind image shows its id: ${String(minSlides)} to ${String(maxSlides)} of them, in the order they show.`
      ),
      Flag.atLeast(0)
    ),
    json: jsonFlag,
    motions: Flag.Literals("motion", SlideMotionSchema.literals).pipe(
      Flag.withDescription(
        "How a slide moves: none, zoomIn, zoomOut or slide (a slow pan). One for every slide in order, or a single one for all; left out, none."
      ),
      Flag.atLeast(0)
    ),
    seconds: Flag.Int("seconds").pipe(
      Flag.withMetavar("<seconds>"),
      Flag.withDescription(
        `How long each slide shows, ${String(minSecondsPerSlide)} to ${String(maxSecondsPerSlide)} seconds, ${String(maxSlideshowSeconds)} in all. Left out, the voice-over's length shared between the slides, or ${String(defaultSecondsPerSlide)} seconds without one.`
      ),
      Flag.optional
    ),
    transition: Flag.Literals(
      "transition",
      SlideTransitionSchema.literals
    ).pipe(
      Flag.withDescription(
        "How one slide gives way to the next: fade or none."
      ),
      Flag.withDefault("fade" as const)
    ),
    voiceover: Flag.String("voiceover").pipe(
      Flag.withMetavar("<media-id>"),
      Flag.withDescription(
        "A ready audio file of the workspace's media to play under the slides, as peal media voiceover printed its id."
      ),
      Flag.optional
    ),
    wait: waitFlag,
    workspace: workspaceFlag,
  },
  Effect.fn("media.slideshow.create")(function* create(input) {
    const refusal = pairingRefusal(
      input.images.length,
      input.captions.length,
      input.motions.length
    );

    yield* Option.match(refusal, {
      onNone: () => Effect.void,
      onSome: (reason) => Effect.fail(new Refused({ reason })),
    });

    // A length no slide takes is refused before a request leaves.
    yield* Option.exists(
      input.seconds,
      (seconds) => seconds < minSecondsPerSlide || seconds > maxSecondsPerSlide
    )
      ? Effect.fail(
          new Refused({
            reason: `--seconds takes ${String(minSecondsPerSlide)} to ${String(maxSecondsPerSlide)} seconds.`,
          })
        )
      : Effect.void;

    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const asked = yield* client.slideshows
      .create({
        headers: {},
        payload: {
          aspect: input.aspect,
          slides: slidesOf(input),
          transition: input.transition,
          ...Option.match(input.seconds, {
            onNone: () => ({}),
            onSome: (secondsPerSlide) => ({ secondsPerSlide }),
          }),
          ...Option.match(input.voiceover, {
            onNone: () => ({}),
            onSome: (voiceoverMediaId) => ({ voiceoverMediaId }),
          }),
        },
      })
      .pipe(Effect.mapError(explain(url)));

    yield* followed({
      ...input,
      asked,
      client,
      url,
      workspace,
      noun: "slide video",
    });
  })
).pipe(
  Command.withDescription(
    `Have the service the workspace chose for slide videos (Shotstack, with the workspace's own key) compose images of its media, with captions and an optional voice-over, into an MP4 in its media. Without --wait the command answers at once with the video's id. The workspace's Shotstack account pays; Peal bills nothing for it, but on a server that bills, the workspace's billing account needs a payment method. One at a time a workspace, ${String(slideshowsPerDay)} a day.`
  )
);

const status = Command.make(
  "status",
  {
    json: jsonFlag,
    slideshowId: Argument.String("slideshow-id").pipe(
      Argument.withDescription(
        "The slide video, as peal media slideshow create printed its id."
      )
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("media.slideshow.status")(function* status(input) {
    const { client, url } = yield* inWorkspace(input.workspace);

    const found = yield* client.slideshows
      .get({
        headers: {},
        params: { slideshowId: input.slideshowId },
      })
      .pipe(Effect.mapError(explain(url)));

    yield* input.json
      ? printJson(SlideshowSchema, found)
      : Console.log(slideshowLine(found));
  })
).pipe(
  Command.withDescription(
    "Say where a slide video stands: queued, being composed, ready with its media id, or failed with why."
  )
);

const list = Command.make(
  "list",
  {
    json: jsonFlag,
    status: Flag.Literals("status", SlideshowStatusSchema.literals).pipe(
      Flag.withDescription(
        "Only the slide videos in this state: queued, running, succeeded or failed."
      ),
      Flag.optional
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("media.slideshow.list")(function* list(input) {
    const { client, url, workspace } = yield* inWorkspace(input.workspace);

    const found = yield* client.slideshows
      .list({
        headers: {},
        query: Option.match(input.status, {
          onNone: () => ({}),
          onSome: (wanted) => ({ status: wanted }),
        }),
      })
      .pipe(Effect.mapError(explain(url)));

    if (input.json) {
      yield* printJson(SlideshowsSchema, found);

      return;
    }

    if (found.slideshows.length === 0) {
      yield* Console.log(`${workspace.name} has no slide video to list.`);

      return;
    }

    for (const slideshow of found.slideshows) {
      yield* Console.log(slideshowLine(slideshow));
    }
  })
).pipe(
  Command.withDescription(
    "List the slide videos the workspace asked for, newest first, with where each stands."
  )
);

export const slideshow = Command.make("slideshow").pipe(
  Command.withDescription(
    "Slide videos the service the workspace chose (Shotstack) composes from its images into its media: asking for one, and following it."
  ),
  Command.withSubcommands([create, render, status, list])
);
