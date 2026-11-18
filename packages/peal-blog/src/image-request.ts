// What the blog's image endpoint (Astro's, at <base>/_image) takes. Its
// answers are cached at Cloudflare's edge by their whole query (the Pulumi
// project's site-cache rule), so a request Astro would never build, with
// parameters of its own, another source or an odd size, would miss that
// cache and make the server resize again: the guard answers 404 to it. The
// rules follow Astro's sharp service (getURL in
// astro/dist/assets/services/service.js) as the pages use it, with no
// state, so every process and every restart reads them alike.

/** The parameters Astro's getURL writes for the pages' images. */
export const imageParameters = new Set([
  "href",
  "w",
  "h",
  "f",
  "fit",
  "position",
]);

/**
 * The formats Astro outputs (VALID_OUTPUT_FORMATS in
 * astro/dist/assets/consts.js, which a test compares this with).
 */
export const imageFormats = new Set([
  "avif",
  "png",
  "webp",
  "jpeg",
  "jpg",
  "svg",
]);

/** Astro's object-fit values (ImageFit), "none" aside, which it drops. */
export const imageFits = new Set(["fill", "contain", "cover", "scale-down"]);

/** The widest or tallest image the endpoint makes: twice EmDash's widest breakpoint, rounded up. */
export const largestDimension = 4000;

const positionWords = new Set(["center", "top", "right", "bottom", "left"]);

/** Where EmDash serves its media, which the pages' images are resized from. */
const mediaPath = "/_emdash/api/media/file/";

// A media key: EmDash's ulid and the file's extension.
const mediaKey = /^[0-9A-Za-z]+(?:\.[0-9A-Za-z]+)?$/u;

// The content hash EmDash may add to a media URL.
const mediaHash = /^sha1:[0-9a-f]{40}$/u;

const dimension = /^[1-9]\d{0,3}$/u;

const edgeSlashes = /^\/+|\/+$/gu;

/** The image endpoint under `base`. */
export const imageRoute = (base: string): string => {
  const name = base.replaceAll(edgeSlashes, "");

  return name === "" ? "/_image" : `/${name}/_image`;
};

/** Whether a path is the image endpoint, however many slashes end it. */
export const isImageRoute = (pathname: string, base: string): boolean =>
  pathname.replace(/\/+$/u, "") === imageRoute(base);

const sizeTaken = (value: string | null) =>
  value === null ||
  (dimension.test(value) && Number(value) <= largestDimension);

const sourceTaken = (href: string | null, origin: string) => {
  if (href === null) {
    return false;
  }

  try {
    const source = new URL(href, origin);
    const key = source.pathname.slice(mediaPath.length);
    const hashes = source.searchParams.getAll("_emdash_media");

    return (
      source.pathname.startsWith(mediaPath) &&
      mediaKey.test(key) &&
      [...source.searchParams.keys()].every(
        (name) => name === "_emdash_media"
      ) &&
      hashes.length <= 1 &&
      hashes.every((hash) => mediaHash.test(hash))
    );
  } catch {
    return false;
  }
};

const positionTaken = (value: string | null) =>
  value === null ||
  (value.split(" ").length <= 2 &&
    value.split(" ").every((word) => positionWords.has(word)));

/** Whether the image endpoint takes a request, its path aside. */
export const imageQueryTaken = (url: URL): boolean => {
  const query = url.searchParams;
  const names = [...query.keys()];

  return (
    names.every((name) => imageParameters.has(name)) &&
    new Set(names).size === names.length &&
    sourceTaken(query.get("href"), url.origin) &&
    sizeTaken(query.get("w")) &&
    sizeTaken(query.get("h")) &&
    (query.get("f") === null || imageFormats.has(query.get("f") ?? "")) &&
    (query.get("fit") === null || imageFits.has(query.get("fit") ?? "")) &&
    positionTaken(query.get("position"))
  );
};

/**
 * Whether the blog refuses an image request: its endpoint spelled with a
 * trailing slash, which no page writes, or a query Astro would not build.
 */
export const imageRefused = (url: URL, base: string): boolean => {
  if (!isImageRoute(url.pathname, base)) {
    return false;
  }

  return url.pathname !== imageRoute(base) || !imageQueryTaken(url);
};
