// The image endpoint takes the requests Astro builds for the pages' images
// alone, so varying a parameter can neither miss the edge's cache nor make
// the server resize again.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  imageFormats,
  imageQueryTaken,
  imageRefused,
  imageRoute,
  isImageRoute,
  largestDimension,
} from "../src/image-request.ts";

const origin = "https://synthetic.test";

const source = `${origin}/_emdash/api/media/file/01SYNTHETICKEY.png`;

// As a page writes it (the production build's markup, &amp; aside).
const written = `/blog/_image?href=${encodeURIComponent(source)}&w=640&h=427&f=webp&fit=cover&position=center`;

const request = (target: string) => new URL(target, origin);

const changed = (name: string, value: string | undefined) => {
  const url = request(written);

  if (value === undefined) {
    url.searchParams.delete(name);
  } else {
    url.searchParams.set(name, value);
  }

  return url;
};

describe("the image requests the blog takes", () => {
  it("takes one a page writes", () => {
    expect(imageRefused(request(written), "/blog")).toBe(false);
  });

  it.each([
    ["no size", "w", undefined],
    ["no format", "f", undefined],
    ["the largest width", "w", String(largestDimension)],
    ["another format Astro outputs", "f", "avif"],
    ["another fit", "fit", "contain"],
    ["a position in two words", "position", "top left"],
    [
      "a source with its content hash",
      "href",
      `${source}?_emdash_media=sha1:${"0".repeat(40)}`,
    ],
    [
      "a source on the same origin, without it",
      "href",
      "/_emdash/api/media/file/01SYNTHETICKEY.png",
    ],
  ])("takes %s", (_name, name, value) => {
    expect(imageRefused(changed(name, value), "/blog")).toBe(false);
  });

  it.each([
    ["a parameter of its own", "cache", "bust"],
    ["a quality, which no page sets", "q", "50"],
    ["a background", "background", "red"],
    ["a width past the largest", "w", String(largestDimension + 1)],
    ["a width that is not a whole number", "w", "640.5"],
    ["a width with a sign", "w", "+640"],
    ["a width with a leading zero", "w", "0640"],
    ["a zero height", "h", "0"],
    ["a format Astro does not output", "f", "gif"],
    ["a fit Astro does not write", "fit", "outside"],
    ["a position of its own", "position", "50% 50%"],
    ["no source", "href", undefined],
    ["a source elsewhere", "href", `${origin}/blog/a-post`],
    [
      "a source under the media files, past them",
      "href",
      `${origin}/_emdash/api/media/file/a/../../setup`,
    ],
    ["a source with a query of its own", "href", `${source}?v=2`],
    ["a source with a hash of its own", "href", `${source}?_emdash_media=x`],
  ])("refuses %s", (_name, name, value) => {
    expect(imageRefused(changed(name, value), "/blog")).toBe(true);
  });

  it("refuses a parameter given twice", () => {
    const url = request(written);
    url.searchParams.append("w", "640");

    expect(imageRefused(url, "/blog")).toBe(true);
  });

  it.each(["/blog/_image/", "/blog/_image//"])(
    "refuses the endpoint spelled %s",
    (pathname) => {
      const url = request(written);
      url.pathname = pathname;

      expect(isImageRoute(url.pathname, "/blog")).toBe(true);
      expect(imageRefused(url, "/blog")).toBe(true);
    }
  );

  it("leaves every other path alone", () => {
    expect(imageRefused(request("/blog/a-post?w=1"), "/blog")).toBe(false);
    expect(imageQueryTaken(request("/blog/_image?w=1"))).toBe(false);
  });

  it("finds the endpoint under the base, or at the root without one", () => {
    expect(imageRoute("/blog")).toBe("/blog/_image");
    expect(imageRoute("/blog/")).toBe("/blog/_image");
    expect(imageRoute("/")).toBe("/_image");
  });
});

describe("the formats the blog takes", () => {
  it("are the ones Astro outputs", () => {
    const consts = readFileSync(
      path.join(
        import.meta.dirname,
        "../node_modules/astro/dist/assets/consts.js"
      ),
      "utf-8"
    );

    const list = /VALID_OUTPUT_FORMATS = \[(?<list>[^\]]*)\]/u.exec(consts)
      ?.groups?.["list"];

    expect(
      [...(list ?? "").matchAll(/"(?<format>\w+)"/gu)]
        .map((match) => match.groups?.["format"] ?? "")
        .toSorted()
    ).toStrictEqual([...imageFormats].toSorted());
  });
});
