import { Effect, Layer, Option } from "effect";

import { SlideshowNotices } from "#assistant/application/ports/slideshow-notices.ts";
import { Notify } from "#notifications/application/notify.ts";

/**
 * SlideshowNotices on the notifications context's Notify: `SlideshowEnded`
 * for the member who asked (the request's `author`, whom alone
 * `recipientsOf` tells for this event), keyed `slideshow:<id>`, in the
 * caller's transaction. A job a key asked for tells nobody; a directory
 * that cannot be read now leaves the notice out, logged, as the job's
 * state on the media page says the same.
 */
export const NotifiedSlideshowNoticesLive = Layer.effect(
  SlideshowNotices,
  Effect.gen(function* NotifiedSlideshowNotices() {
    const notify = yield* Notify;

    return SlideshowNotices.of({
      ended: (slideshow) =>
        Option.match(slideshow.requestedBy, {
          onNone: () => Effect.void,
          onSome: (author) =>
            notify
              .notify({
                author,
                event: {
                  _tag: "SlideshowEnded",
                  mediaId: slideshow.mediaId,
                  outcome:
                    slideshow.status === "succeeded" ? "succeeded" : "failed",
                  reason: slideshow.reason,
                  slideshowId: slideshow.id,
                },
                key: `slideshow:${slideshow.id}`,
                workspaceId: slideshow.workspaceId,
              })
              .pipe(
                Effect.catchTag("RecipientsUnavailable", () =>
                  Effect.logWarning(
                    "A slide video's notice was not made: the members could not be read"
                  )
                ),
                Effect.catchTag("DatabaseError", Effect.die)
              ),
        }),
    });
  })
);
