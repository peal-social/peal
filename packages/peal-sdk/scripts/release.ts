// Reads a release tag, sdk-<language>-v<release>:
// `bun scripts/release.ts sdk-python-v0.4.0-beta.1`. It refuses a tag whose
// release is not the one scripts/languages.ts gives the language
// (scripts/release-tag.ts). In GitHub Actions, it hands the language, the
// version as its registry spells it (0.4.0b1 for PyPI) and npm's dist-tag to
// the next steps.
import { appendFile } from "node:fs/promises";

import { languages, prereleasesAreLatest } from "./languages.ts";
import { releaseOf } from "./release-tag.ts";

const { language, npmTag, version } = releaseOf(
  Bun.argv[2] ?? "",
  languages,
  prereleasesAreLatest
);

const outputs = process.env["GITHUB_OUTPUT"];

if (outputs !== undefined) {
  await appendFile(
    outputs,
    `language=${language}\nversion=${version}\nnpm-tag=${npmTag}\n`
  );
}

process.stdout.write(`${language} ${version} (npm: ${npmTag})\n`);
