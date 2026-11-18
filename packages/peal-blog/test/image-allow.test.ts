// The image endpoint serves the transforms the blog's pages handed out
// alone, so varying a parameter can neither miss the edge's cache nor make
// the server resize an image again.
import { describe, expect, it } from "vitest";

import { imageRefused, imageRoute } from "../src/guard.ts";
import { transformKey, transformRegistry } from "../src/image-allow.ts";

const handed =
  "/blog/_image?href=https%3A%2F%2Fsynthetic.test%2F_emdash%2Fapi%2Fmedia%2Ffile%2F01SYNTHETIC.png&w=640&h=427&f=webp&fit=cover&position=center";

const request = (url: string) => new URL(url, "https://synthetic.test");

describe("the transforms a page handed out", () => {
  it("are served, whatever the order of their parameters", () => {
    const registry = transformRegistry();
    registry.add(handed);

    const reordered = request(handed);
    const entries = [...reordered.searchParams.entries()].toReversed();

    expect(imageRefused(request(handed), "/blog", registry)).toBe(false);
    expect(
      imageRefused(
        request(`/blog/_image?${new URLSearchParams(entries).toString()}`),
        "/blog",
        registry
      )
    ).toBe(false);
  });

  it.each([
    ["another width", "w=641"],
    ["another height", "h=428"],
    ["a quality", "q=1"],
    ["another format", "f=avif"],
    ["another fit", "fit=fill"],
    ["a parameter of its own", "cache=bust"],
  ])("refuse %s", (_name, change) => {
    const registry = transformRegistry();
    registry.add(handed);

    const [name = "", value = ""] = change.split("=");
    const url = request(handed);
    url.searchParams.set(name, value);

    expect(imageRefused(url, "/blog", registry)).toBe(true);
  });

  it("are none on a server that rendered no page", () => {
    expect(imageRefused(request(handed), "/blog", transformRegistry())).toBe(
      true
    );
  });

  it("leave every other path alone", () => {
    const registry = transformRegistry();

    expect(imageRefused(request("/blog/a-post?w=1"), "/blog", registry)).toBe(
      false
    );
    expect(
      imageRefused(request("/_emdash/api/media/file/a.png"), "/blog", registry)
    ).toBe(false);
  });

  it("forget the oldest past their limit", () => {
    const registry = transformRegistry(2);

    registry.add("/blog/_image?w=1");
    registry.add("/blog/_image?w=2");
    registry.add("/blog/_image?w=3");

    expect(registry.has(new URLSearchParams("w=1"))).toBe(false);
    expect(registry.has(new URLSearchParams("w=3"))).toBe(true);
  });
});

describe("the image endpoint", () => {
  it("is under the base, or at the root without one", () => {
    expect(imageRoute("/blog")).toBe("/blog/_image");
    expect(imageRoute("/blog/")).toBe("/blog/_image");
    expect(imageRoute("/")).toBe("/_image");
  });

  it("reads a query in one spelling", () => {
    expect(transformKey(new URLSearchParams("w=1&f=webp"))).toBe(
      transformKey(new URLSearchParams("f=webp&w=1"))
    );
  });
});
