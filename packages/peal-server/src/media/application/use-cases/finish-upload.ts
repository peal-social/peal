import { DateTime, Effect } from "effect";

import { MediaImportBusy } from "#media/application/media-import-busy.ts";
import { getAsset } from "#media/application/ports/media-assets.ts";
import { ProbeSlots } from "#media/application/ports/probe-slots.ts";
import { completeUpload } from "#media/application/use-cases/complete-upload.ts";
import type { CompleteUploadRequest } from "#media/application/use-cases/complete-upload.ts";
import { probeMedia } from "#media/application/use-cases/probe-media.ts";
import { itemOf } from "#media/application/use-cases/view-media.ts";
import type { MediaAsset } from "#media/domain/media-asset.ts";
import { isFinalProbe } from "#media/domain/media-status.ts";
import { probeSlotPoll, probeSlotWait } from "#media/domain/probe-limits.ts";

// Whether the completed asset is one to probe: uploaded, and not refused
// for good by an earlier probe.
const toProbe = (asset: MediaAsset): boolean =>
  asset.status._tag === "uploaded" && !isFinalProbe(asset.status, asset.kind);

// Probes the completed asset, and answers it as the probe left it.
const probed = (request: CompleteUploadRequest) =>
  probeMedia(request).pipe(
    Effect.map(({ asset }) => asset),
    Effect.catchTags({
      InvalidMediaTransition: () => completeUpload(request),
      // The failure is recorded on the asset.
      MediaProbeFailed: () => getAsset(request.workspaceId, request.assetId),
    })
  );

/**
 * Completes the upload and probes the file, without a probe's slot: for
 * the files that arrive (imports, the assistant's images), which run
 * within their own (`ImportSlots`). As `finishUpload` otherwise.
 */
export const finishArrived = Effect.fn("Media.finishArrived")(
  function* finishArrived(request: CompleteUploadRequest) {
    const completed = yield* completeUpload(request);

    return yield* itemOf(
      toProbe(completed) ? yield* probed(request) : completed
    );
  }
);

/**
 * What a client calls once it sent the file: completes the upload, then
 * probes the file, and answers with the asset as both left it and where its
 * file can be read for a while. A file that cannot be probed is still
 * uploaded: the asset stays uploaded with the reason, and calling this
 * again probes it again, unless the reason came from the file's bytes
 * alone (`isFinalProbe`: too large, too many pages, an image or a document
 * unreadable, a video found unreadable `maxVideoReads` times in a row),
 * which probing again would only repeat: the asset is answered as it
 * stands.
 * When another call moved the asset on meanwhile, the answer is the asset
 * as it now stands.
 *
 * A probe reads its file for up to a minute: a workspace runs two at
 * once, and the server eight (`probesAtOnce`). Past either, the call waits
 * for a slot up to `probeSlotWait`, then is refused (`MediaImportBusy`),
 * the upload completed and the asset left uploaded for the next call to
 * probe.
 */
export const finishUpload = Effect.fn("Media.finishUpload")(
  function* finishUpload(request: CompleteUploadRequest) {
    const completed = yield* completeUpload(request);

    if (!toProbe(completed)) {
      return yield* itemOf(completed);
    }

    const asset = yield* Effect.scoped(
      Effect.gen(function* probeInSlot() {
        const slots = yield* ProbeSlots;
        const until = DateTime.addDuration(yield* DateTime.now, probeSlotWait);

        // A slot frees itself when a probe ends: asked again until then.
        while (!(yield* slots.take(request.workspaceId))) {
          if (DateTime.isGreaterThanOrEqualTo(yield* DateTime.now, until)) {
            return yield* new MediaImportBusy();
          }

          yield* Effect.sleep(probeSlotPoll);
        }

        return yield* probed(request);
      })
    );

    return yield* itemOf(asset);
  }
);
