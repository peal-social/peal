import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { emailAssets } from "../src/index.ts";

// How each kind of file starts.
const starts = { "image/gif": "474946383961", "image/png": "89504e470d0a1a0a" };

describe("the emails' assets", () => {
  it("are the files the server serves, whose names never change", () => {
    expect([...emailAssets.keys()]).toStrictEqual([
      "footer.png",
      "header.gif",
      "header.png",
      "mark.png",
    ]);
  });

  it("are every file of their folder", () => {
    expect(
      readdirSync(path.join(import.meta.dirname, "../src/assets")).toSorted()
    ).toStrictEqual([...emailAssets.keys()]);
  });

  it.each([...emailAssets])("%s is of its type", (_, asset) => {
    const start = starts[asset.contentType];

    expect(Buffer.from(asset.bytes).toString("hex", 0, start.length / 2)).toBe(
      start
    );
  });
});
