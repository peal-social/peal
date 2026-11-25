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
exact version, and your project keeps it until you change it. Releases from
0.4 call the API under `/api/v1`, and 0.1 to 0.3 the API before it.

0.4.0-beta.1 is published the day Peal Cloud moves to `/api/v1`. Until then
the registries hold 0.3.0 (0.3.1 on Maven Central), the client that works
against Peal Cloud today.

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
`npm install peal-sdk` gets the beta, and `next` once it is false. At general
availability, the change that sets every release to 0.4.0 sets
`prereleasesAreLatest` to false.

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

## Release day: 0.4.0-beta.1

Releases 0.1 to 0.3 call the API as it was before `/api/v1`, and the SDKs
send their requests to production by default: nothing of 0.4.0-beta.1 is
published before production answers the new API. Follow these steps in
order, on one day.

### 1. Record the release, in the morning

`compat.ts --release` only writes files, and nothing in it depends on
production, so it goes first. From a branch of `main`, with the day's date
(2026-12-08 stands for it):

```sh
bun nx run peal-sdk:spec
cd packages/peal-sdk
bun scripts/compat.ts --release --date 2026-12-08 --title "The API under /api/v1, as the SDKs' 0.4.0-beta.1 call it"
```

It adds the day to the API's changelog (`peal-contract`'s
`api-changelog.json`), makes `openapi.json` the released document and
empties `released/accepted-changes.json`. The latest entry's day is the
API's version, which every SDK sends in `Peal-Version`, so regenerate and
check again: `bun run sdk:generate`, `bun run sdk:build`, `bun run sdk:test`,
`bun run test`. In the same branch, change what still names 0.3.0 as today's
release: "their release 0.3.0 today" in
`developers/conventions/versioning.mdx`, the changelog's line in
`developers/cli/index.mdx`'s sample output (both in English and French), and
the paragraph above that says the registries hold 0.3.0 until release day.
Merge it.

### 2. Release production, once

Release production from that merge (`packages/peal-infra/ansible`'s README),
then check it answers the new API with a workspace API key:

```sh
read -rs PEAL_API_KEY && export PEAL_API_KEY
curl -sS https://app.peal.social/api/health
curl -sS https://app.peal.social/api/v1/credential -H "Authorization: Bearer $PEAL_API_KEY"
```

`read -rs` takes the key without echoing it, so it stays out of the
terminal and the shell's history. The second call answers the key's
credential (`"_tag": "apiKey"`). Stop here if it does not.

The order is safe: the server answers the API it runs, whatever
`Peal-Version` a client sends, and only counts a version it does not know
(`unknown` in `peal.api.versions`). Once step 1 is merged and released,
production knows the new day, so the SDKs' requests count under it, and
nothing waits on a second release.

### 3. Call the real API before any tag

Build the Node and Python packages from the commit you will tag, as their
registries would receive them, and run the docs' first example
(`credential.get`) with each against production, with the key of step 2:

```sh
bun nx run peal-sdk-node:sdk:build
bun nx run peal-sdk-python:sdk:build
check=$(mktemp -d)
(cd packages/peal-sdk/node && npm pack --silent --pack-destination "$check")
(cd "$check" && npm init -y >/dev/null && npm install --silent ./peal-sdk-0.4.0-beta.1.tgz &&
  node -e 'const { PealClient } = require("peal-sdk"); new PealClient({ token: process.env.PEAL_API_KEY }).credential.get().then((credential) => console.log(credential._tag, credential.workspace.name))')
uv run --quiet --isolated --no-project --with "$(ls packages/peal-sdk/python/dist/*.whl)" \
  python -c 'import os; from peal import Peal; credential = Peal(token=os.environ["PEAL_API_KEY"]).credential.get(); print(type(credential).__name__, credential.workspace.name)'
```

Each prints the key's kind and its workspace's name. To run it the day
before, against the sandbox released from the same commit, give each client
the sandbox's address too: `baseUrl` in the Node options and `base_url` in
Python's, from `PEAL_BASE_URL` read like the key (`read -r PEAL_BASE_URL`),
with a sandbox key, on a machine signed in to the sandbox. Do not tag until
both print.

### 4. Publish: tag each SDK

A published version is permanent: no registry lets it be replaced, and a
mistake found after a tag is fixed by 0.4.0-beta.2, never by publishing
0.4.0-beta.1 again.

Tag the merge commit of step 1, three tags per push at most (GitHub starts
no workflow for a push of more). Each tag starts one run of `SDK release`,
whose publishing job waits for the `sdk-release` environment's reviewer.
After each group, check those registries (step 5) and run the install and
the call of step 3 with what they now serve, in an empty folder per
language, before you push the next group:

```sh
git fetch origin
commit=$(git rev-parse origin/main)
for language in node python go; do git tag "sdk-$language-v0.4.0-beta.1" "$commit"; done
git push origin sdk-node-v0.4.0-beta.1 sdk-python-v0.4.0-beta.1 sdk-go-v0.4.0-beta.1
# once those three are published and their install and call pass:
for language in rust dotnet ruby; do git tag "sdk-$language-v0.4.0-beta.1" "$commit"; done
git push origin sdk-rust-v0.4.0-beta.1 sdk-dotnet-v0.4.0-beta.1 sdk-ruby-v0.4.0-beta.1
# once those three pass too, with the SDK PHP mirror's run for that commit approved and green:
for language in java php; do git tag "sdk-$language-v0.4.0-beta.1" "$commit"; done
git push origin sdk-java-v0.4.0-beta.1 sdk-php-v0.4.0-beta.1
```

| Tag                        | What its run does                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------------------- |
| `sdk-node-v0.4.0-beta.1`   | `npm publish --provenance --tag latest`: `npm install peal-sdk` then gets the beta                 |
| `sdk-python-v0.4.0-beta.1` | Uploads the wheel and the source of `peal-sdk` 0.4.0b1 to PyPI                                     |
| `sdk-go-v0.4.0-beta.1`     | Pushes the tag `packages/peal-sdk/go/v0.4.0-beta.1`, then asks Go's module proxy for it            |
| `sdk-rust-v0.4.0-beta.1`   | `cargo publish` of `peal-sdk` 0.4.0-beta.1                                                         |
| `sdk-dotnet-v0.4.0-beta.1` | Pushes `Peal.0.4.0-beta.1.nupkg` to NuGet                                                          |
| `sdk-ruby-v0.4.0-beta.1`   | Pushes `peal-0.4.0.beta.1.gem` to RubyGems                                                         |
| `sdk-java-v0.4.0-beta.1`   | Signs and deploys `social.peal:peal:0.4.0-beta.1` to Maven Central, waiting until Central shows it |
| `sdk-php-v0.4.0-beta.1`    | Pushes the tag `v0.4.0-beta.1` to `peal-social/peal-php`, which Packagist reads                    |

Go first, as its retraction (step 6) needs its tag. Java last: Central's
publishing is the slowest.

### 5. Check each registry

Each must show 0.4.0-beta.1 in its spelling (NuGet and the Go proxy can
take minutes):

```sh
npm view peal-sdk dist-tags                    # latest: '0.4.0-beta.1'
curl -s https://pypi.org/pypi/peal-sdk/0.4.0b1/json | jq -r .info.version
curl -s https://proxy.golang.org/github.com/peal-social/peal/packages/peal-sdk/go/@v/v0.4.0-beta.1.info
gem list peal --remote --exact --prerelease    # peal (0.4.0.beta.1)
curl -s https://repo1.maven.org/maven2/social/peal/peal/maven-metadata.xml
curl -s https://repo.packagist.org/p2/peal-social/peal.json | jq -r '.packages["peal-social/peal"][].version'
curl -s https://api.nuget.org/v3-flatcontainer/peal/index.json
curl -s -A peal-release-check https://crates.io/api/v1/crates/peal-sdk/versions | jq -r '.versions[].num'
```

Then, in an empty folder per language, run the install command of the
table at the top and the docs' first example (`credential.get`, on the SDKs
page) with `PEAL_API_KEY` set: each prints the key's credential.

### 6. Retire 0.1 to 0.3

With every registry showing the beta, retire the old releases. The message,
wherever a registry takes one:

```text
Calls the API as it was before /api/v1, which Peal Cloud no longer serves. Install 0.4.0-beta.1 or later: https://docs.peal.social/developers/sdks
```

| Registry      | Action                                                                                                                                                                                                                         | What it does                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Undo                                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm           | `npm login`, then `npm deprecate 'peal-sdk@<0.4.0-beta.1' "<message>"` (the range takes `0.0.0-stage` too)                                                                                                                     | Deprecates: every install of those versions prints the message. Nothing is removed. Unpublishing is not used: past 72 hours it needs no dependents, under 300 downloads a week and one owner, and a version number unpublished can never be used again                                                                                                                                                                                                                                | `npm deprecate 'peal-sdk@<0.4.0-beta.1' ""`                                                                                                               |
| PyPI          | On pypi.org, Manage project, Releases: for 0.1.0, 0.2.0 and 0.3.0, Options, Yank, with the message as the reason                                                                                                               | Yanks: installers skip them unless pinned with `==`. A plain `pip install peal-sdk` then stops with "Could not find a version that satisfies the requirement" and lists 0.4.0b1; `uv add peal-sdk` installs 0.4.0b1                                                                                                                                                                                                                                                                   | Options, Un-yank, on the same release (PyPI's release menu, `warehouse/templates/manage/project/releases.html`; its yanking page does not say)            |
| RubyGems      | `gem yank peal --version 0.3.0`, then 0.2.0 and 0.1.0, with a key that may yank (and the one-time code)                                                                                                                        | Removes each version from installs and the index. Takes no message. A plain `gem install peal` then finds nothing ("Could not find a valid gem"), as RubyGems skips prereleases without `--pre` or a version                                                                                                                                                                                                                                                                          | None documented, and a yanked version number can never be pushed again                                                                                    |
| NuGet         | On nuget.org, Manage package, `Peal`: in Listing, unlist 0.1.0, 0.2.0 and 0.3.0; in Deprecation, select them, reason Legacy, the message as the custom message                                                                 | Unlisted versions leave search, and `dotnet add package Peal` then fails with "There are no stable versions available, 0.4.0-beta.1 is the best available. Consider adding the --prerelease option". A project naming one still restores it. Visual Studio's package manager and `dotnet list package --deprecated` show the deprecation, its reason and the alternative; the custom message shows on nuget.org only                                                                  | List them again in Listing; in Deprecation, save them with no reason checked, which removes the deprecation (nuget.org's own code; its page does not say) |
| crates.io     | `cargo login` with a token that may yank, then `cargo yank peal-sdk --version 0.1.0`, 0.2.0 and 0.3.0                                                                                                                          | Yanks: no new project gets them, and lock files that hold one keep working. Takes no message. `cargo add peal-sdk` then adds 0.4.0-beta.1, the latest version left                                                                                                                                                                                                                                                                                                                    | `cargo yank peal-sdk --version 0.3.0 --undo`                                                                                                              |
| Maven Central | Nothing: Central's FAQ says a released component cannot be altered, and names no way to remove or deprecate one                                                                                                                | 0.1.0 to 0.3.1 stay. Maven and Gradle builds name a version, so nobody gets one without asking for it                                                                                                                                                                                                                                                                                                                                                                                 | Not applicable                                                                                                                                            |
| Go            | `git tag packages/peal-sdk/go/v0.3.1 'sdk-go-v0.4.0-beta.1^{commit}'` and `git push origin packages/peal-sdk/go/v0.3.1`, then fetch `https://proxy.golang.org/github.com/peal-social/peal/packages/peal-sdk/go/@v/v0.3.1.info` | v0.3.1, on the beta's commit, is the highest release and is there only to carry the retractions, so Go reads its go.mod's `retract` block (which `scripts/finish.ts` writes): `[v0.1.0, v0.3.0]`, which calls the API as it was before `/api/v1`, and `v0.3.1` itself, which contains retractions only. `go get` and `@latest` skip v0.1.0 to v0.3.1 and pick v0.4.0-beta.1, and a module that requires one warns with the directive's comment. The proxy keeps every version forever | A later release whose go.mod drops the directive (Go reads retractions from the latest release): not tested                                               |
| Packagist     | `git push git@github.com:peal-social/peal-php.git --delete refs/tags/v0.1.0 refs/tags/v0.2.0 refs/tags/v0.3.0`, then Update on the package's page                                                                              | Composer knows the versions from the mirror's tags. With `v0.4.0-beta.1` alone, a plain `composer require peal-social/peal` stops with "Could not find a version of package peal-social/peal matching your minimum-stability (stable)". Packagist does not document dropping a deleted tag's version: check `repo.packagist.org/p2/peal-social/peal.json`                                                                                                                             | Push the tags again at their commits (v0.1.0 `bf123982f1c2`, v0.2.0 `22a9c05eb3ad`, v0.3.0 `f3acbdeb43c2`), or split them again from `sdk-php-v0.x`       |

Installs from a lock file that names a yanked or deleted version may fail on
RubyGems and Packagist: those releases call an API that is gone anyway.

For Go, check what a new module gets:

```sh
GOPROXY=https://proxy.golang.org go list -m github.com/peal-social/peal/packages/peal-sdk/go@latest
GOPROXY=https://proxy.golang.org go list -m -retracted -versions github.com/peal-social/peal/packages/peal-sdk/go
```

The first gives v0.4.0-beta.1, the second lists v0.1.0 to v0.3.1 as
retracted.

## License

The SDKs are licensed under the [Apache License 2.0](LICENSE), with the
[NOTICE](NOTICE) every package carries, unlike the rest
of this repository, which is under the Functional Source License: use them in
any project, commercial or not.
