import { Effect, Layer, Option } from "effect";

import { VideoNotices } from "#assistant/application/ports/video-notices.ts";
import { Notify } from "#notifications/application/notify.ts";

/**
 * VideoNotices on the notifications context's Notify: `VideoGenerationEnded`
 * for the member who asked (the request's `author`, whom alone
 * `recipientsOf` tells for this event), keyed `video-generation:<id>`, in
 * the caller's transaction. A job a key asked for tells nobody; a
 * directory that cannot be read now leaves the notice out, logged, as the
 * job's state on the media page says the same.
 */
export const NotifiedVideoNoticesLive = Layer.effect(
  VideoNotices,
  Effect.gen(function* NotifiedVideoNotices() {
    const notify = yield* Notify;

    return VideoNotices.of({
      ended: (generation) =>
        Option.match(generation.requestedBy, {
          onNone: () => Effect.void,
          onSome: (author) =>
            notify
              .notify({
                author,
                event: {
                  _tag: "VideoGenerationEnded",
                  generationId: generation.id,
                  mediaId: generation.mediaId,
                  outcome:
                    generation.status === "succeeded" ? "succeeded" : "failed",
                  reason: generation.reason,
                },
                key: `video-generation:${generation.id}`,
                workspaceId: generation.workspaceId,
              })
              .pipe(
                Effect.catchTag("RecipientsUnavailable", () =>
                  Effect.logWarning(
                    "A video's notice was not made: the members could not be read"
                  )
                ),
                Effect.catchTag("DatabaseError", Effect.die)
              ),
        }),
    });
  })
);
