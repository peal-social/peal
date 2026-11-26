import type { ChannelId, MediaAssetId } from "#shared/domain/ids.ts";
import {
  bodyImagesOf,
  bodyMediaOf,
  bodyWithout,
  maxAltTextLength,
  maxLinkLength,
  textOfBody,
} from "#shared/domain/rich-text/rich-body.ts";
import type {
  ArticleBody,
  Block,
  Inline,
} from "#shared/domain/rich-text/rich-body.ts";

import { MediaAttachment } from "./media-attachment.ts";
import { maxPostTextLength } from "./post-text.ts";
import { TextOverride } from "./text-override.ts";
import { xLinksIn } from "./x-links.ts";

/**
 * The body's images as a channel's media: each file once, in the order it
 * first shows, with the description its first image gives it.
 */
export const bodyAttachmentsOf = (
  body: ArticleBody
): readonly MediaAttachment[] => {
  const seen = new Set<string>();

  return bodyImagesOf(body).flatMap(({ attrs }) => {
    if (seen.has(attrs.mediaId)) {
      return [];
    }

    seen.add(attrs.mediaId);

    return [
      new MediaAttachment({ altText: attrs.alt, mediaId: attrs.mediaId }),
    ];
  });
};

/**
 * A channel's own text as a rich text (a website's): the body, with its
 * plain text as the override's `text` (`textOfBody`, cut at
 * `maxPostTextLength`) and its images, in order, as its `media`, so every
 * reader of a channel's text and media reads the body's. Every write of a
 * body goes through it.
 */
export const richOverride = (
  channelId: ChannelId,
  body: ArticleBody
): TextOverride =>
  new TextOverride({
    body,
    channelId,
    media: bodyAttachmentsOf(body),
    text: textOfBody(body, maxPostTextLength),
  });

// The text cut at `maximum` UTF-16 code units, never inside a character.
const wellFormedCut = (text: string, maximum: number) => {
  const cut = text.slice(0, maximum);

  return cut.isWellFormed() ? cut : cut.slice(0, -1);
};

const hasScheme = (address: string) => /^https?:\/\//iu.test(address);

const isLinkable = (address: string) => {
  const url = URL.parse(address);

  return (
    url !== null &&
    (url.protocol === "http:" || url.protocol === "https:") &&
    address.length <= maxLinkLength
  );
};

// One line of text, its `http://` and `https://` addresses as links,
// found as `linksToShorten` finds them.
const lineNodes = (line: string): readonly Inline[] => {
  const nodes: Inline[] = [];
  let from = 0;

  for (const { end, start } of xLinksIn(line)) {
    const address = line.slice(start, end);

    if (hasScheme(address) && isLinkable(address)) {
      if (start > from) {
        nodes.push({ text: line.slice(from, start), type: "text" });
      }

      nodes.push({
        marks: [{ attrs: { href: address }, type: "link" }],
        text: address,
        type: "text",
      });
      from = end;
    }
  }

  if (from < line.length) {
    nodes.push({ text: line.slice(from), type: "text" });
  }

  return nodes;
};

// A block of text as a paragraph, a hard break per line break.
const paragraphOf = (block: string): Block => ({
  content: block
    .split("\n")
    .flatMap((line, index): readonly Inline[] =>
      index === 0
        ? lineNodes(line)
        : [{ type: "hardBreak" }, ...lineNodes(line)]
    ),
  type: "paragraph",
});

/**
 * The body a website gets of a post that has none of its own there: a
 * paragraph per block of its text (blocks a blank line apart), a hard
 * break per line break, each `http://` or `https://` address a link, then
 * its images, in order, each with its description.
 */
export const bodyOfText = (
  text: string,
  media: readonly MediaAttachment[]
): ArticleBody => ({
  content: [
    ...text
      .replaceAll("\r\n", "\n")
      .split(/\n[\t ]*\n/u)
      .map((block) => block.replaceAll(/^\n+|\n+$/gu, ""))
      .filter((block) => block.trim() !== "")
      .map(paragraphOf),
    ...media.map(({ altText, mediaId }): Block => ({
      attrs: { alt: wellFormedCut(altText, maxAltTextLength), mediaId },
      type: "image",
    })),
  ],
  type: "doc",
});

/**
 * The rich text with only the files `keep` answers true for: each image of
 * another becomes an empty paragraph (`bodyWithout`), made again into the
 * channel's override (`richOverride`).
 */
export const richOverrideKeeping = (
  channelId: ChannelId,
  body: ArticleBody,
  keep: (mediaId: MediaAssetId) => boolean
): TextOverride => {
  let kept = body;

  for (const mediaId of bodyMediaOf(body)) {
    if (!keep(mediaId)) {
      kept = bodyWithout(kept, mediaId);
    }
  }

  return richOverride(channelId, kept);
};
