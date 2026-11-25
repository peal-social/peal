// A release tag, sdk-<language>-v<release>, names the release in SemVer
// (`sdk-python-v0.4.0-beta.1`), whatever the registry's spelling. It must
// be the release scripts/languages.ts gives the language, so a tag never
// publishes a package whose manifest says another version.
import { isPrerelease } from "./versions.ts";

interface Released {
  readonly name: string;
  /** The release, in SemVer. */
  readonly release: string;
  /** The version as the language's registry spells the release. */
  readonly version: string;
}

export interface ReleaseOfTag {
  readonly language: string;
  /** The dist-tag npm publishes the release under. */
  readonly npmTag: "latest" | "next";
  readonly version: string;
}

const tagPattern = /^sdk-(?<language>[a-z]+)-v(?<release>[\d.A-Za-z-]+)$/u;

export const releaseOf = (
  tag: string,
  languages: readonly Released[],
  prereleasesAreLatest: boolean
): ReleaseOfTag => {
  const groups = tagPattern.exec(tag)?.groups;
  const name = groups?.["language"];
  const release = groups?.["release"];

  if (name === undefined || release === undefined) {
    throw new Error(
      `A release tag reads sdk-<language>-v<release>, the release in SemVer (sdk-python-v0.4.0-beta.1), not "${tag}".`
    );
  }

  const language = languages.find((candidate) => candidate.name === name);

  if (language === undefined) {
    throw new Error(
      `Name a language: ${languages.map((candidate) => candidate.name).join(", ")}`
    );
  }

  if (language.release !== release) {
    throw new Error(
      `${tag} releases ${language.name} ${release}, but scripts/languages.ts gives it ${language.release}: change it there, regenerate, and tag that commit.`
    );
  }

  return {
    language: language.name,
    npmTag: prereleasesAreLatest || !isPrerelease(release) ? "latest" : "next",
    version: language.version,
  };
};
