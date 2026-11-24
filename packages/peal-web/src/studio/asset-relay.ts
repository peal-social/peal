// The files the Studio SDK fetches while it edits (fonts, the text
// shaper's and the SVG renderer's WebAssembly, emoji), served from the
// app's own origin under `relayPrefix`, so no visitor's address goes to
// another host for them. The app fetches each from the one host it comes
// from, among a fixed list of paths: the relay forwards nothing else.

/** Where the relay answers, the upstream host as its first segment. */
export const relayPrefix = "/studio-assets";

interface Upstream {
  /** How long a file may be kept, in seconds. */
  readonly maxAge: number;
  /** The paths the relay fetches from the host. */
  readonly paths: RegExp;
}

// A year for a versioned file, which never changes; a day otherwise.
const year = 31_536_000;
const day = 86_400;

/** The hosts the SDK fetches from, which the relay stands in for. */
export const relayedHosts = [
  "cdn.jsdelivr.net",
  "fonts.gstatic.com",
  "js.shotstack.io",
  "templates.shotstack.io",
  "unpkg.com",
] as const;

type RelayedHost = (typeof relayedHosts)[number];

const upstreams: Readonly<Record<RelayedHost, Upstream>> = {
  "cdn.jsdelivr.net": {
    maxAge: day,
    paths: /^gh\/googlefonts\/noto-emoji@main\/svg\/[\da-z_]{1,80}\.svg$/u,
  },
  "fonts.gstatic.com": {
    maxAge: year,
    paths: /^s\/[\da-z]{1,60}\/v\d{1,4}\/[\w-]{1,120}\.(?:otf|ttf|woff2?)$/u,
  },
  "js.shotstack.io": {
    maxAge: day,
    paths: /^canvas\/(?:hb\.wasm|fonts\/[\w-]{1,80}\.(?:otf|ttf))$/u,
  },
  "templates.shotstack.io": {
    maxAge: day,
    paths: /^basic\/asset\/font\/[\w.-]{1,80}\.(?:otf|ttf)$/u,
  },
  "unpkg.com": {
    maxAge: year,
    paths: /^@resvg\/resvg-wasm@2\.6\.2\/index_bg\.wasm$/u,
  },
};

/** What a relayed file is fetched from, and how long it may be kept. */
export interface RelayedFile {
  readonly maxAge: number;
  readonly url: string;
}

/**
 * The upstream file a relay path names (`<host>/<path>`, as split by the
 * route), or none when the relay does not serve it.
 */
export const relayedFileOf = (
  segments: readonly string[]
): RelayedFile | null => {
  const [first, ...rest] = segments;
  const host = relayedHosts.find((each) => each === first);
  const path = rest.join("/");

  if (host === undefined || !upstreams[host].paths.test(path)) {
    return null;
  }

  return { maxAge: upstreams[host].maxAge, url: `https://${host}/${path}` };
};

/** The type a relayed file is served as, by its extension. */
export const relayedTypeOf = (url: string): string => {
  if (url.endsWith(".wasm")) {
    return "application/wasm";
  }

  if (url.endsWith(".svg")) {
    return "image/svg+xml";
  }

  if (url.endsWith(".woff2")) {
    return "font/woff2";
  }

  if (url.endsWith(".woff")) {
    return "font/woff";
  }

  return url.endsWith(".otf") ? "font/otf" : "font/ttf";
};

/**
 * A file's address as the SDK should fetch it: one of the relayed hosts'
 * goes through the relay at `origin`; any other stays.
 */
export const relayedAddressOf = (address: string, origin: string): string => {
  const host = relayedHosts.find((each) =>
    address.startsWith(`https://${each}/`)
  );

  return host === undefined
    ? address
    : `${origin}${relayPrefix}/${address.slice("https://".length)}`;
};

/**
 * A font's CSS source (`url(…)`, as `FontFace` takes it) with each
 * relayed host's address sent through the relay at `origin`.
 */
export const relayedSourceOf = (source: string, origin: string): string =>
  source.replaceAll(
    /url\((?<quote>["']?)(?<address>https:\/\/[^"')]+)\k<quote>\)/gu,
    (_whole, quote: string, address: string) =>
      `url(${quote}${relayedAddressOf(address, origin)}${quote})`
  );

/**
 * A relayed address back as its host's own, for a document that leaves
 * the browser; any other stays.
 */
export const upstreamAddressOf = (address: string, origin: string): string => {
  const prefix = `${origin}${relayPrefix}/`;

  return address.startsWith(prefix)
    ? `https://${address.slice(prefix.length)}`
    : address;
};
