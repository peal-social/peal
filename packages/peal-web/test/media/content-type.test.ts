import { MediaContentTypeSchema } from "peal-contract";
import { describe, expect, it } from "vitest";

import { declaredTypeOf, pickerAccept } from "#media/content-type.ts";

describe(declaredTypeOf, () => {
  it.each([
    ["audio/x-wav", "audio/wav"],
    ["audio/wave", "audio/wav"],
    ["audio/vnd.wave", "audio/wav"],
    ["audio/x-m4a", "audio/mp4"],
    ["audio/mp3", "audio/mpeg"],
    ["AUDIO/X-WAV", "audio/wav"],
  ])("declares %s as %s", (browserType, declared) => {
    expect(declaredTypeOf(browserType)).toBe(declared);
  });

  it("keeps every type the API takes, and any other, as it is", () => {
    for (const type of MediaContentTypeSchema.literals) {
      expect(declaredTypeOf(type)).toBe(type);
    }

    expect(declaredTypeOf("text/plain")).toBe("text/plain");
  });

  it("declares only types the API takes for the aliases it offers", () => {
    const taken = new Set<string>(MediaContentTypeSchema.literals);

    for (const type of pickerAccept.split(",")) {
      expect(taken.has(declaredTypeOf(type))).toBeTruthy();
    }
  });
});
