import { relayedFileOf, relayedTypeOf } from "#studio/asset-relay.ts";

// The Studio editor's relay (`#studio/asset-relay.ts`): a font, a
// WebAssembly module or an emoji the Studio SDK asks for, fetched by the
// app from the one host it comes from, so the visitor's browser never
// reaches that host. Nothing of the visitor's request is forwarded: no
// cookie, no header, no query.

// The largest file relayed: Google's largest font files are a few
// megabytes, the WebAssembly modules less.
const maxBytes = 12 * 1024 * 1024;

const timeoutMs = 15_000;

// Read up to `maxBytes`, or none when the answer is larger.
const bounded = async (
  response: Response
): Promise<Uint8Array<ArrayBuffer> | null> => {
  const declared = Number(response.headers.get("content-length") ?? "0");

  if (declared > maxBytes || response.body === null) {
    return null;
  }

  const chunks: Uint8Array[] = [];
  let size = 0;

  // Leaving the loop early cancels the rest of the answer.
  for await (const chunk of response.body) {
    size += chunk.byteLength;

    if (size > maxBytes) {
      return null;
    }

    chunks.push(chunk);
  }

  const bytes = new Uint8Array(new ArrayBuffer(size));
  let at = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }

  return bytes;
};

export const GET = async (
  _request: Request,
  { params }: RouteContext<"/studio-assets/[...path]">
): Promise<Response> => {
  const { path } = await params;
  const file = relayedFileOf(path);

  if (file === null) {
    return new Response(null, { status: 404 });
  }

  const answer = await fetch(file.url, {
    credentials: "omit",
    redirect: "error",
    signal: AbortSignal.timeout(timeoutMs),
  }).catch(() => null);

  if (answer === null || !answer.ok) {
    return new Response(null, { status: 502 });
  }

  const bytes = await bounded(answer).catch(() => null);

  if (bytes === null) {
    return new Response(null, { status: 502 });
  }

  return new Response(bytes, {
    headers: {
      "Cache-Control": `public, max-age=${String(file.maxAge)}, immutable`,
      // An SVG served from the app's origin must never run anything.
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      "Content-Type": relayedTypeOf(file.url),
      "X-Content-Type-Options": "nosniff",
    },
  });
};
