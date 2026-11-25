import { describe, expect, it } from "bun:test";

import { releaseOf } from "./release-tag.ts";

const released = [
  { name: "node", release: "0.4.0-beta.1", version: "0.4.0-beta.1" },
  { name: "python", release: "0.4.0-beta.1", version: "0.4.0b1" },
  { name: "ruby", release: "0.4.0-beta.1", version: "0.4.0.beta.1" },
  { name: "java", release: "0.5.0", version: "0.5.0" },
] as const;

describe("a release tag", () => {
  it("names the language and its release, as SemVer spells it", () => {
    expect(releaseOf("sdk-node-v0.4.0-beta.1", released, true)).toEqual({
      language: "node",
      npmTag: "latest",
      version: "0.4.0-beta.1",
    });
  });

  it("gives the version as the language's registry spells it", () => {
    expect(releaseOf("sdk-python-v0.4.0-beta.1", released, true).version).toBe(
      "0.4.0b1"
    );
    expect(releaseOf("sdk-ruby-v0.4.0-beta.1", released, true).version).toBe(
      "0.4.0.beta.1"
    );
  });

  it("reads a final release", () => {
    expect(releaseOf("sdk-java-v0.5.0", released, false)).toEqual({
      language: "java",
      npmTag: "latest",
      version: "0.5.0",
    });
  });

  it("puts a prerelease on npm's latest only while the beta line is the live one", () => {
    expect(releaseOf("sdk-node-v0.4.0-beta.1", released, true).npmTag).toBe(
      "latest"
    );
    expect(releaseOf("sdk-node-v0.4.0-beta.1", released, false).npmTag).toBe(
      "next"
    );
  });

  it("refuses a registry's own spelling in the tag", () => {
    expect(() => releaseOf("sdk-python-v0.4.0b1", released, true)).toThrow(
      /scripts\/languages\.ts gives it 0\.4\.0-beta\.1/u
    );
  });

  it("refuses a release scripts/languages.ts does not give the language", () => {
    expect(() => releaseOf("sdk-node-v0.4.0-beta.2", released, true)).toThrow(
      /sdk-node-v0\.4\.0-beta\.2 releases node 0\.4\.0-beta\.2/u
    );
  });

  it.each(["v0.4.0", "sdk-node-0.4.0", "sdk-node-v", "sdk--v0.4.0"])(
    "refuses %s, which is not sdk-<language>-v<release>",
    (tag) => {
      expect(() => releaseOf(tag, released, true)).toThrow(
        /sdk-<language>-v<release>/u
      );
    }
  );

  it("refuses a language there is none of", () => {
    expect(() => releaseOf("sdk-cobol-v0.4.0", released, true)).toThrow(
      /Name a language/u
    );
  });
});
