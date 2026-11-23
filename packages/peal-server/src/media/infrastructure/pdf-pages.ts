import { promisify } from "node:util";
import { inflate } from "node:zlib";

import { Effect, Option, Schema, Stream } from "effect";

import {
  afterLineEnd,
  bytesOf,
  find,
  longestToken,
  nextToken,
  startsAt,
} from "./pdf-syntax.ts";
import type { PdfToken } from "./pdf-syntax.ts";

const inflated = promisify(inflate);

const header = bytesOf("%PDF-");

// A PDF's header is within its first 1024 bytes (the PDF reference's
// implementation notes), not always at the very start.
const headerWindow = 1024;

/** Whether the file starts as a PDF does. */
export const isPdf = (bytes: Uint8Array): boolean =>
  find(bytes, header, 0, Math.min(bytes.length, headerWindow)) !== -1;

const endStreamKeyword = bytesOf("endstream");

/**
 * How much of a file is read before the reader lets other work run: the
 * count never holds the process for longer than a slice takes, so a
 * timeout on it fires, and requests are answered meanwhile.
 */
export const sliceBytes = 256 * 1024;

/** The most object streams a file's count reads. */
export const maxObjectStreams = 8192;

/** The most one object stream may inflate to. */
export const maxInflatedStream = 8 * 1024 * 1024;

/** The most a file's object streams may inflate to, together. */
export const maxInflatedTotal = 128 * 1024 * 1024;

// What the count reads of a dictionary: its own keys, never those of the
// dictionaries and arrays inside it.
interface Dictionary {
  /** `/Count`, when it is written there as a whole number. */
  readonly count: Option.Option<number>;
  /** `/Filter`, when it is one name. */
  readonly filter: string;
  readonly filtered: boolean;
  /** `/Length`, when it is written there as a whole number. */
  readonly length: Option.Option<number>;
  readonly parented: boolean;
  /** `/Type`, with its slash. */
  readonly type: string;
}

const noDictionary: Dictionary = {
  count: Option.none(),
  filter: "",
  filtered: false,
  length: Option.none(),
  parented: false,
  type: "",
};

const wholeNumber = Schema.decodeUnknownOption(Schema.FiniteFromString);

const digits = /^\d+$/u;

// A key's value, when it is one word: `12`, not `12 0 R`.
const direct = (first: string, words: number): Option.Option<number> =>
  words === 1 && digits.test(first) ? wholeNumber(first) : Option.none();

// The dictionary with one more of its keys read. `first` is the first word
// of the key's value, and `words` how many it has.
const withKey = (
  dictionary: Dictionary,
  key: string,
  first: string,
  words: number
): Dictionary => {
  if (key === "/Type") {
    return { ...dictionary, type: words === 1 ? first : "" };
  }

  if (key === "/Parent") {
    return { ...dictionary, parented: true };
  }

  if (key === "/Count") {
    return { ...dictionary, count: direct(first, words) };
  }

  if (key === "/Length") {
    return { ...dictionary, length: direct(first, words) };
  }

  return key === "/Filter"
    ? { ...dictionary, filter: words === 1 ? first : "", filtered: true }
    : dictionary;
};

// A dictionary's keys as they are read: keys are names, and a value is
// whatever follows until the next key. A name right after a key is its
// value; any other name is the next key.
interface Keys {
  readonly dictionary: Dictionary;
  readonly first: string;
  readonly key: string;
  readonly words: number;
}

const noKeys: Keys = { dictionary: noDictionary, first: "", key: "", words: 0 };

// The keys once the one being read is over, and `next` starts.
const settled = (
  { dictionary, first, key, words }: Keys,
  next: string
): Keys => ({
  dictionary: key === "" ? dictionary : withKey(dictionary, key, first, words),
  first: "",
  key: next,
  words: 0,
});

const valued = (keys: Keys, text: string): Keys => ({
  ...keys,
  first: keys.words === 0 ? text : keys.first,
  words: keys.words + 1,
});

const named = (keys: Keys, text: string): Keys =>
  keys.key !== "" && keys.words === 0
    ? settled(valued(keys, text), "")
    : settled(keys, text);

type TokenKind = ReturnType<typeof nextToken>["kind"];

// How deep the reading is after a token: in dictionaries, and in arrays.
const depthAfter = (kind: TokenKind, depth: number): number => {
  if (kind === "open") {
    return depth + 1;
  }

  return kind === "close" ? depth - 1 : depth;
};

const arraysAfter = (kind: TokenKind, arrays: number): number => {
  if (kind === "arrayOpen") {
    return arrays + 1;
  }

  return kind === "arrayClose" ? Math.max(0, arrays - 1) : arrays;
};

/**
 * The most of an object stream's bytes, still compressed, that are held to
 * be inflated: a longer one leaves the count unknown, so no stream has the
 * file held whole in memory.
 */
export const maxObjectStreamBytes = maxInflatedStream;

// What is held past where the reading is: white space, then a token, each
// read through `longestToken` at most, and the few bytes after.
const lookahead = 2 * longestToken + 64;

// How much more of the file is asked for at a time, past what the reading
// needs, so that what arrived is joined once a mebibyte at most.
const refill = 1024 * 1024;

/**
 * The part of the file held in memory: from `base`, as many bytes as were
 * asked for, and whether they reach the file's end. The reading asks for
 * more (`more`), and lets go of what it no longer needs, as it goes.
 */
interface Window {
  base: number;
  bytes: Uint8Array;
  ended: boolean;
}

const windowEnd = (window: Window): number => window.base + window.bytes.length;

// A whole buffer, as the plain bytes of an object stream are.
const whole = (bytes: Uint8Array): Window => ({
  base: 0,
  bytes,
  ended: true,
});

/** Bytes of the file, from `keep`, up to `until` or the file's end. */
interface Wanted {
  readonly keep: number;
  readonly until: number;
}

/**
 * What a reading asks of whoever runs it: to let other work run (`pause`),
 * to hold the file as `Wanted` says (`more`), or to inflate an object
 * stream into `room` bytes at most (`inflate`), whose plain bytes it is
 * then given.
 */
type Step =
  | { readonly _tag: "pause" }
  | ({ readonly _tag: "more" } & Wanted)
  | {
      readonly _tag: "inflate";
      readonly body: Uint8Array;
      readonly room: number;
    };

type Reading<A> = Generator<Step, A, Option.Option<Uint8Array>>;

const pause: Step = { _tag: "pause" };

// Holds the file up to `until`, or to its end, from `keep` on.
const reach = function* reach(
  window: Window,
  keep: number,
  until: number
): Reading<void> {
  if (!window.ended && windowEnd(window) < until) {
    yield {
      _tag: "more",
      keep,
      until: Math.max(until, windowEnd(window) + refill),
    };
  }
};

// The token at or after `at`, by its places in the file; nothing before
// `at` is needed any more.
const tokenFrom = function* tokenFrom(
  window: Window,
  at: number
): Reading<PdfToken> {
  yield* reach(window, at, at + lookahead);

  const read = nextToken(window.bytes, at - window.base);

  return {
    ...read,
    end: read.end + window.base,
    start: read.start + window.base,
  };
};

interface ReadDictionary {
  readonly dictionary: Dictionary;
  readonly end: number;
}

// Reads the dictionary that opens at `start`, to its end, the file's, or
// what cannot be read through.
const readDictionary = function* readDictionary(
  window: Window,
  start: number
): Reading<ReadDictionary> {
  let keys = noKeys;
  let at = start + 2;
  let sliceStart = at;
  let depth = 1;
  let arrays = 0;

  while (depth > 0) {
    const token = yield* tokenFrom(window, at);

    if (token.kind === "end" || token.kind === "overlong") {
      break;
    }

    // Its own keys and values, not those of what it holds.
    if (depth === 1 && arrays === 0 && token.kind !== "space") {
      if (token.kind === "name") {
        keys = named(keys, token.text);
      } else if (token.kind !== "close") {
        keys = valued(keys, token.text);
      }
    }

    depth = depthAfter(token.kind, depth);
    arrays = arraysAfter(token.kind, arrays);
    at = token.end;

    if (at - sliceStart >= sliceBytes) {
      sliceStart = at;
      yield pause;
    }
  }

  return { dictionary: settled(keys, "").dictionary, end: at };
};

// Where `sequence` first is from `from`, before `until`, read a slice at a
// time; -1 if not. What is before `keep`, or else before the slice being
// read, is let go.
const findFrom = function* findFrom(
  window: Window,
  sequence: readonly number[],
  from: number,
  until: number,
  keep: Option.Option<number>
): Reading<number> {
  let start = from;

  while (start < until) {
    const sliceEnd = Math.min(start + sliceBytes, until);
    const readEnd = sliceEnd + sequence.length - 1;

    yield* reach(window, Option.isSome(keep) ? keep.value : start, readEnd);

    const found = find(
      window.bytes,
      sequence,
      start - window.base,
      Math.min(window.bytes.length, readEnd - window.base)
    );

    if (found !== -1) {
      return found + window.base;
    }

    if (window.ended && windowEnd(window) - sequence.length < sliceEnd) {
      return -1;
    }

    start = sliceEnd;
    yield pause;
  }

  return -1;
};

/**
 * The farthest an early `endstream` may be from where `/Length` points for
 * the bytes between to be held while `/Length` is checked: the reading
 * may go on from either, so both must be there.
 */
export const maxStreamCheckBytes = 4 * 1024 * 1024;

/**
 * Where a stream's bytes end: a place in the file, `never` when no
 * `endstream` follows, `beyond` when a stream whose bytes are held runs
 * past `maxObjectStreamBytes`, `lost` when `/Length` points farther than
 * `maxStreamCheckBytes` past an earlier `endstream` and no `endstream` is
 * there: the bytes after the earlier one were let go, and nothing after
 * the stream can be told apart.
 */
type StreamEnd = number | "beyond" | "lost" | "never";

// Where a stream's bytes end: where its dictionary's `/Length` says, when
// `endstream` is there, else at the first `endstream` after its start.
// The file is read forward only: that first `endstream` is looked for on
// the way to where `/Length` points, so the bytes in between are let go
// as they are passed, unless they are `held` (an object stream's).
const streamEnd = function* streamEnd(
  window: Window,
  start: number,
  length: Option.Option<number>,
  held: boolean
): Reading<StreamEnd> {
  const keep = held ? Option.some(start) : Option.none<number>();
  const until = held ? start + maxObjectStreamBytes + 1 : Infinity;

  // None before `until`: the file ended first, or the stream is longer
  // than what is held.
  const missing = (): StreamEnd =>
    window.ended && windowEnd(window) - endStreamKeyword.length < until
      ? "never"
      : "beyond";

  const told = Option.isSome(length) ? start + length.value : undefined;

  if (told === undefined || told >= until) {
    const found = yield* findFrom(window, endStreamKeyword, start, until, keep);

    return found === -1 ? missing() : found;
  }

  const early = yield* findFrom(window, endStreamKeyword, start, told, keep);

  // The bytes from the earlier `endstream` on are held only when it is
  // near enough to where `/Length` points.
  const near = early !== -1 && told - early <= maxStreamCheckBytes;

  // What the reading may go on from: the stream's start when it is held,
  // else the earlier `endstream` when near, else where `/Length` points.
  let from = told;

  if (held) {
    from = start;
  } else if (near) {
    from = early;
  }

  yield* reach(window, from, told + 2 + endStreamKeyword.length);

  if (
    startsAt(
      window.bytes,
      afterLineEnd(window.bytes, told - window.base),
      endStreamKeyword
    )
  ) {
    return told;
  }

  if (early !== -1) {
    return near || held ? early : "lost";
  }

  const after = yield* findFrom(window, endStreamKeyword, told, until, keep);

  return after === -1 ? missing() : after;
};

/** The root of a page tree: where it is written, and the pages it says. */
interface PageTreeRoot {
  readonly count: Option.Option<number>;
  readonly offset: number;
}

interface Scan {
  /** Whether all of it was read: not past what cannot be read through. */
  readonly complete: boolean;
  /** The last page tree root written, if any. */
  readonly root: Option.Option<PageTreeRoot>;
}

const incomplete: Scan = { complete: false, root: Option.none() };

// A page tree's root is the node of type Pages that has no parent.
const rootOf = (
  dictionary: Dictionary,
  offset: number
): Option.Option<PageTreeRoot> =>
  dictionary.type === "/Pages" && !dictionary.parented
    ? Option.some({ count: dictionary.count, offset })
    : Option.none();

// The root written last: a file saved again appends its new objects, so
// the last root is the one its readers follow.
const later = (
  one: Option.Option<PageTreeRoot>,
  other: Option.Option<PageTreeRoot>
): Option.Option<PageTreeRoot> =>
  Option.isSome(one) &&
  (Option.isNone(other) || one.value.offset >= other.value.offset)
    ? one
    : other;

const inflates = (dictionary: Dictionary): boolean =>
  !dictionary.filtered || dictionary.filter === "/FlateDecode";

// Reads the outermost dictionaries of the window, which are its objects',
// and skips what streams hold: only object streams (`inFile`) are read,
// inflated as they come, one at a time, into what is left of
// `maxInflatedTotal`. A root's place is where it is written in the file,
// or `offset`, where the object stream that holds it is. A stream that
// never ends stops the reading: nothing follows it.
const scan = function* scan(
  window: Window,
  offset: number,
  inFile: boolean
): Reading<Scan> {
  let root = Option.none<PageTreeRoot>();
  let last = Option.none<Dictionary>();
  let streams = 0;
  let room = maxInflatedTotal;
  let at = 0;
  let sliceStart = 0;

  for (;;) {
    const token = yield* tokenFrom(window, at);

    if (token.kind === "end") {
      break;
    }

    if (token.kind === "overlong") {
      return incomplete;
    }

    at = token.end;

    if (token.kind === "open") {
      const read = yield* readDictionary(window, token.start);
      const place = inFile ? token.start : offset;

      root = later(rootOf(read.dictionary, place), root);
      last = Option.some(read.dictionary);
      at = read.end;
    } else if (inFile && Option.isSome(last) && token.text === "stream") {
      yield* reach(window, token.end, token.end + 2);

      const dictionary = last.value;

      const start =
        afterLineEnd(window.bytes, token.end - window.base) + window.base;

      const objects = dictionary.type === "/ObjStm";
      const end = yield* streamEnd(window, start, dictionary.length, objects);

      // Nothing can be read after a stream that does not end.
      if (end === "never") {
        break;
      }

      if (end === "beyond" || end === "lost") {
        return incomplete;
      }

      if (objects) {
        streams += 1;

        // Copied, so the window it was read from is let go.
        const body = window.bytes.slice(start - window.base, end - window.base);

        const plain =
          streams <= maxObjectStreams && inflates(dictionary) && room > 0
            ? yield { _tag: "inflate", body, room }
            : Option.none<Uint8Array>();

        if (Option.isNone(plain)) {
          return incomplete;
        }

        room -= plain.value.length;

        const inner = yield* scan(whole(plain.value), start, false);

        if (!inner.complete) {
          return incomplete;
        }

        root = later(inner.root, root);
      }

      last = Option.none();
      at = end + endStreamKeyword.length;
    } else if (token.kind !== "space") {
      last = Option.none();
    }

    if (at - sliceStart >= sliceBytes) {
      sliceStart = at;
      yield pause;
    }
  }

  return { complete: true, root };
};

/** What reading a file found: no PDF, or a PDF and its pages, when told. */
export type PdfReading =
  | { readonly _tag: "notPdf" }
  | { readonly _tag: "pdf"; readonly pages: Option.Option<number> };

const unknownPages: PdfReading = { _tag: "pdf", pages: Option.none() };

const readPdf = function* readPdf(
  window: Window,
  checkHeader: boolean
): Reading<PdfReading> {
  if (checkHeader) {
    yield* reach(window, 0, headerWindow);

    if (!isPdf(window.bytes)) {
      return { _tag: "notPdf" };
    }
  }

  const read = yield* scan(window, 0, true);

  return read.complete
    ? {
        _tag: "pdf",
        pages: read.root.pipe(Option.flatMap(({ count }) => count)),
      }
    : unknownPages;
};

// An object stream's bytes in the clear, off the main thread. None when
// they do not inflate, as in an encrypted file, or inflate to more than
// `room` or `maxInflatedStream`.
const plainOf = (body: Uint8Array, room: number) =>
  Effect.tryPromise(
    async () =>
      await inflated(body, {
        maxOutputLength: Math.min(maxInflatedStream, room),
      })
  ).pipe(Effect.option);

const joined = (parts: readonly Uint8Array[], length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  let at = 0;

  for (const part of parts) {
    bytes.set(part, at);
    at += part.length;
  }

  return bytes;
};

/** What a reading found, and the most bytes of the file it held at once. */
export interface HeldReading {
  readonly mostHeld: number;
  readonly reading: PdfReading;
}

// Reads a file as its bytes arrive, holding only what the reading needs:
// a few mebibytes of the file around where it is, and the one object
// stream it inflates. Bytes before what the reading still needs are let
// go as they arrive, never queued. It stops taking bytes once the reading
// is over.
const readArriving = <E, R>(
  chunks: Stream.Stream<Uint8Array, E, R>,
  checkHeader: boolean
): Effect.Effect<HeldReading, E, R> =>
  Effect.gen(function* readingArriving() {
    const window: Window = { base: 0, bytes: new Uint8Array(0), ended: false };
    const reading = readPdf(window, checkHeader);
    let arrived: Uint8Array[] = [];
    let arrivedBytes = 0;
    let finished = false;
    let wanted = Option.none<Wanted>();
    let outcome = Option.none<PdfReading>();
    // Where the bytes the reading still needs start: what comes before is
    // dropped, from the window first, then from what arrives, so `base`
    // always names the first byte held.
    let needed = 0;
    let mostHeld = 0;

    const drop = () => {
      if (needed > window.base) {
        const cut = Math.min(needed, windowEnd(window));

        window.bytes = window.bytes.subarray(cut - window.base);
        window.base = cut;
      }

      while (
        window.bytes.length === 0 &&
        window.base < needed &&
        arrived.length > 0
      ) {
        const [first, ...rest] = arrived;

        if (first === undefined) {
          break;
        }

        const cut = Math.min(needed - window.base, first.length);

        arrivedBytes -= cut;
        window.base += cut;
        arrived = cut === first.length ? rest : [first.subarray(cut), ...rest];
      }

      mostHeld = Math.max(mostHeld, window.bytes.length + arrivedBytes);
    };

    // Joins what arrived to what is kept, once as much arrived as the
    // reading wants, or the file is over.
    const filled = (want: Wanted): boolean => {
      needed = Math.max(needed, want.keep);
      drop();

      if (!finished && windowEnd(window) + arrivedBytes < want.until) {
        return false;
      }

      window.bytes = joined(
        [window.bytes, ...arrived],
        window.bytes.length + arrivedBytes
      );
      window.ended = finished;
      arrived = [];
      arrivedBytes = 0;

      return true;
    };

    // Runs the reading until it wants more than arrived, or is over.
    const advance = Effect.gen(function* advance() {
      let given = Option.none<Uint8Array>();

      while (Option.isNone(outcome)) {
        if (Option.isSome(wanted)) {
          if (!filled(wanted.value)) {
            return;
          }

          wanted = Option.none();
        }

        const step = reading.next(given);

        given = Option.none();

        if (step.done === true) {
          outcome = Option.some(step.value);
        } else if (step.value._tag === "pause") {
          yield* Effect.yieldNow;
        } else if (step.value._tag === "inflate") {
          given = yield* plainOf(step.value.body, step.value.room);
        } else {
          wanted = Option.some(step.value);
        }
      }
    });

    yield* Stream.runForEachWhile(chunks, (chunk) => {
      arrived.push(chunk);
      arrivedBytes += chunk.length;
      drop();

      return advance.pipe(Effect.map(() => Option.isNone(outcome)));
    });

    finished = true;
    yield* advance;

    return {
      mostHeld,
      reading: Option.getOrElse(outcome, () => unknownPages),
    };
  });

/**
 * Reads a PDF as its bytes arrive, as `readPdfArriving` does, and says the
 * most of the file it held in memory at once (`mostHeld`).
 */
export const readPdfHolding = <E, R>(
  chunks: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<HeldReading, E, R> => readArriving(chunks, true);

/**
 * Reads a PDF as its bytes arrive: whether it starts as a PDF does
 * (`isPdf`, from its first 1024 bytes), then its pages, as `countPdfPages`
 * counts them, holding a few mebibytes of it at a time, never the whole
 * file (a document is up to 100 MiB). It takes no more bytes once it
 * knows.
 */
export const readPdfArriving = <E, R>(
  chunks: Stream.Stream<Uint8Array, E, R>
): Effect.Effect<PdfReading, E, R> =>
  readArriving(chunks, true).pipe(Effect.map(({ reading }) => reading));

/**
 * How many pages a PDF has, as its page tree's root says (`/Count` of the
 * node of type Pages that has no parent), read without a PDF library. The
 * root is looked for among the file's objects, those written in the clear
 * and those inside the object streams PDF 1.5 packs them in, and the one
 * written last is taken, as a file saved several times appends its new
 * objects. What strings, comments and other streams hold is never read as
 * objects, so nothing in a page's content is counted, and pages a later
 * revision rewrote are not counted twice.
 *
 * None when the count cannot be trusted: no root, a root whose count is
 * written elsewhere, an object stream that does not inflate (as in an
 * encrypted file), more object streams or larger ones than the bounds
 * above (`maxObjectStreamBytes` compressed among them), or a string, a
 * name or a comment too long to read through. The count only keeps out
 * files far past what a platform takes; without one the file is kept, for
 * the platform to judge.
 *
 * The file is read once, forward, in time that follows its size, a slice
 * at a time (`sliceBytes`): a file made to be slow to read is not, whoever
 * waits for the count can stop waiting, and the process answers its other
 * requests meanwhile. Inflating runs off the main thread, one stream at a
 * time.
 */
export const countPdfPages = (
  bytes: Uint8Array
): Effect.Effect<Option.Option<number>> =>
  readArriving(Stream.make(bytes), false).pipe(
    Effect.map(({ reading }) =>
      reading._tag === "pdf" ? reading.pages : Option.none()
    )
  );
