import { describe, expect, it } from "@effect/vitest";
import type { Schema } from "effect";

import { editGenerates } from "#assistant/domain/edit-render.ts";

const holding = (asset: Schema.Json): Schema.JsonObject => ({
  output: { aspectRatio: "16:9" },
  timeline: { tracks: [{ clips: [{ asset, length: 4, start: 0 }] }] },
});

describe("what an edit has the service generate", () => {
  it("is an asset with a prompt, or of a kind the service makes", () => {
    expect(
      [
        { src: "peal:media/synthetic", type: "image" },
        { text: "A synthetic harbour", type: "rich-text" },
        { prompt: "A synthetic sea", type: "image" },
        { text: "Hello", type: "text-to-speech", voice: "Amy" },
      ].map((asset) => editGenerates(holding(asset)))
    ).toStrictEqual([false, false, true, true]);
  });

  it("is nothing in an edit without tracks", () => {
    expect(editGenerates({})).toBeFalsy();
  });
});
