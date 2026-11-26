import { Effect, FileSystem, Option, Path } from "effect";
import { Flag } from "effect/cli";
import type { Definition, Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { Extension } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm } from "micromark-extension-gfm";
import type { TextOverride } from "peal-contract";
import { maxBodyMarkdownLength } from "peal-contract/post-text";

import {
  cannotRead,
  importAddress,
  isAddress,
  statusOf,
  uploadFile,
} from "#media-files.ts";
import type { MediaDestination } from "#media-files.ts";
import { Refused } from "#refused.ts";

// A website's body written as a Markdown file. The file is read before any
// request and never printed; the server reads it into the rich text, and
// takes an image as a file of the library alone (`media:<id>`), so the
// images the file names by a path or an https address are stored first,
// as `--media` stores one, and written as their media in what is sent.
// The file is parsed as the server parses it (CommonMark with GitHub's
// extensions, by the same parser) to find its images' places; GitHub's
// tree transforms are left out, as they link bare addresses and visit the
// tree recursively, which a deep file would overflow.

/** `--markdown <channel-id>=<file>`, repeated: a website's body, as Markdown. */
export const markdownFlag = (description: string) =>
  Flag.String("markdown").pipe(
    Flag.withMetavar("<channel-id>=<file>"),
    Flag.withDescription(description),
    Flag.atLeast(0)
  );

/** A Markdown file, read, for a channel or an edit. */
export interface MarkdownFile {
  /** The folder its relative images are read from. */
  readonly folder: string;
  readonly markdown: string;
  readonly name: string;
}

/** Reads a Markdown file whole, checked against the body's bound. */
export const readMarkdownFile = (given: string) =>
  Effect.gen(function* reading() {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = path.resolve(given);

    const markdown = yield* fs
      .readFileString(file)
      .pipe(Effect.mapError(cannotRead(given)));

    if (markdown.length > maxBodyMarkdownLength) {
      return yield* new Refused({
        reason: `${given} holds more than a website's body may: ${String(maxBodyMarkdownLength)} characters at most. Nothing was sent.`,
      });
    }

    const read: MarkdownFile = {
      folder: path.dirname(file),
      markdown,
      name: given,
    };

    return read;
  });

/** `--markdown <channel-id>=<file>`, its file read. */
export const markdownOf = (given: string) =>
  Effect.gen(function* parse() {
    const at = given.indexOf("=");

    if (at <= 0 || at === given.length - 1) {
      return yield* new Refused({
        reason: `--markdown takes <channel-id>=<file>, not ${given}.`,
      });
    }

    return {
      channelId: given.slice(0, at),
      file: yield* readMarkdownFile(given.slice(at + 1)),
    };
  });

const gfmHandlers: Extension[] = gfmFromMarkdown().map(
  ({ transforms: _transforms, ...handlers }) => handlers
);

const mediaPrefix = "media:";

// An address with a scheme of its own: never a file's path.
const schemed = /^[a-z][a-z\d+.-]*:/iu;

/** Where an image's address leads: a file to upload, or one to import. */
type Source =
  | { readonly _tag: "address"; readonly url: string }
  | { readonly _tag: "file"; readonly path: string };

const sourceOf = (url: string): Option.Option<Source> => {
  if (url === "" || url.startsWith(mediaPrefix)) {
    return Option.none();
  }

  if (isAddress(url)) {
    return Option.some({ _tag: "address", url });
  }

  if (schemed.test(url) || url.startsWith("//")) {
    return Option.none();
  }

  try {
    return Option.some({ _tag: "file", path: decodeURI(url) });
  } catch {
    return Option.some({ _tag: "file", path: url });
  }
};

/** What of the file names an image to store, and where it is written. */
interface ImageAt {
  /** The alt text, as the image reads, when it is an image of its own. */
  readonly alt?: string;
  readonly end: number;
  /** The definition's label, when the place is a definition's. */
  readonly label?: string;
  readonly source: Source;
  readonly start: number;
}

// Where a node is in the file, by offset, when the parser says.
const spanOf = (node: Nodes | undefined) => {
  const start = node?.position?.start.offset;
  const end = node?.position?.end.offset;

  return start === undefined || end === undefined
    ? Option.none()
    : Option.some({ end, start });
};

// An image of its own, `![alt](url)`, as a place to write, when its
// address names a file or an https address.
const imagePlace = (node: Nodes): Option.Option<ImageAt> =>
  node.type === "image"
    ? Option.all({ source: sourceOf(node.url), span: spanOf(node) }).pipe(
        Option.map(({ source, span }) => ({
          ...span,
          alt: node.alt ?? "",
          source,
        }))
      )
    : Option.none();

// The definition an image reference reads, `[label]: url`, as a place.
const definitionPlace = (
  definition: Definition | undefined
): Option.Option<ImageAt> =>
  definition === undefined
    ? Option.none()
    : Option.all({
        source: sourceOf(definition.url),
        span: spanOf(definition),
      }).pipe(
        Option.map(({ source, span }) => ({
          ...span,
          label: definition.label ?? definition.identifier,
          source,
        }))
      );

// The places an image to store is written: an image's own `![alt](url)`,
// or the definition an image reference reads (`[label]: url`). Found
// without recursion.
const imagesAt = (markdown: string): readonly ImageAt[] => {
  const root = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: gfmHandlers,
  });

  const definitions = new Map<string, Definition>();
  const referenced = new Set<string>();
  const found: ImageAt[] = [];
  const waiting: Nodes[] = [root];

  for (let next = waiting.pop(); next !== undefined; next = waiting.pop()) {
    if (next.type === "definition" && !definitions.has(next.identifier)) {
      definitions.set(next.identifier, next);
    }

    if (next.type === "imageReference") {
      referenced.add(next.identifier);
    }

    found.push(...Option.toArray(imagePlace(next)));

    if ("children" in next) {
      waiting.push(...next.children);
    }
  }

  for (const identifier of referenced) {
    found.push(...Option.toArray(definitionPlace(definitions.get(identifier))));
  }

  return found.toSorted((left, right) => left.start - right.start);
};

/** How many images the file names that would have to be stored. */
export const imagesToStore = (file: MarkdownFile): number =>
  imagesAt(file.markdown).length;

// Characters an alt text or a label holds that Markdown would read.
const escaped = (text: string) => text.replaceAll(/[\\[\]]/gu, "\\$&");

/**
 * The file's Markdown with each image it names by a path (from the file's
 * folder) or an https address stored first as media of the workspace,
 * once each, and written `media:<id>`: a file uploaded, an address the
 * server imports. Only ready media go in a body.
 */
export const withImagesStored = (
  destination: MediaDestination,
  file: MarkdownFile
) =>
  Effect.gen(function* storing() {
    const path = yield* Path.Path;
    const stored = new Map<string, string>();
    const places = imagesAt(file.markdown);
    let { markdown } = file;

    const mediaOf = (source: Source, alt: string) =>
      Effect.gen(function* mediaFor() {
        // A file once, however the file spells its path.
        const local = path.resolve(
          file.folder,
          source._tag === "file" ? source.path : ""
        );

        const key = source._tag === "address" ? source.url : local;
        const known = stored.get(key);

        if (known !== undefined) {
          return known;
        }

        const altText = alt === "" ? Option.none() : Option.some(alt);

        const media = yield* source._tag === "address"
          ? importAddress(destination, source.url, altText)
          : uploadFile(destination, local, altText);

        if (media.status._tag !== "ready") {
          return yield* new Refused({
            reason: `An image of ${file.name} is stored as media ${media.id}, but cannot go in a post (${statusOf(media)}): nothing was posted.`,
          });
        }

        stored.set(key, media.id);

        return media.id;
      });

    // Stored in the order the file names them.
    const ids: string[] = [];

    for (const place of places) {
      ids.push(yield* mediaOf(place.source, place.alt ?? ""));
    }

    // Written from the last place to the first, so each place's offsets
    // still hold.
    for (const [index, place] of places.entries().toArray().toReversed()) {
      const mediaId = ids[index] ?? "";

      const written =
        place.label === undefined
          ? `![${escaped(place.alt ?? "")}](${mediaPrefix}${mediaId})`
          : `[${escaped(place.label)}]: ${mediaPrefix}${mediaId}`;

      markdown = `${markdown.slice(0, place.start)}${written}${markdown.slice(place.end)}`;
    }

    return markdown;
  });

/** A channel's body, from its file, as it is to be sent. */
export interface MarkdownBody {
  readonly channelId: string;
  readonly file: MarkdownFile;
  readonly markdown: string;
}

/**
 * Each `--markdown <channel-id>=<file>`, its file read. With --dry-run,
 * which stores nothing, a file names its images by media id only.
 */
export const bodiesOf = (given: readonly string[], dryRun: boolean) =>
  Effect.all(
    given.map((flag) =>
      Effect.gen(function* readingBody() {
        const { channelId, file } = yield* markdownOf(flag);

        if (dryRun && imagesToStore(file) > 0) {
          return yield* new Refused({
            reason: `With --dry-run, ${file.name} names its images by media id only, as ![alt](media:<media-id>): uploading a file or importing an address would store it. Store it first with peal media upload or peal media import, or leave out --dry-run.`,
          });
        }

        const body: MarkdownBody = { channelId, file, markdown: file.markdown };

        return body;
      })
    )
  );

/** The bodies with the images their files name stored first. */
export const storedBodies = (
  destination: MediaDestination,
  bodies: readonly MarkdownBody[]
) =>
  Effect.all(
    bodies.map((body) =>
      withImagesStored(destination, body.file).pipe(
        Effect.map((markdown): MarkdownBody => ({ ...body, markdown }))
      )
    ),
    // One body after the other: a file's images are stored in order.
    { concurrency: 1 }
  );

/** The bodies as the overrides a post sends: Markdown on each channel. */
export const markdownOverrides = (
  bodies: readonly MarkdownBody[]
): TextOverride[] =>
  bodies.map(({ channelId, markdown }) => ({
    bodyMarkdown: markdown,
    channelId,
    text: "",
  }));
