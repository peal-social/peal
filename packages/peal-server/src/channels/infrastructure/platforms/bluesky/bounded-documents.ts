import { Data, Option, Predicate, Schema } from "effect";

import type { PublicFetch } from "#shared/infrastructure/platforms/public-http.ts";

/**
 * The most an answer the AT Protocol's libraries read may carry: a DID
 * document, a handle's answer, authorization and resource servers'
 * metadata, a PAR or token answer. Real ones are a few KB.
 */
export const maxDocumentBytes = 32 * 1024;

/**
 * The most entries all the arrays of one JSON answer may hold together.
 * The libraries validate each entry, and keep an issue per failing one: a
 * body of a million entries costs seconds and gigabytes, where a real
 * document has a few dozen.
 */
export const maxArrayEntries = 256;

/** How deep the arrays and objects of one JSON answer may nest. */
export const maxNestingDepth = 16;

/**
 * An answer Peal refused before the library read it: too large, or JSON
 * whose arrays or nesting go past the bounds. The fetch fails with it, as
 * for a host that sent nothing the library could use.
 */
export class HostileAnswer extends Data.TaggedError("HostileAnswer")<{
  readonly host: string;
  readonly why: "deep" | "entries" | "large";
}> {}

const isHostile = Schema.is(Schema.instanceOf(HostileAnswer));

/** Whether a fetch failed with a `HostileAnswer`, as its cause. */
export const hostileOf = (error: TypeError): Option.Option<HostileAnswer> =>
  Option.some(error.cause).pipe(Option.filter(isHostile));

// A parsed body's arrays' entries and its depth, walked without recursion
// and stopping at the first bound passed.
const boundPassed = (
  parsed: Option.Option<unknown>
): Option.Option<"deep" | "entries"> => {
  if (Option.isNone(parsed)) {
    return Option.none();
  }

  let entries = 0;
  const pending: (readonly [unknown, number])[] = [[parsed.value, 1]];

  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    const [node, depth] = next;

    if (depth > maxNestingDepth) {
      return Option.some("deep");
    }

    if (Array.isArray(node)) {
      entries += node.length;

      if (entries > maxArrayEntries) {
        return Option.some("entries");
      }

      for (const item of node) {
        pending.push([item, depth + 1]);
      }
    } else if (Predicate.isObject(node)) {
      for (const item of Object.values(node)) {
        pending.push([item, depth + 1]);
      }
    }
  }

  return Option.none();
};

const decodeJson = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Unknown)
);

/**
 * What an answer's body breaks, if anything: past `maxDocumentBytes`, or
 * JSON past `maxArrayEntries` or `maxNestingDepth`. A body that is no JSON
 * is the library's to refuse, and costs it little at this size.
 */
export const refusalOf = (
  body: Uint8Array
): Option.Option<HostileAnswer["why"]> => {
  if (body.byteLength > maxDocumentBytes) {
    return Option.some("large");
  }

  return boundPassed(decodeJson(new TextDecoder().decode(body)));
};

// The rest of a body, read chunk after chunk up to one past the limit:
// what lies beyond is never downloaded.
interface ChunkReader {
  readonly cancel: () => Promise<void>;
  readonly read: () => Promise<
    | { readonly done: true; readonly value?: undefined }
    | { readonly done: false; readonly value: Uint8Array }
  >;
}

// A body within the limit comes in a few chunks. A server that drips its
// answer a byte a chunk is refused as one too large, so nothing is kept
// per chunk but the bytes themselves, in the one buffer.
const maxChunks = 2048;

// Reads into the one buffer and answers how much of it is filled: all of
// it (one byte past the limit) once the body is too large, or came in too
// many chunks, and the rest is left unread.
const readInto = async (
  reader: ChunkReader,
  body: Uint8Array,
  filled: number,
  chunks: number
): Promise<number> => {
  const { done, value } = await reader.read();

  if (done) {
    return filled;
  }

  const room = body.byteLength - filled;

  if (value.byteLength >= room || chunks >= maxChunks) {
    await reader.cancel();

    return body.byteLength;
  }

  body.set(value, filled);

  return await readInto(reader, body, filled + value.byteLength, chunks + 1);
};

const readBounded = async (response: Response): Promise<Uint8Array> => {
  const reader = response.body?.getReader();

  if (reader === undefined) {
    return new Uint8Array();
  }

  const body = new Uint8Array(maxDocumentBytes + 1);
  const filled = await readInto(reader, body, 0, 0);

  return body.subarray(0, filled);
};

/**
 * The fetch the AT Protocol's OAuth client and resolvers are given, over
 * Peal's guarded one: every answer read whole, but no further than
 * `maxDocumentBytes`, and handed to the library only when it holds no more
 * than `maxArrayEntries` array entries nested `maxNestingDepth` deep; else
 * the fetch fails with a `HostileAnswer`. A hostile DID document, metadata
 * or token answer never reaches the library's validators.
 */
export const boundedDocuments = (fetch: PublicFetch): PublicFetch =>
  Object.assign(
    async (input: Request | URL | string, init?: RequestInit) => {
      const response = await fetch(input, init);

      const { host } = new URL(
        input instanceof Request ? input.url : String(input)
      );

      const body = await readBounded(response);
      const refused = refusalOf(body);

      if (Option.isSome(refused)) {
        throw new TypeError(`answer refused from ${host}`, {
          cause: new HostileAnswer({ host, why: refused.value }),
        });
      }

      const kept = new Response(response.body === null ? null : body, {
        headers: response.headers,
        status: response.status,
        statusText: response.statusText,
      });

      // The library reads where an answer came from.
      Object.defineProperty(kept, "url", { value: response.url });

      return kept;
    },
    { preconnect: fetch.preconnect }
  );
