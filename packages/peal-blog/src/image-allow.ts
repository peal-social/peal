// The image transforms the blog's own pages ask for. Cloudflare's edge
// caches /blog/_image by its whole query (the Pulumi project's cache rule),
// so a request with any other width, height, quality, format or fit would
// miss that cache and make the server resize again. The image service
// (./image-service.ts) records each URL Astro builds for a page as it
// renders it, from the pages' own configuration (EmDash's responsive
// widths, each image's size, Astro's formats), and the guard
// (./middleware/guard.ts) answers 404 to an /_image request this server
// never handed out. A server that just started knows none: the first page
// it renders records its images before the browser asks for them.

/** The most transforms kept: past it, the oldest are forgotten. */
export const keptTransforms = 50_000;

/** A transform's query in one spelling: its parameters in order. */
export const transformKey = (query: URLSearchParams): string => {
  const entries = [...query.entries()].toSorted(([left], [right]) =>
    left.localeCompare(right)
  );

  return new URLSearchParams(entries).toString();
};

export interface TransformRegistry {
  /** Records the query of an image URL a page hands out. */
  readonly add: (url: string) => void;
  /** Whether a request's query is one a page handed out. */
  readonly has: (query: URLSearchParams) => boolean;
}

export const transformRegistry = (
  limit: number = keptTransforms
): TransformRegistry => {
  // A Set keeps its insertion order: the first entry is the oldest.
  const keys = new Set<string>();

  return {
    add: (url) => {
      const [, query = ""] = url.split("?", 2);
      const key = transformKey(new URLSearchParams(query));

      keys.delete(key);
      keys.add(key);

      if (keys.size > limit) {
        const [oldest] = keys;

        if (oldest !== undefined) {
          keys.delete(oldest);
        }
      }
    },
    has: (query) => keys.has(transformKey(query)),
  };
};

/** This server's: the image service records, the guard reads. */
export const handedOut = transformRegistry();
