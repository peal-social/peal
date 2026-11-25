# SDKs

- Every SDK is generated from `packages/peal-sdk/openapi.json`, which
  `peal-sdk:spec` (`scripts/spec.ts`) writes from the contract's, which
  holds the public API alone (the contract's `publicGroups`): which groups
  the SDKs have is the contract's to say, never this script's. It stops on
  an operation that takes no bearer token (an API key, a partner key or an
  OAuth access token) and is not a health check (`system`), as its group
  belongs in `appGroups`, and keeps only the bearer scheme in each
  operation's `security`, with the schemas the operations use.
  It names Effect's encoding of non-finite numbers `NonFiniteNumber`, and
  stops on any other enum inline in an `anyOf` or `oneOf`: give it a schema
  of its own in the contract. It writes each tagged union (Effect's `anyOf`
  of objects with a one-value `_tag`) as Fern reads one: a `oneOf` with a
  discriminator mapping each tag to a schema, a member written inline
  becoming `<Schema><Tag>` (`ChannelStatusDisabled`); the SDKs that rename
  properties call `_tag` `type`, as Fern refuses a leading underscore.
  Ruby's generator then reads the tag under `type` and keys each member in
  capitals (`API_KEY` for `apiKey`), and has no option for either: see
  `finish.ts` below. Each
  operation's SDK group and method come from its operationId
  (`posts.schedule`; `inbox.messages.send` writes the group as a list,
  `["inbox", "messages"]`, which every generator nests:
  `client.inbox.messages.send`), and no POST or PATCH is retried
  (`x-fern-retries`): the first may have created what a retry would create
  again. Every SDK sends `Peal-Version`, the contract's `info.version`,
  on every request (`x-fern-global-headers`, a literal its users may
  override), so a release that records a changelog entry regenerates the
  SDKs; `scripts/test.ts` fails a smoke test whose calls leave it out.
  The generators name a namespace's client and its inlined request types
  after its last segment alone (Rust numbers a second `UsageClient`;
  `SendMessagesRequest`), and a Ruby group named like the gem's module does
  not load: the script stops when two namespaces end with the same segment,
  when one is called `peal`, and when a method has the name of a namespace
  beside it. Go moves a namespace that holds others to
  `<namespace>/client/client.go`.
  The workspace a client acts in is a client option too (`workspace`,
  `Peal-Workspace`, an optional global header): the script strips the
  header from every operation, so no method takes a workspace, and a
  client made without one sends none (an API key acts in its own).
  The contract's `webhooks` section (the events Peal sends) is left
  out (`leftOut`, tested in `scripts/spec.test.ts`, and `api-changes.ts`
  reads none of it): the open-source generators are documented to make no
  typed events of it, their signature helper being a paid feature, and the
  SDKs are the API's clients, not receivers. Receivers parse events with
  the contract's `WebhookPayloadSchema` or by hand, as the docs show.
- Never edit a generated file: change the contract, the scripts or the
  generator's options, then `bun run sdk:generate`. Fern replaces each
  language's folder with what it writes, so nothing stale stays, and keeps
  only the files its `.fernignore` names, which are ours: `project.json`, the
  smoke test, Ruby's `custom.gemspec.rb`, .NET's `Peal.Custom.props` (the
  metadata the generated gemspec and project load) and PHP's
  `.gitattributes`. `generate.ts` copies `LICENSE` and `NOTICE` in after it.
- `sdk:generate` depends on `peal-sdk:spec` through the tag `sdk-spec`, never
  the name: Nx resolves a name in `dependsOn` to the npm package of that name
  first, and the Node SDK's package is `peal-sdk`. `.nxignore` keeps the
  SDKs' builds out of the project graph (`cargo package` unpacks a copy of
  the Rust SDK, `project.json` included). `generate.ts` refuses to run
  without `openapi.json`, which only Nx writes before it. The Node SDK's
  `package.json` sets `nx.includedScripts` to none: Nx would otherwise run
  Fern's `test` and `build` scripts (vitest and pnpm) with the workspace's.
- `scripts/languages.ts` holds each language's Fern generator (image,
  version, the digest that pins it, its options), version and build, and pins
  every toolchain image by digest, as `compose.yaml` does. A release bumps
  that language's version there. `generate.ts` pulls the generator by digest
  and tags it with the name Fern runs, writes a Fern workspace for the
  language under `.cache/sdk/fern` (paths relative, as Fern wants), and runs
  the workspace's `fern-api` with `--local` and its telemetry, upgrade check
  and version redirection off. Fern copies the SDK's folder, builds included,
  into temporary folders it never deletes, so its `TMPDIR` is a folder of
  its own, new for each run (`withTemporaryFolder`,
  `scripts/temporary-folder.ts`: `peal-sdk-fern-<language>-` and a random
  suffix, from `mkdtemp`, in the system's temporary folder; on macOS, Fern
  prefixes that path with `/private`, so it cannot live in the workspace),
  so runs from other worktrees and languages in parallel never share one.
  Root deletes it in the generator's image after the run, failed or
  interrupted too: on Linux, the generator writes there as root. `--generate-tests`
  makes Fern write whole projects (manifests, build files, its own tests),
  not the source alone.
  Generation is deterministic: `sdk:check` compares two runs' output through
  Git. Upgrade Fern (the CLI or a generator) on purpose, then regenerate and
  read the diff.
- `scripts/finish.ts` fills what the generators' options cannot set (PyPI's
  `peal-sdk` name and the README's install line, Composer's license and no
  `version`, Rust's TLS feature and links, npm's `NOTICE`), removes Fern's
  badge and CI workflows (the PHP mirror would run them), and writes Java's
  Maven `pom.xml` from the dependencies of Fern's Gradle build, which it
  deletes (OkHttp's JVM artifact is `okhttp-jvm` to Maven). Each replacement
  fails when its text is missing, so a generator upgrade that changes its
  output stops there: update the replacement.
- Ruby's tagged unions are finished there too (`scripts/ruby-unions.ts`):
  each union file reads its discriminant under the property the API sends
  (`_tag`, or `platform` for the channels' options) and keys each member by
  its tag (in single quotes when Ruby would interpolate it), both read from
  the document through the member's schema. Any member, property or key
  the document does not account for stops the run, as does a union line
  (`extend`, `discriminant`, `member`) in a form the script does not read.
  Three replacements in the runtime (`lib/peal/internal/types`): `union.rb`
  records the tag of a member given as its own type
  (`SignatureScopeChannel.new(…)`), on a copy, so `to_h` sends it and the
  caller's object, frozen or not, stays as it was; `utils.rb` sends such a
  member through its union; `model.rb`'s setters coerce as the constructor
  does, so a member set after its model is built is tagged too. A union of
  models that is a request's whole body, discriminated or not
  (`channels.connect_chat`, `posts.confirm`, `webhooks.redeliver_many`),
  is built through the union (`.coerce`), so its fields take their API
  names, and the run stops unless that rewrote one body for each operation
  whose JSON body the document gives as a union of objects.
- The SDKs' manifests keep the generator's dependency ranges, and their lock
  files (`Gemfile.lock`, `composer.lock`, `Cargo.lock`) stay out of Git: a
  library leaves its dependencies' versions to the projects that install it.
  The exception is a version with known vulnerabilities in a manifest that
  pins one: `finish.ts` raises it (`minimumVersions`, Jackson in Java's
  pom). Dependabot's security updates read the generated manifests: fix
  what they report there, in the generator or `finish.ts`, never in the
  generated file, which `sdk:check` would refuse; Dependabot then closes
  its pull request.
- `sdk:build` builds each SDK as its registry would get it, then loads it:
  Python with the workspace's uv, the others in their image
  (`scripts/container.ts`: as the calling user, with their downloads cached in
  `.cache/sdk`). Node's compiles with TypeScript 5.9 and Node 20's types, as
  its tsconfig expects (TypeScript 7 removed its module resolution). Rust's
  crate uses rustls, which needs no OpenSSL. Go's module is
  `github.com/peal-social/peal/packages/peal-sdk/go`.
- Each SDK is released alone, by a tag `sdk-<language>-v<release>` on a
  commit whose `scripts/languages.ts` gives that release
  (`scripts/release-tag.ts` refuses another). A release is SemVer, a
  numbered `alpha`, `beta` or `rc` for a prerelease (`0.4.0-beta.1`), in
  the tag and in `languages.ts`; each language's `version`, which the
  generator writes and the registry gets, is its registry's spelling of it
  (`scripts/versions.ts`, tested): PEP 440's normal form for PyPI
  (`0.4.0b1`), dots for RubyGems (`0.4.0.beta.1`, as a hyphen would become
  `.pre.`), SemVer for the others. The .NET project sets its assembly's
  versions to the package's, which the compiler refuses for a prerelease
  (CS7034): `Peal.Custom.props` gives them the release alone (`0.4.0`),
  and the package keeps `0.4.0-beta.1`. npm refuses a prerelease without a
  dist-tag: `release.ts` gives `latest` while `prereleasesAreLatest` holds
  (the beta line is the only one that speaks the live API), `next` after.
  The SDKs stay on `0.4.0-beta.N` until general availability; the
  README's "Release day" is the order of the first beta's release and how
  each registry retires 0.1 to 0.3. Go's `go.mod` keeps
  `retract [v0.1.0, v0.3.1]` (`finish.ts`): Go reads retractions from the
  highest release's go.mod, never a prerelease's, so the retraction-only
  v0.3.1 tag carries them until a release above it does. The install line
  of each README (`finish.ts`), the docs' SDKs page and quickstart and the
  table of `README.md` come from `scripts/install.ts`, one exact version
  each, and `scripts/install.test.ts` fails on a page that shows another:
  a version bump changes the docs in the same change. `sdk-release.yml` builds it from
  that commit and publishes it in the `sdk-release` environment: trusted
  publishing (OIDC) for npm, PyPI, RubyGems, NuGet and crates.io, no token
  stored; Maven Central's portal token and signing key from secrets (the
  `release` profile of the pom `finish.ts` writes: BouncyCastle signing and
  Sonatype's plugin); a tag `packages/peal-sdk/go/v<version>` for Go; a
  tag `v<version>` on `peal-social/peal-php` for Packagist. That repository
  is a read-only copy of `packages/peal-sdk/php` (`git subtree split`), which
  `sdk-php-mirror.yml` updates from `main` with the deploy key in
  `PHP_MIRROR_DEPLOY_KEY` (`.github/scripts/push-php-mirror.sh`), a secret
  of the `sdk-release` environment alone, whose deployment branches name
  `main` beside the `sdk-*` tags; never commit to it.
- `sdk:test` (after `sdk:build`, uncached) runs each SDK's smoke test, a file
  of ours in its folder (`test/smoke.mjs`, `smoke.py`, `smoke_test.go`,
  `smoke.rb`, `src/test/java/…/SmokeTest.java`, `smoke.php`, `smoke/`,
  `examples/smoke.rs`), against the stand-in API `scripts/test.ts` serves:
  the health check, then `GET /api/v1/credential` (`credential.get`) with
  the bearer token `peal_test`, whose answer (an API key's: a tagged union)
  holds nulls and an enum, then with a refused token, which must raise the
  SDK's 401 error. Keep every test calling both, and checking what it
  decodes; the run fails when the stand-in did not see both calls. Ruby's
  test also lists the channels, creates a signature, connects a chat and
  redelivers webhooks (`testsUnions` in `languages.ts`): statuses decoded
  as their members in a list, some with no field beside their tag, a
  frozen scope sent as its member's type and left unchanged, and two whole
  bodies that are unions. The run fails when a body went out other than
  the API reads it (`unionRequests` in `scripts/test.ts`).
  Containers reach it as `host.docker.internal`; Ruby's client sends plain
  HTTP to localhost alone, so its test forwards from its container's
  loopback. Fern's own tests (Go's call WireMock) do not run.
- The docs' `sdks.mdx` (en and fr) has code in every language, written
  with the generated names (`reference.md`: `credential.get`,
  `media.importFromUrl`, Ruby's `send_`…) and the TypeScript journey
  compiled against `node/src`: recheck them when the contract renames an
  operation or a generator upgrade renames a method.
- What each package ships is chosen, not found: npm's `files`, Ruby's
  gemspec (`lib/`, the README, the license: `finish.ts`), Rust's `exclude`,
  PHP's `.gitattributes` (`export-ignore`, for Composer's downloads), the
  .NET project alone with its README (ours: the generator's says nothing).
  Java uses OkHttp with Gson, the generator's default: its `native` library
  has no authentication, though its docs show `HttpBearerAuth`.
- The SDKs are Apache-2.0 (`packages/peal-sdk/LICENSE`, copied into each
  language's folder: Go would otherwise take the repository's FSL), and every
  manifest says so. What they call is public API: renaming or removing an
  operation, a field or a schema in the contract breaks their users.
- The generator names one error body type per status (`BadGatewayErrorBody`
  and the like), after one of the endpoints with several errors there: a
  new union at a status can rename its members. Check the SDKs' diff for
  it after a contract change, and record what it breaks in
  `released/accepted-changes.json` with `kind` `sdk`.
