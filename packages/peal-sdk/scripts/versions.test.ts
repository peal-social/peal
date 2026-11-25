import { describe, expect, it } from "bun:test";

import { languages } from "./languages.ts";
import { isPrerelease, pep440, registryVersion, rubygems } from "./versions.ts";

describe("a release as PyPI spells it (PEP 440's normal form)", () => {
  it("writes a beta as b and its number, with no separator", () => {
    expect(pep440("0.4.0-beta.1")).toBe("0.4.0b1");
  });

  it("writes an alpha as a, a release candidate as rc", () => {
    expect(pep440("1.2.3-alpha.4")).toBe("1.2.3a4");
    expect(pep440("1.2.3-rc.12")).toBe("1.2.3rc12");
  });

  it("leaves a final release as it is", () => {
    expect(pep440("0.4.0")).toBe("0.4.0");
  });
});

describe("a release as RubyGems spells it", () => {
  it("writes a beta with dots, which RubyGems reads as a prerelease", () => {
    expect(rubygems("0.4.0-beta.1")).toBe("0.4.0.beta.1");
  });

  it("leaves a final release as it is", () => {
    expect(rubygems("0.4.0")).toBe("0.4.0");
  });
});

describe("what a release may be called", () => {
  it.each([
    "0.4.0b1",
    "0.4.0.beta.1",
    "v0.4.0",
    "0.4.0-beta",
    "0.4.0-pre.1",
    "0.4",
  ])(
    "refuses %s, which is not a SemVer release or a numbered alpha, beta or rc",
    (release) => {
      expect(() => pep440(release)).toThrow(/SemVer/u);
      expect(() => rubygems(release)).toThrow(/SemVer/u);
    }
  );

  it("knows a prerelease from a final release", () => {
    expect(isPrerelease("0.4.0-beta.1")).toBe(true);
    expect(isPrerelease("0.4.0")).toBe(false);
  });
});

describe("each language's version", () => {
  it.each(languages.map((language) => [language.name, language] as const))(
    "is %s's registry spelling of its release",
    (_name, language) => {
      expect(language.version).toBe(
        registryVersion(language.name, language.release)
      );
    }
  );
});
