// A release of an SDK is named in SemVer 2 (`0.4.0-beta.1`), as its tag
// is, and published under the spelling its registry gives that release.
// npm, NuGet, crates.io, Go modules, Maven Central and Composer read the
// SemVer form as a prerelease that sorts below 0.4.0 and above 0.3.x. PyPI
// reads PEP 440, whose normal form writes a beta as `0.4.0b1`, and RubyGems
// reads a version holding a letter as a prerelease and a hyphen as `.pre.`,
// so it gets `0.4.0.beta.1`. A prerelease here is a numbered alpha, beta or
// release candidate, the forms every one of those registries reads alike.
import type { LanguageName } from "./languages.ts";

const releasePattern =
  /^(?<core>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))(?:-(?<label>alpha|beta|rc)\.(?<number>0|[1-9]\d*))?$/u;

interface Release {
  readonly core: string;
  readonly prerelease?: {
    readonly label: "alpha" | "beta" | "rc";
    readonly number: string;
  };
}

const isLabel = (label: string): label is "alpha" | "beta" | "rc" =>
  label === "alpha" || label === "beta" || label === "rc";

const parse = (release: string): Release => {
  const groups = releasePattern.exec(release)?.groups;
  const core = groups?.["core"];
  const label = groups?.["label"];
  const number = groups?.["number"];

  if (core === undefined) {
    throw new Error(
      `${JSON.stringify(release)} is not a release: write it in SemVer, 0.4.0 or 0.4.0-beta.1 (alpha, beta or rc, numbered).`
    );
  }

  return label !== undefined && number !== undefined && isLabel(label)
    ? { core, prerelease: { label, number } }
    : { core };
};

export const isPrerelease = (release: string): boolean =>
  parse(release).prerelease !== undefined;

const pep440Labels = { alpha: "a", beta: "b", rc: "rc" } as const;

/** PyPI's spelling: PEP 440's normal form, `0.4.0b1`. */
export const pep440 = (release: string): string => {
  const { core, prerelease } = parse(release);

  return prerelease === undefined
    ? core
    : `${core}${pep440Labels[prerelease.label]}${prerelease.number}`;
};

/** RubyGems' spelling, with dots: `0.4.0.beta.1`. */
export const rubygems = (release: string): string => {
  const { core, prerelease } = parse(release);

  return prerelease === undefined
    ? core
    : `${core}.${prerelease.label}.${prerelease.number}`;
};

/** The SemVer spelling, checked: every other registry's. */
const semver = (release: string): string => {
  parse(release);

  return release;
};

const spellings = {
  dotnet: semver,
  go: semver,
  java: semver,
  node: semver,
  php: semver,
  python: pep440,
  ruby: rubygems,
  rust: semver,
} satisfies Readonly<Record<LanguageName, (release: string) => string>>;

/** The version a language's registry publishes a release under. */
export const registryVersion = (
  language: LanguageName,
  release: string
): string => spellings[language](release);
