# Peal SDKs

Clients for the [Peal API](https://peal.social) in eight languages, generated
from the contract (`packages/peal-contract`) by
[Fern](https://github.com/fern-api/fern)'s open-source generators, and
published to each language's registry.

| Language              | Folder             | Registry                                                                          | Install                                                                 |
| --------------------- | ------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| TypeScript/JavaScript | [`node`](node)     | [npm](https://www.npmjs.com/package/peal-sdk)                                     | `npm install --save-exact peal-sdk@0.4.0-beta.1`                        |
| Python                | [`python`](python) | [PyPI](https://pypi.org/project/peal-sdk/)                                        | `pip install peal-sdk==0.4.0b1` (imported as `peal`)                    |
| Go                    | [`go`](go)         | [Go modules](https://pkg.go.dev/github.com/peal-social/peal/packages/peal-sdk/go) | `go get github.com/peal-social/peal/packages/peal-sdk/go@v0.4.0-beta.1` |
| Ruby                  | [`ruby`](ruby)     | [RubyGems](https://rubygems.org/gems/peal)                                        | `gem install peal --version 0.4.0.beta.1`                               |
| Java                  | [`java`](java)     | [Maven Central](https://central.sonatype.com/artifact/social.peal/peal)           | `social.peal:peal:0.4.0-beta.1`                                         |
| PHP                   | [`php`](php)       | [Packagist](https://packagist.org/packages/peal-social/peal)                      | `composer require peal-social/peal:0.4.0-beta.1`                        |
| .NET                  | [`dotnet`](dotnet) | [NuGet](https://www.nuget.org/packages/Peal)                                      | `dotnet add package Peal --version 0.4.0-beta.1`                        |
| Rust                  | [`rust`](rust)     | [crates.io](https://crates.io/crates/peal-sdk)                                    | `cargo add peal-sdk@=0.4.0-beta.1`                                      |

The SDKs are in beta until general availability, on 0.4.0-beta.N, which each
registry spells its own way (`0.4.0b1` on PyPI, `0.4.0.beta.1` on RubyGems).
A beta release may change a method or a type, so each command installs one
exact version, and your project keeps it until you change it. Releases 0.1 to
0.3 call an API that is gone.

Each folder's README shows how to use it, and its `reference.md` lists every
operation. The docs' [SDKs page](https://docs.peal.social/developers/sdks) starts you:
checking the credential, a post from start to finish, errors, pages, and
verifying a webhook in each language. In TypeScript:

```ts
import { PealClient } from "peal-sdk";

const peal = new PealClient({ token: process.env.PEAL_API_KEY });
const credential = await peal.credential.get();
```

Every SDK names its operations after the contract's (`peal.posts.schedule`),
raises a typed error for each error status (a refused token is an
`UnauthorizedError`), and retries, with backoff, a GET, a PUT or a DELETE the
API answers with 408, 429 or a 5xx. It never sends a POST or a PATCH twice:
the first may have created the post before its answer was lost.

## What they call

Every operation a bearer token can call: a workspace API key (`peal_…`) or an
OAuth access token, plus the health checks. The operations that answer only
the person in their own session (exporting or deleting an account, connected
applications, deleting a workspace), the staff console, the platforms'
callbacks and the browser's own endpoints are left out. Some operations also
refuse API keys and want a member's token, such as listing members; each one's
description says so.

They send requests to `https://app.peal.social` unless told otherwise: point
them at your own server's address when you self-host.

## How they are made

`bun run sdk:generate` regenerates every SDK, and needs Docker:

1. `peal-sdk:spec` (`scripts/spec.ts`) writes `openapi.json` from the
   contract's: the operations above, the schemas they use, and the license,
   contact and server the packages carry. It gives each tagged union a
   discriminator and a schema per variant (`ChannelStatusDisabled`), each
   operation its SDK name, from its operationId, and each POST and PATCH no
   retries.
2. Each `peal-sdk-<language>:sdk:generate` (`scripts/generate.ts`) runs Fern's
   CLI (`fern-api`, a dependency of the workspace) on that document, with the
   language's generator in Docker, from the image `scripts/languages.ts` pins
   by digest. Fern replaces the folder with what it writes, keeping the files
   its `.fernignore` names. The script then copies `LICENSE` and `NOTICE` in,
   which every package carries, and fills what the generator leaves out of the
   package's manifest (`scripts/finish.ts`).

`scripts/languages.ts` holds each language's generator (image, version,
digest, options), version and build, and pins every image by digest. Bump a
language's version there to release it.

`bun run sdk:build` builds each SDK as its registry would receive it, then
loads it: Python with uv, the others in their language's image, as you, with
their downloads cached in `.cache/sdk`. Java builds with Maven, from the
`pom.xml` `finish.ts` writes with the dependencies of Fern's Gradle build. `bun run sdk:check` regenerates every SDK and fails when the
result differs from the repository, as CI does.

`bun run sdk:test` runs each SDK's smoke test after its build: `scripts/test.ts`
serves a stand-in API on this machine (containers reach it as
`host.docker.internal`), and the test calls the health check, then the
signed-in user with the bearer token `peal_test`, as the SDK's users would,
and last with a token the stand-in refuses, which must raise the SDK's 401
error. It passes when the answer decodes as expected (its nulls and enum
included) and the stand-in saw both calls with that token.

Never edit a generated file: change the contract, the scripts or the
generator's options, and regenerate. The files a folder's `.fernignore`
names are ours, and Fern leaves them alone: `project.json`, the smoke test,
and the hooks Ruby's gemspec and .NET's project load (`custom.gemspec.rb`,
`Peal.Custom.props`).

## Releasing

Each SDK is released on its own, from a tag:

1. Bump the language's release in `scripts/languages.ts`, in SemVer
   (`0.4.0-beta.2`), run `bun run sdk:generate`, change the install lines
   in the docs' SDKs page (English and French), its quickstart and the table
   above (`scripts/install.test.ts` fails until they match), and merge the
   change.
2. Tag that commit `sdk-<language>-v<release>`, the release in SemVer
   whatever the registry's spelling, and push the tag:
   `git tag sdk-python-v0.4.0-beta.2 && git push origin sdk-python-v0.4.0-beta.2`.
   Push at most three tags at once: GitHub starts no workflow for a push of
   more.

The `SDK release` workflow (`.github/workflows/sdk-release.yml`) refuses a
tag whose release differs from `scripts/languages.ts`
(`scripts/release-tag.ts`), builds the SDK from the tagged commit, and
publishes it in the `sdk-release` environment, under the version as its
registry spells the release (`scripts/versions.ts`): PEP 440's `0.4.0b1` on
PyPI, `0.4.0.beta.1` on RubyGems, the SemVer form everywhere else. npm
refuses a prerelease without a dist-tag: the workflow names `latest` while
`prereleasesAreLatest` (`scripts/languages.ts`) is true, so a plain
`npm install peal-sdk` gets the beta, and `next` once it is false, at general
availability.

| Registry      | How it signs in                                                                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm           | Trusted publishing, with a provenance statement                                                                                                       |
| PyPI          | Trusted publishing                                                                                                                                    |
| RubyGems      | Trusted publishing                                                                                                                                    |
| NuGet         | Trusted publishing, through the policy of the account that owns the `peal-social` organization                                                        |
| crates.io     | Trusted publishing                                                                                                                                    |
| Maven Central | The portal's token and the signing key, in the secrets `MAVEN_CENTRAL_USERNAME`, `MAVEN_CENTRAL_PASSWORD`, `MAVEN_GPG_KEY` and `MAVEN_GPG_PASSPHRASE` |
| Go            | The tag `packages/peal-sdk/go/v<version>`, which the workflow pushes                                                                                  |
| Packagist     | The tag `v<version>` of the mirror below                                                                                                              |

Each registry's trusted publisher names the repository `peal-social/peal`,
the workflow `sdk-release.yml` and the environment `sdk-release`. npm and
crates.io take one only for a package that exists: their first release is
published by hand.

Packagist reads a package from the root of a repository, so the PHP SDK also
lives in [`peal-social/peal-php`](https://github.com/peal-social/peal-php), a
read-only copy of [`php`](php): `sdk-php-mirror.yml` updates it whenever
`main` changes the folder, with the deploy key in the secret
`PHP_MIRROR_DEPLOY_KEY`. That secret belongs to the `sdk-release` environment,
not the repository: each update waits for the environment's reviewers, and
the environment lets `main` deploy beside the `sdk-*` tags.

## License

The SDKs are licensed under the [Apache License 2.0](LICENSE), with the
[NOTICE](NOTICE) every package carries, unlike the rest
of this repository, which is under the Functional Source License: use them in
any project, commercial or not.
