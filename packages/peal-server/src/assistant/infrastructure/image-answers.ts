import { Effect } from "effect";
import type { Duration } from "effect";

import { ImageFailed } from "#assistant/application/image-failed.ts";
import type { MadeImage } from "#assistant/application/ports/image-model.ts";
import { maxImageBytes } from "#assistant/domain/image-limits.ts";
import { publicFetchWith } from "#shared/infrastructure/platforms/public-http.ts";

// What the server's image model and a workspace's own provider share: how
// long a call waits, how much of an answer is read, what a status means,
// and how an address an answer gives is fetched. Each caller decides what
// the statuses that refuse the settings mean.

/**
 * How long the assistant waits for an image, the fetch of an answer's
 * address included. The provider may have made an image it did not answer
 * in time, so such a request counts toward the quota. Whatever sits
 * between the browser and the server must wait longer (the web app's
 * proxy waits 120 seconds).
 */
export const imageAnswerTimeout: Duration.Input = "90 seconds";

/**
 * The most an answer may carry: the largest image the library stores, in
 * base64 (a third more), in a JSON document, with room.
 */
export const maxAnswerBytes = 24 * 1024 * 1024;

/**
 * The statuses that say the settings are wrong: a key refused or not
 * allowed, an account that does not pay, a model or an address the
 * provider does not have. Nothing ran.
 */
export const settingsRefused: ReadonlySet<number> = new Set([
  401, 402, 403, 404,
]);

/**
 * What another status that is not a success means: a rate limit or a
 * failure of the provider, or a refusal of this request. In either case
 * no image was made.
 */
export const reasonOfStatus = (status: number): ImageFailed["reason"] =>
  status === 429 || status >= 500 ? "unreachable" : "refused";

/** The image failed for this reason, with no cause. */
export const imageFailure = (reason: ImageFailed["reason"]) =>
  new ImageFailed({ reason });

/**
 * The image as the library may take it: not empty, and no larger than
 * `maxImageBytes`; `unusableAnswer` otherwise.
 */
export const madeImageOf = (
  bytes: Uint8Array
): Effect.Effect<MadeImage, ImageFailed> =>
  bytes.byteLength === 0 || bytes.byteLength > maxImageBytes
    ? Effect.fail(imageFailure("unusableAnswer"))
    : Effect.succeed({ bytes });

/**
 * The fetch an image given by address goes through: the outbound guard
 * checks it (whoever's provider gave it), no redirect is followed, and
 * the image is cut off past `maxImageBytes`. Needs the OutboundGuard.
 */
export const imageDownloadFetch = (timeout: Duration.Input) =>
  publicFetchWith({ maxResponseBytes: maxImageBytes + 1, timeout });
