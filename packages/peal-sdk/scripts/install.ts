// How each SDK is installed, for the READMEs finish.ts writes and the docs,
// whose install lines scripts/install.test.ts holds to these. Each command
// installs the language's version exactly and writes it so in the project's
// manifest: during the beta, a range would take the next beta, which may
// change a method or a type.
import type { Language, LanguageName } from "./languages.ts";
import { isPrerelease } from "./versions.ts";

const commands = {
  dotnet: (version) => `dotnet add package Peal --version ${version}`,
  go: (version) =>
    `go get github.com/peal-social/peal/packages/peal-sdk/go@v${version}`,
  java: (version) => `social.peal:peal:${version}`,
  node: (version, name) => `npm install --save-exact ${name}@${version}`,
  php: (version) => `composer require peal-social/peal:${version}`,
  python: (version) => `pip install peal-sdk==${version}`,
  ruby: (version) => `gem install peal --version ${version}`,
  rust: (version) => `cargo add peal-sdk@=${version}`,
} satisfies Readonly<
  Record<LanguageName, (version: string, name: string) => string>
>;

/**
 * The command that installs the language's version, or for Java the
 * coordinates a Maven or Gradle build names.
 */
export const installCommand = (language: Language): string =>
  commands[language.name](language.version, language.package.name);

/** The packages a language's registry held its earlier releases under. */
const formerNames: Partial<Record<LanguageName, string>> = {
  node: "peal-sdk",
};

/** Where to find the releases published under another name, if any. */
export const formerNameNote = (language: Language): string | undefined => {
  const former = formerNames[language.name];

  return former === undefined
    ? undefined
    : `Releases 0.1 to 0.3 were published as \`${former}\`.`;
};

/**
 * What a beta means for whoever installs it, said once in each README, and
 * nothing for a release that is not a prerelease.
 */
export const betaNote = (language: Language): string | undefined =>
  isPrerelease(language.release)
    ? "The SDKs are in beta until general availability. A beta release may change a method or a type, so this installs one exact version, and your project keeps it until you change it. Releases from 0.4 call the API under `/api/v1`, and 0.1 to 0.3 the API before it, which Peal Cloud stops serving when 0.4.0-beta.1 is published."
    : undefined;
