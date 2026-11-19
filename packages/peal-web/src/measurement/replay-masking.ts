import { addressOf, patternOf } from "./place.ts";

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

// Attributes that hold an address, which keeps its pattern alone when it is
// Peal's own, and nothing of it otherwise.
const addressAttributes: ReadonlySet<string> = new Set([
  "action",
  "href",
  "poster",
  "src",
]);

/**
 * What a recording shows of an address that leads away from Peal (a
 * profile's link, a link in a post, `mailto:`): nothing of it.
 */
export const elsewhere = "https://elsewhere.invalid/";

// An address of Peal's own as its pattern, any other as `elsewhere`.
const ownAddressOf = (value: string, origin: string): string => {
  const url = URL.parse(value, origin);

  return url !== null &&
    url.origin === origin &&
    (url.protocol === "https:" || url.protocol === "http:")
    ? patternOf(url.pathname)
    : elsewhere;
};

/**
 * An attribute as a recording keeps it, on a page of `origin`: a text as
 * asterisks of the same length (`data-*` included), an address of Peal's
 * own as its pattern and any other as `elsewhere`, anything else (a
 * class, a role) as it is.
 */
export const maskAttributeFor =
  (origin: string) =>
  (name: string, value: string): string => {
    const lower = name.toLowerCase();

    if (maskedAttributes.has(lower) || lower.startsWith("data-")) {
      return "*".repeat(value.length);
    }

    return addressAttributes.has(lower) ? ownAddressOf(value, origin) : value;
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
 * The recording's options on a page of `origin`: every input, text and
 * attribute masked, media blocked, no header, body, font, canvas or
 * cross-origin frame recorded. A recording shows the layout, the clicks
 * and the navigation, never a text or a picture, Peal's own labels
 * included.
 */
export const replayMaskingOf = (origin: string) => ({
  blockSelector: blocked,
  captureCanvas: { recordCanvas: false },
  captureJsonLd: false,
  collectFonts: false,
  maskAllInputs: true,
  maskAttributeFn: maskAttributeFor(origin),
  maskCapturedNetworkRequestFn: maskRequest,
  maskTextSelector: "*",
  recordBody: false,
  recordCrossOriginIframes: false,
  recordHeaders: false,
});
