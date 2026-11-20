// The SDKs: one folder, Nx project (peal-sdk-<name>) and registry package per
// language, generated from openapi.json by Fern's generator for the language.
// A language's version is its package's: bump it here to release it. Every
// image is pinned by digest, as the compose stack's are.
import type { Schema } from "effect";

export const repository = "https://github.com/peal-social/peal";
export const homepage = "https://peal.social";
export const contactEmail = "hello@peal.social";

export const description =
  "Client for the Peal API: schedule social media posts across platforms.";

/** A build that runs in an image, as the calling user, in the language's folder. */
interface ContainerBuild {
  readonly environment: Readonly<Record<string, string>>;
  readonly image: string;
  readonly kind: "container";
  readonly script: string;
}

/** A build that runs on this machine, with the workspace's own tools. */
interface HostBuild {
  readonly kind: "host";
  readonly script: string;
}

export type LanguageName =
  | "dotnet"
  | "go"
  | "java"
  | "node"
  | "php"
  | "python"
  | "ruby"
  | "rust";

/**
 * A Fern generator: scripts/generate.ts runs the image the digest pins, under
 * the name and version Fern asks Docker for.
 */
interface Generator {
  /** Its options, generators.yml's `config` (Fern's docs list each language's). */
  readonly config: Schema.JsonObject;
  readonly digest: string;
  readonly image: string;
  readonly version: string;
}

export interface Language {
  readonly build: ContainerBuild | HostBuild;
  readonly generator: Generator;
  /** The folder under packages/peal-sdk. */
  readonly name: LanguageName;
  /** What developers install: the registry and the package's name there. */
  readonly package: { readonly name: string; readonly registry: string };
  /**
   * The smoke test, run like the build (same image, same folder) by
   * scripts/test.ts, with PEAL_API_URL pointing at its stand-in server.
   */
  readonly test: string;
  readonly version: string;
}

const python = "0.3.0";
const node = "0.3.0";
const go = "0.3.0";
const ruby = "0.3.0";
const java = "0.3.1";
const php = "0.3.0";
const dotnet = "0.3.0";
const rust = "0.3.0";

/** Where the SDKs' source lives, for the manifests that link to it. */
export const sourceUrl = (language: LanguageName): string =>
  `${repository}/tree/main/packages/peal-sdk/${language}`;

export const languages: readonly Language[] = [
  {
    build: {
      environment: { npm_config_cache: "/cache/npm" },
      image:
        "node:26.13.1-alpine@sha256:6bd9ab43c0ec0190ca7b2d193906cb8b7edf6e7f4afa43ddeccd6452710bffb5",
      kind: "container",
      // The TypeScript and Node types the package.json names, at one version
      // each, compile the CommonJS and ES modules npm ships, as the package's
      // own build script would with pnpm.
      script:
        "rm -rf dist && npm install --silent --no-save --no-package-lock --prefix /cache/node-tools typescript@5.9.3 @types/node@20.19.43 && for build in cjs esm; do /cache/node-tools/node_modules/.bin/tsc -p tsconfig.$build.json --typeRoots /cache/node-tools/node_modules/@types --types node --extendedDiagnostics false || exit 1; done && node scripts/rename-to-esm-files.js dist/esm && node -e \"if (typeof require('./dist/cjs/index.js').PealClient !== 'function') { throw new Error('PealClient is missing'); }\"",
    },
    generator: {
      config: {
        // Fern's linter and formatter would only add development tools.
        formatter: "none",
        generateWireTests: false,
        linter: "none",
        namespaceExport: "Peal",
        // No X-Fern-* headers on Peal's requests.
        omitFernHeaders: true,
        packageJson: {
          author: `Peal <${contactEmail}>`,
          description,
          homepage,
          license: "Apache-2.0",
          // npm refuses `peal` as too close to other packages' names.
          name: "peal-sdk",
          repository: {
            directory: "packages/peal-sdk/node",
            type: "git",
            url: `git+${repository}.git`,
          },
        },
        writeUnitTests: false,
      },
      digest:
        "sha256:b3e08542a62dde026183e6daf6c853962054a45ee7ee7ae19db85e9685579d37",
      image: "fernapi/fern-typescript-sdk",
      version: "3.109.3",
    },
    name: "node",
    package: { name: "peal-sdk", registry: "npm" },
    test: "node test/smoke.mjs",
    version: node,
  },
  {
    build: {
      kind: "host",
      script: `rm -rf dist && uv build --quiet --out-dir dist && uv run --quiet --isolated --no-project --with "$(ls dist/*.whl)" python -c "import peal; from importlib.metadata import version; assert version('peal-sdk') == '${python}'"`,
    },
    generator: {
      config: {
        client: { class_name: "Peal" },
        package_name: "peal",
      },
      digest:
        "sha256:d2a292e6d071d6b2b4ff29f6422798f4bac0756a861f9d1518b31c304cf033dd",
      image: "fernapi/fern-python-sdk",
      version: "5.42.4",
    },
    name: "python",
    package: { name: "peal-sdk", registry: "PyPI" },
    test: 'uv run --quiet --isolated --no-project --with "$(ls dist/*.whl)" python smoke.py',
    version: python,
  },
  {
    build: {
      environment: {
        GOCACHE: "/cache/go/build",
        GOFLAGS: "-modcacherw",
        GOMODCACHE: "/cache/go/mod",
        GOTOOLCHAIN: "local",
      },
      image:
        "golang:1.27.3-alpine@sha256:fa3d596898d9f126af7c01d14ee7597bab3f39cccf392ef36b69fe77cd681f18",
      kind: "container",
      script: "go build ./... && go vet ./...",
    },
    generator: {
      config: {
        // Go names a module after where its source lives.
        module: { path: "github.com/peal-social/peal/packages/peal-sdk/go" },
        packageName: "peal",
      },
      digest:
        "sha256:3de43143057ccce1daaf1f85257cf5e26a510b3ac495535ede8eceb8db940d0f",
      image: "fernapi/fern-go-sdk",
      version: "1.72.3",
    },
    name: "go",
    package: {
      name: "github.com/peal-social/peal/packages/peal-sdk/go",
      registry: "Go",
    },
    // Fern's own tests call a WireMock server, which the smoke test has no
    // need of.
    test: "go test -count=1 -run TestSmoke .",
    version: go,
  },
  {
    build: {
      environment: {},
      image:
        "ruby:4.0.9@sha256:07042b74555ff2eef7365abd72d39cba6e499ab63e2d2942fd34d4778338495b",
      kind: "container",
      // custom.gemspec.rb lists the gem's files, so dist/ can wait.
      script: `rm -rf dist && gem build --silent peal.gemspec && mkdir dist && mv peal-${ruby}.gem dist/ && ruby -Ilib -e 'require "peal"; abort("wrong version") unless Peal::VERSION == "${ruby}"'`,
    },
    generator: {
      // The gem, its folder and its module take the organization's name:
      // `peal`, lib/peal.rb, Peal.
      config: {},
      digest:
        "sha256:bc0bca20f22a8a426b8e4a6a2d507169bba736658c656e6f3f498b83ef6c7d3c",
      image: "fernapi/fern-ruby-sdk",
      version: "1.45.4",
    },
    name: "ruby",
    package: { name: "peal", registry: "RubyGems" },
    test: "ruby -Ilib smoke.rb",
    version: ruby,
  },
  {
    build: {
      environment: {},
      image:
        "maven:3.10.0-eclipse-temurin-25@sha256:047a82fc82c613266cfb1b66fd920be9c8ba51fd67edc68245e4542768f45e36",
      kind: "container",
      script:
        "mvn --batch-mode --quiet -Dmaven.repo.local=/cache/m2 -DskipTests package",
    },
    generator: {
      config: {
        "client-class-name": "PealClient",
        "package-prefix": "social.peal",
      },
      digest:
        "sha256:d35ebec92670d3a3fe69e24291589cadd4d1e2b3d3eb8405c66859515f319574",
      image: "fernapi/fern-java-sdk",
      version: "4.38.9",
    },
    name: "java",
    package: { name: "social.peal:peal", registry: "Maven Central" },
    test: "mvn --batch-mode --quiet -Dmaven.repo.local=/cache/m2 -Dtest=SmokeTest -Dsurefire.failIfNoSpecifiedTests=false test",
    version: java,
  },
  {
    build: {
      environment: { COMPOSER_HOME: "/cache/composer" },
      image:
        "composer:2.11.1@sha256:8de2184c6de224f4689e8f80ed5f5edaf0030b6b8b7839a22a2bcb6722ac87d0",
      kind: "container",
      script:
        "composer validate --no-check-publish --no-check-lock --strict --quiet && composer update --no-interaction --no-progress --quiet && find src -name '*.php' -print0 | xargs -0 -n 1 php --syntax-check > /dev/null && php -r 'require \"vendor/autoload.php\"; exit(class_exists(\"Peal\\\\PealClient\") ? 0 : 1);'",
    },
    generator: {
      config: {
        clientName: "PealClient",
        namespace: "Peal",
        packageName: "peal-social/peal",
      },
      digest:
        "sha256:03570b3033fe85b9bf17b858d67fead7ccc026587fd1bb11cb3e773a476369e7",
      image: "fernapi/fern-php-sdk",
      version: "2.31.5",
    },
    name: "php",
    package: { name: "peal-social/peal", registry: "Packagist" },
    test: "php smoke.php",
    version: php,
  },
  {
    build: {
      environment: {
        DOTNET_CLI_TELEMETRY_OPTOUT: "1",
        DOTNET_NOLOGO: "1",
        NUGET_PACKAGES: "/cache/nuget",
      },
      image:
        "mcr.microsoft.com/dotnet/sdk:10.0.403@sha256:212fe4cb74627d5adf9817a4088906ae3edff1bd853bb27565d4b46731efe61e",
      kind: "container",
      script:
        "dotnet pack src/Peal/Peal.csproj --configuration Release --output dist --nologo --verbosity quiet",
    },
    generator: {
      config: {
        "client-class-name": "PealClient",
        namespace: "Peal",
        "package-id": "Peal",
      },
      digest:
        "sha256:08ac061856a02ef9455286c592b017cb5a8ce44cda6270ad8736813e0aa086d8",
      image: "fernapi/fern-csharp-sdk",
      version: "2.95.2",
    },
    name: "dotnet",
    package: { name: "Peal", registry: "NuGet" },
    test: "dotnet run --project smoke/Smoke.csproj --nologo --verbosity quiet",
    version: dotnet,
  },
  {
    build: {
      environment: { CARGO_HOME: "/cache/cargo" },
      image:
        "rust:1.99.1-slim@sha256:f6c4a35d21dbb3c89d7a8d056c193e94fc09037f2b58dd858b09c39a47dd02d7",
      kind: "container",
      script:
        "cargo build --quiet && cargo package --quiet --allow-dirty --no-verify",
    },
    generator: {
      config: {
        clientClassName: "PealClient",
        crateName: "peal-sdk",
        packageDescription: description,
        packageDocumentation: "https://docs.rs/peal-sdk",
        packageLicense: "Apache-2.0",
        packageRepository: repository,
        // crates.io names the crate peal-sdk, and the code imports peal_sdk.
        preserveCrateNameHyphens: true,
      },
      digest:
        "sha256:f467083aa8bab09379d29a542070520ab6803bf234c6925d8527c87001d3af49",
      image: "fernapi/fern-rust-sdk",
      version: "0.53.9",
    },
    name: "rust",
    package: { name: "peal-sdk", registry: "crates.io" },
    test: "cargo run --quiet --example smoke",
    version: rust,
  },
];

export const languageNamed = (name: string | undefined): Language => {
  const language = languages.find((candidate) => candidate.name === name);

  if (language === undefined) {
    throw new Error(
      `Name a language: ${languages.map((candidate) => candidate.name).join(", ")}`
    );
  }

  return language;
};
