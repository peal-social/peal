import { addressOf } from "./place.ts";

// What draws content rather than Peal's layout: media, canvases, frames
// and file inputs, and any element that shows a picture as a CSS
// background (`data-replay-block`).
const blocked = [
  "img",
  "picture",
  "video",
  "audio",
  "canvas",
  "iframe",
  "object",
  "embed",
  "svg image",
  "input[type=file]",
  "[data-replay-block]",
].join(", ");

// Attributes whose value is text someone may have written or read.
const maskedAttributes: ReadonlySet<string> = new Set([
  "alt",
  "aria-description",
  "aria-label",
  "aria-valuetext",
  "content",
  "label",
  "placeholder",
  "srcset",
  "title",
  "value",
]);

// Attributes that hold an address, which keeps its path alone.
const addressAttributes: ReadonlySet<string> = new Set([
  "action",
  "href",
  "poster",
  "src",
]);

/**
 * An attribute as a recording keeps it: a text as asterisks of the same
 * length (`data-*` included), an address without its query or fragment,
 * anything else (a class, a role) as it is.
 */
export const maskAttribute = (name: string, value: string): string => {
  const lower = name.toLowerCase();

  if (maskedAttributes.has(lower) || lower.startsWith("data-")) {
    return "*".repeat(value.length);
  }

  if (addressAttributes.has(lower)) {
    const [address = ""] = value.split(/[?#]/u);

    return address;
  }

  return value;
};

/** A network request as a recording names it. */
export interface RecordedRequest {
  name: string;
  requestBody?: unknown;
  requestHeaders?: unknown;
  responseBody?: unknown;
  responseHeaders?: unknown;
}

/**
 * A request as a recording keeps it, the page's own address included: its
 * address as an origin and a pattern, its timing, method and status, and
 * no header nor body.
 */
export const maskRequest = <R extends RecordedRequest>({
  requestBody: _requestBody,
  requestHeaders: _requestHeaders,
  responseBody: _responseBody,
  responseHeaders: _responseHeaders,
  ...kept
}: R) => ({ ...kept, name: addressOf(kept.name) });

/**
 * The recording's options: every input, text and attribute masked, media
 * blocked, no header, body, font, canvas or cross-origin frame recorded.
 * A recording shows the layout, the clicks and the navigation, never a
 * text or a picture, Peal's own labels included.
 */
export const replayMasking = {
  blockSelector: blocked,
  captureCanvas: { recordCanvas: false },
  captureJsonLd: false,
  collectFonts: false,
  maskAllInputs: true,
  maskAttributeFn: maskAttribute,
  maskCapturedNetworkRequestFn: maskRequest,
  maskTextSelector: "*",
  recordBody: false,
  recordCrossOriginIframes: false,
  recordHeaders: false,
};
