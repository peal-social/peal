# Peal server

Each context's rules are in a guide of its own. Read it before changing the
context, its tests under `test/<context>/` included, and each one's when a
change crosses several:

| Context                 | Guide                                                                                                |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| `workspace`, `staff`    | [`src/workspace/AGENTS.md`](src/workspace/AGENTS.md)                                                 |
| `legal`                 | [`src/legal/AGENTS.md`](src/legal/AGENTS.md)                                                         |
| `channels`              | [`src/channels/AGENTS.md`](src/channels/AGENTS.md)                                                   |
| `publishing`            | [`src/publishing/AGENTS.md`](src/publishing/AGENTS.md)                                               |
| `articles`              | [`src/articles/AGENTS.md`](src/articles/AGENTS.md)                                                   |
| publishing's feeds      | [`src/publishing/application/feeds/AGENTS.md`](src/publishing/application/feeds/AGENTS.md)           |
| publishing's follow-ups | [`src/publishing/application/follow-ups/AGENTS.md`](src/publishing/application/follow-ups/AGENTS.md) |
| publishing's recycling  | [`src/publishing/application/recycling/AGENTS.md`](src/publishing/application/recycling/AGENTS.md)   |
| `media`                 | [`src/media/AGENTS.md`](src/media/AGENTS.md)                                                         |
| `notifications`         | [`src/notifications/AGENTS.md`](src/notifications/AGENTS.md)                                         |
| `assistant`             | [`src/assistant/AGENTS.md`](src/assistant/AGENTS.md)                                                 |
| `billing`               | [`src/billing/AGENTS.md`](src/billing/AGENTS.md)                                                     |
| `analytics`             | [`src/analytics/AGENTS.md`](src/analytics/AGENTS.md)                                                 |
| `webhooks`              | [`src/webhooks/AGENTS.md`](src/webhooks/AGENTS.md)                                                   |
| `review`                | [`src/review/AGENTS.md`](src/review/AGENTS.md)                                                       |
| `engagement`            | [`src/engagement/AGENTS.md`](src/engagement/AGENTS.md)                                               |
| `activity`              | [`src/activity/AGENTS.md`](src/activity/AGENTS.md)                                                   |
| `ads`                   | [`src/ads/AGENTS.md`](src/ads/AGENTS.md)                                                             |
| `shortlinks`            | [`src/shortlinks/AGENTS.md`](src/shortlinks/AGENTS.md)                                               |
| `agent`                 | [`src/agent/AGENTS.md`](src/agent/AGENTS.md)                                                         |
| the MCP endpoint        | [`src/app/mcp/AGENTS.md`](src/app/mcp/AGENTS.md)                                                     |

The shared kernel's rules are below.

## Server architecture

The server follows DDD and Clean Architecture. Each bounded context in
`packages/peal-server/src/` has four layers, plus a `container.ts` that wires
them:

| Context         | Holds                                                                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `publishing`    | posts, their channels and media, schedules, attempts, the platform adapters, and what a workspace saves to write and file them (tags, signatures, channel sets) |
| `articles`      | articles for a workspace's websites, the sites' adapters, their job                                                                                             |
| `channels`      | connected accounts, connect flows, encrypted tokens and their renewal, the gates every platform call of a channel goes through                                  |
| `media`         | uploads, storage, probing, alt text, files handed to platforms                                                                                                  |
| `workspace`     | accounts, workspaces, members, roles, API keys, OAuth, partner accounts                                                                                         |
| `notifications` | account emails, in-app notices, their emails, notification preferences                                                                                          |
| `assistant`     | the writing assistant: prompts, language models, the daily quota                                                                                                |
| `shared`        | the kernel the others build on                                                                                                                                  |
| `analytics`     | the posts it follows, snapshots of their counts, the hourly collection                                                                                          |
| `billing`       | plans, subscriptions, entitlements, the billing page's usage                                                                                                    |
| `staff`         | the staff console: what staff read and do, and the audit log of it                                                                                              |
| `engagement`    | the inbox: comments under published posts, reviews of locations, direct messages, what is sent to them, their collection                                        |
| `activity`      | each workspace's activity log, and the requests counted for the rate limit                                                                                      |
| `webhooks`      | endpoints, their signing secrets, events, deliveries and the delivery log                                                                                       |
| `legal`         | what French law has a host keep, and the legal requests that read it                                                                                            |
| `review`        | approval policies, requests and decisions, review links, comments                                                                                               |
| `ads`           | ad accounts, what they may spend, what is read of them, boosts                                                                                                  |
| `shortlinks`    | the short addresses a post's links go out as, their daily click counts, each workspace's default                                                                |
| `agent`         | the web app's agent: each person's chats and skills, runs on the assistant's model with the MCP endpoint's tools, the changes it asks the person to approve     |

- `domain`: entities and rules on Effect's core (`effect`: Schema, DateTime,
  Data). No HTTP, SQL, cluster, workflow, AI, Drizzle or Better Auth.
- `application`: use cases and the ports they need, as `Context.Service`.
  Imports its context's domain and the shared kernel.
- `infrastructure`: adapters behind the ports: Drizzle repositories, Better
  Auth, platform clients, workflows, crons and activities, storage, mail.
- `api`: `HttpApiBuilder` handlers for `peal-contract` groups. They get use
  cases from the context's `container.ts`, never from infrastructure.

`src/app/` is the composition root (`server.ts`, `cluster.ts`, `crons.ts`, the
MCP endpoint in `mcp/`) and `src/main.ts` the entry point. `ServerLive` builds
telemetry, the database pool, the migrations, the cluster, the contexts, then
the HTTP server and the workers; `AppLive` is the routes with their services
and no socket, for tests.

- Folders import each other through `#<context>/<layer>/…` (package.json
  `imports`); `../` imports are refused. `packages/peal-server/oxlint.config.ts`
  enforces the layer rules. The MCP endpoint (`src/app/mcp/`) is a delivery
  layer too, which imports contexts through their container, domain,
  application and api, never their infrastructure. Never loosen a rule to
  make an import pass; move the code. A new context goes into that file's `contexts` list.
- A context may hold modules: a part that speaks the context's language
  and acts in its transactions, kept apart inside it as a folder of the
  same name in each layer (`src/<context>/<layer>/<module>/`; publishing's
  `feeds`, `follow-ups`, `recycling`). A module's files keep their layer's rules and may import the
  rest of the context; the rest of the context imports a module only from
  the container and the seams its entry in `test/lint-modules.ts` (which
  `oxlint.config.ts` reads) names, each with its reason, and modules never
  import each other. A file in a module reaches the rest of its layer by
  alias (`#publishing/application/x.ts`), as `../` is refused. A new module
  goes into that `modules` map with its seams (`test/lint-modules.test.ts`
  checks that its folders and seams exist); its rules go in its guide,
  `src/<context>/application/<module>/AGENTS.md`.
- Contexts talk through ports: an adapter in one context may call another
  context's `application` layer, never its domain or infrastructure.
  Publishing lists channels through `ListedWorkspaceChannels`, which calls the
  channels context's `ListChannels`. The other way, the channels context's
  `GatedPlatformPublisher` implements publishing's `PlatformPublisher` by
  sending each call through the channel's gate.
- Domain and application code never touches `Date`, `crypto`, `process` or
  `Bun`: time comes from `DateTime` and `Clock` (tests use `TestClock`), ids
  and randomness from ports, configuration from `Config`.
- Read every setting with `Config` in infrastructure. A setting production
  must be given, and that defaults to the development stack elsewhere, goes
  through `requiredInProduction` (`#shared/infrastructure/environment.ts`);
  `NODE_ENV=production`, which the image sets, decides. Read settings when the
  server starts, so a malformed value stops it there.
- The shared kernel holds the ids several contexts use (`ChannelIdSchema`,
  `PostIdSchema`, `PostTargetIdSchema`, `MediaAssetIdSchema`: branded
  lowercase UUIDv7s;
  `UserIdSchema`, `WorkspaceIdSchema`: the random lowercase UUIDs Better Auth
  issues), the platform list (`PlatformSchema`), the permission vocabulary
  (`access.ts`, `authorize.ts`), locales (`LocaleSchema`: en, fr), IANA zones
  (`TimeZoneIdSchema`), wall-clock time (`LocalDateSchema`, `LocalTimeSchema`,
  `WeekdaySchema`, `fromWallClock`), a schedule (`Schedule`: the instant
  in UTC and the zone it was chosen in), how a platform call can end
  (`PublishResult`, `PublishFailure`, and `TokenRejected` for a token the
  platform refused before doing anything), and how an attempt ended
  (`AttemptOutcome`: a `PublishResult` or a `PublishFailure`).
- Take ids from the `Ids` port: `yield* newId(PostIdSchema)`. Tests provide
  `Ids.layerTest`, which issues `00000000-0000-7000-8000-000000000001`, then
  `…002`, from each build of the layer.
- A scheduled instant is stored in UTC with the IANA zone it was scheduled in.
  Recurring posts and calendars compute in `DateTime.Zoned`, so daylight saving
  is handled.
- Turn wall-clock times into instants with `fromWallClock`, never
  `DateTime.makeZoned`'s default: a time the clocks skip moves to the moment
  they jump (02:30 becomes 03:00, not 03:30), and a repeated time takes the
  earlier offset, so it happens once. Keep zone ids as the user wrote them, and
  refuse offsets such as `+01:00`.
- Domain transitions are pure functions that take `now` and return a
  `Result`. `Effect.gen` cannot yield a `Result`, so use cases bridge with
  `yield* Effect.fromResult(…)`.
- What Peal pays for by use (`Meter`, `#shared/domain/meter.ts`) is
  claimed through `MeteredUsage` (`#shared/application/metered-usage.ts`,
  backed by billing): `claim` before anything is spent, in the caller's
  transaction when the fact it counts has one, `giveBack` when nothing
  came of it, `pausedOf(state)` to refuse before reserving what a later
  step claims. Its refusal is `AllowanceReached`, answered through
  `allowanceRefusal` (`#shared/api/allowance-reached.ts`, built with the
  group). Tests use `MeteredUsage.layerUnmetered` or `fakeMeters`
  (`#test/shared/support.ts`).
- Errors are `Schema.TaggedError`. Platform failures are typed (rate limited,
  token expired, media rejected, unavailable, bad request) so workflows handle
  each one.
- Use `effect/crypto` (`Aead`, `SecureRandom`, `Digest`) and `effect/encoding`
  (`Base64`, `Base64Url`) rather than calling Web Crypto or Node's byte APIs
  directly.

### HTTP API and middlewares

- Every route the server answers starts with `/api`, apart from `/openapi.json`,
  the OAuth discovery documents under `/.well-known/oauth-*`, the API
  catalogue `/.well-known/api-catalog` and `/llms.txt`. The web app forwards
  `/api/*` and those documents unchanged (`servedByApi`, and the matcher of
  `src/proxy.ts`: add a path to both), so Peal has one public origin;
  `/openapi.json` is reachable on the server only, and `/api/openapi.json` is
  the same document for everyone: the contract's `openApiDocument()`, the
  public API alone (`PublicApi`) with the events webhooks send, both served
  by the discovery routes. The server implements and serves the whole `Api`,
  Peal's own clients' groups and the staff console's included
  (the contract's guide: which group is in which list).
- `ApiAnswersLive` (`src/app/answers.ts`), a global router middleware in
  `RoutesLive`, shapes every answer, a failure's included (it changes the
  response a cause would get; a failure of the server's own (5xx) fails
  on with the same cause, so it is logged, counted and traced as one,
  while a refusal of the caller (a body the API cannot decode, 400, or
  too large, 413) is answered as a response, as Effect's handler would
  otherwise hand the middlewares outside it a cause without its
  response, which they read as a 500: `mapFailureResponse`,
  `test/app/refusal-statuses.test.ts`): the request
  id (`X-Request-Id`: the caller's when it is 8 to 128 of `[\w.:-]`, a UUIDv7
  otherwise; `peal.request_id` on log lines and the span; `RequestId` from
  `#shared/api/request-id.ts` for handlers), the headers handlers and
  middlewares left for it (`setAnswerHeader`, `#shared/api/answer-headers.ts`:
  an error is encoded after they ran), the API's version (`Peal-Version`,
  `src/app/api-versions.ts`), a deprecated endpoint's headers, and the
  error envelope. It counts each request of the API but the probes in
  `peal.api.versions` by the `Peal-Version` its client sent (a release's
  day, `none` or `unknown`, so the series stay few), and answers every
  version alike.
- Before any route runs, `ApiAnswersLive` answers 400 (`BadRequest`) to a
  path holding an encoded slash or backslash (`%2F`, `%5C`, any case), a
  backslash, a semicolon, raw or encoded (`%3B`), or a dot segment, raw or
  encoded (`isRefusedPath`, `peal-contract/path-spelling`; the query is not
  read). cloudflared decodes and resolves a path before it picks the rule
  that says whether Access guards it, dropping what follows a `;` in a
  segment, and forwards it as sent; the router keeps `%2F` inside a
  segment, so `/api/admin/users/x%2F..%2F..%2Fapi%2Fhealth` (or
  `/api/admin/users/..;/..;/api/health`) would be open to one and the
  staff console to the other
  (`packages/peal-infra/ansible/tests/test_cloudflared.py` models it). Never give a path parameter a
  value that needs one of them: send it in the query or the body
  (`test/app/path-spellings.test.ts`).
- Every request's body is held to its route's limit (`bodyLimitFor`,
  `src/app/body-limits.ts`): `contentBodyLimit` (8 MiB) for posts,
  articles and the MCP endpoint, `defaultBodyLimit` (1 MiB) for the rest,
  Better Auth's and the routes without credentials included.
  `ApiAnswersLive` answers 413 to a body declared larger before any route
  runs (Better Auth reads the web request itself, past `MaxBodySize`: a
  body it would read in chunks, with no length, is read first under the
  limit and handed over as a request of those same bytes, `boundedBody`
  in `workspace/infrastructure/auth/`, so Stripe's events keep what they
  verify), and provides `HttpIncomingMessage.MaxBodySize` for the bodies read, which
  fail their read past it (413, in the envelope; the MCP endpoint's as a
  JSON-RPC error). A route that reads less sets its own around its read
  (the error reports, Stripe's meter errors, Meta's events, the review
  page); one that needs more gets a named limit there, never a larger
  default. Bun stops reading past `largestBodyLimit`
  (`maxRequestBodySize`). Media never comes through the server.
- Every error of the API is one envelope: its own fields, then `code`,
  `message` and `requestId` (`errorEnvelope`, which every contract error
  spreads first; `enveloped` in `src/app/error-envelope.ts` fills them). A
  code is the tag in snake case (`errorCodeOf`), `message` the error's own
  words or its description. An answer without a body gets the general error
  of its status (`generalErrors`: `not_found`, `internal_error`…, never more
  than the status says, so the staff console's 404 and a missing route stay
  alike), and a request the API could not decode `InvalidRequest` with its
  `issues`. So does a body in a content type its endpoint does not read,
  which Effect's handler answers 415 in plain text of its own
  (`writtenByEffect`): `unsupported_content_type`, as
  `unsupported_media_type` is the media library's 422, a file it does not
  store (`test/app/refusal-statuses.test.ts`). Better Auth's routes and the MCP endpoint keep their own shapes, and Meta's events answer bare statuses.
  `errorCatalogue()` (`peal-contract/errors`) reads the list from the
  contract: `test/app/fixtures/error-codes.json` freezes every code the
  server answers, to every audience (`UPDATE_ERROR_CODES=1` adds new ones;
  never remove or rename one), and the docs' "API conventions" page lists
  the public API's (`errorCatalogue(PublicApi)`), in both languages, which
  `test/app/error-catalogue.test.ts` checks.
- Handlers answer a use case's refusal with `forbidden` from
  `#shared/api/forbidden.ts` (`MissingPermission: forbidden`,
  `personRequired()`): it gives `Forbidden` its `reason` and `permission`.
  `WorkspaceAccess` then tells it to the member (`#workspace/api/refusal.ts`):
  an OAuth client without the scope gets `missingScope`, the scope and the
  RFC 6750 `insufficient_scope` challenge; a key or a role, who gives the
  permission. Never answer a bare `new Forbidden()`. Endpoints of the
  partner API, whichever context serves them, take the key and refuse it
  through `#shared/api/partner-key.ts` (`partnerKeyOnly`,
  `withoutPartnerScope`, `partnerClosed`), in the same words.
- Bearer credentials are rate limited (`RequestLimits`, backed by the
  activity context's `RequestLimiter`): on a server that does not bill,
  `PEAL_API_REQUESTS_PER_MINUTE` (600) per API key, and per OAuth client
  and user (`limitSubjectOf`: a key counts by its id, whatever it belongs
  to); on one that bills, by the billing account's standing, the free tier
  counted per account (the activity guide says how), in fixed one-minute
  windows, one upsert per request on `activity.request_counts` under the
  subject's SHA-256, the same count for the API and the MCP endpoint;
  sessions are not counted. `RequestLimits.admit` takes the workspace the
  request names (`actingIn`, below, or the MCP connection's). Every
  such answer carries `RateLimit-Policy` and `RateLimit` (the IETF draft's
  structured fields); past the limit `Authentication` answers
  `TooManyRequests` (429, `Retry-After`) as a response, not a failure, which
  its next security scheme would turn into a 401. A count that cannot be
  kept lets the request through. Better Auth's own per-key limit stays off.
- A workspace write (any method but GET, HEAD, OPTIONS) is kept in the
  workspace's activity log by `WorkspaceAccess`, done, refused or failed
  (`recorded`, `#workspace/api/activity-recording.ts`, through
  `ActivityJournal`), and so is each call of an MCP tool that changes
  something (`recordToolCall`, as `mcp.<tool>`, without a status), by the
  MCP middleware around the tool (`recordedCalls`, `src/app/mcp/`): only a
  call that ran is kept, with `tool_refused` when the tool answered an
  error and `tool_failed` when the call gave no answer, never what a
  request's body names. Better Auth's routes that change a workspace
  (`changesWorkspace`: `/organization/*` and `/subscription/*` but those
  that read) are kept by its after hook (`recordWorkspaceChange`), as
  `auth:/path`, for requests browsers send: a refusal only for a member,
  as anyone can name a workspace. Keeping it never changes an answer.
- The discovery documents (`src/app/discovery/`) need no credentials and are
  written from `PUBLIC_URL`, `PEAL_DOCS_URL` and the contract: the API
  catalogue (RFC 9727, a Linkset), `/api/openapi.json`, the MCP server card
  at `/api/mcp/server-card` (SEP-2127: `application/mcp-server-card+json`,
  CORS for any origin, an ETag) and `/llms.txt`. Implement a discovery
  document only where a specification gives its path and format, and read
  the specification first.
- `GET /api/l/:code` (`src/app/short-links/`) is a short link's redirect,
  outside the contract and without credentials: a 302 that is never
  cached, 404 and 410 in the general error envelope, 300 a minute per
  address in the process (429). A short domain's proxy rewrites `/<code>`
  to it, so the route rule holds.
- `GET` and `POST /api/platform-events/meta/:app` (`src/app/platform-events/`,
  `:app` `facebook` or `instagram`, that exact path alone) are Meta's
  events, outside the contract and without credentials, read raw as
  Stripe's meter errors are, and answered with a bare status (no
  envelope, `otherAnswers`). Without `META_WEBHOOK_VERIFY_TOKEN`, or the
  app's secret, both answer 404 and read nothing. `GET` echoes
  `hub.challenge` (1 to 32 digits only) for `hub.mode=subscribe` and the
  token, compared by its HMAC in constant time; 403 otherwise. `POST`
  refuses (403) a missing or malformed `X-Hub-Signature-256` before
  reading the body, reads at most 4 MiB (413), and checks the signature
  over the bytes received before decoding anything: `facebook` with
  `META_APP_SECRET`; `instagram` with `INSTAGRAM_APP_SECRET` or
  `META_APP_SECRET`, each in constant time, until the sandbox's trial
  says which Meta signs with (U9b keeps that one, and the log line
  "Took an Instagram Login event" names it). Entries sent over a day ago
  (`maxEventAge`, `entry[].time`) are left out and counted `stale`. A
  signed body it cannot read is 200, a database failure 503, so Meta
  sends again. `peal.platform_events` counts each by `app` and
  `outcome`; refusals are logged once a minute a kind at most
  (`refusalLogEvery`). `hub.verify_token` is a redacted query name
  (`redactedQueryNames`). A path whose last segment is a token (the
  digest's unsubscribe link, a password reset's) is never traced, and
  the request log writes it with `<redacted>` in its place
  (`secretPathPrefixes` and `SecretPathsLive`,
  `src/app/untraced-paths.ts`): a new route that takes one joins them,
  though a token belongs in a header or the body. Never log a body or a signature
  (`test/app/secrets-in-logs.test.ts`); the engagement guide says what an
  event does.
- `GET /api/health` is liveness: keep it free of the database.
  `GET /api/ready` is readiness: `SELECT 1` within 2 seconds, otherwise
  `DatabaseUnavailable` (503).
- `Authentication` tries a bearer token (an OAuth access token issued for
  `PUBLIC_URL/api`, or a workspace API key starting with `peal_`), then the
  session cookie, and provides `CurrentPrincipal`. Effect tries the next
  scheme whenever one fails, so the session scheme refuses (401) a request
  that presents a token (`Bearer`, or `DPoP`, which the API never took, in
  any case), which reaching it means was refused: a key that stops working
  never acts as the session sent beside it. An `Authorization` header that
  presents none (empty, a scheme with no token, a proxy's `Basic`,
  `Negotiate`, `NTLM` or `Digest` sign-in) leaves the cookie to decide. A
  proxy must not pass its own bearer token upstream: the self-hosting docs
  say so. This rule is `Authentication`'s: Better Auth's own routes under
  `/api/auth` take the session cookie alone and ignore `Authorization`, and
  the staff console (`StaffAccess`) reads the session alone. A cookie request that
  changes something needs an `Origin` of `PUBLIC_URL` or `TRUSTED_ORIGINS`,
  and reads the session fresh from the database.
- A request's workspace never comes from its path. `WorkspaceAccess`
  takes it from the `Peal-Workspace` header (`workspaceHeader`, a
  workspace's id), else from the credential's own workspace (an API key's,
  or the one an OAuth token is bound to: `ownWorkspaceOf`), else answers
  400 `WorkspaceRequired`: a session, the command line's token and a
  partner key always send the header; a blank one names nothing. It
  provides `CurrentMember`, puts the workspace on the request's span
  (`peal.workspace_id`) once the caller is let in, and gives every answer,
  refusals included, `Cache-Control: private, no-store` unless the handler
  set its own (`setAnswerHeaderUnlessAnswered`): every workspace shares an
  endpoint's address, so no shared cache may keep one's answer. A workspace
  the caller does not belong to answers 404, as does a value that is no
  workspace id, a banned user 403, a key or a bound token naming another
  workspace 403. Membership and bans are read on every request
  (`MemberDirectory`), so they apply at once. `Authentication`'s rate
  limit, connection journal and impersonation guard read the same value,
  unchecked, through `actingIn` (`#workspace/api/request-workspace.ts`), on
  endpoints behind `WorkspaceAccess` only: elsewhere a header names nothing
  they keep.
- Put workspace groups under `/api/v1/…`, named and placed by their
  namespace as the contract's guide says (`posts.tags` under
  `/api/v1/posts/tags`), every endpoint taking
  `headers: workspaceHeaders` (spread first into headers of its own), with
  `.middleware(WorkspaceAccess).middleware(Authentication)` (Authentication
  runs first), and add them to `WorkspaceGroupsLive` in `src/app/server.ts`.
  A path that names a workspace is a resource of another group (the
  partner API's customers, the staff console's), never the request's.
  The addresses platforms hold (`/api/channels/oauth/…`,
  `/api/data-deletion/…`, `/api/platform-events/…`) never move.
- Put the signed-in user's own groups, which span workspaces (notices,
  notification preferences), under `/api/me/…` with `Authentication` alone,
  in `WorkspaceGroupsLive` too. They answer 403 to API keys, which belong to
  a workspace, and to OAuth tokens bound to one workspace. Those that act on
  the account itself (its export, its deletion, connected applications) and
  deleting a workspace answer only the person in their own session:
  `ownSession` (`workspace/domain/own-session.ts`) refuses OAuth tokens and
  staff impersonating them too. The export and the list of connected
  applications also answer Peal's command line (`ownSessionOrCommandLine`:
  the `peal-cli` client, its token bound to no workspace), which saves them
  in the user's files; no MCP tool hands them out, as an MCP client passes
  what it reads to an AI model.
- Handlers turn `CurrentMember` into an `Actor` with `actorOf`
  (`#shared/api/actor.ts`). Use cases that act for someone take that `Actor`
  and check it with `authorize`: permissions are `resource:action`
  (`post:schedule`, `channel:connect`, `media:upload`…).
- Map each use case error to a contract error. A failure of the server's own
  (the database, a bug) is a defect: 500. A handler that maps an outside
  failure to 503 logs it as a warning first.
- The staff console's group (`StaffApi`, under `/api/admin`) has
  `StaffAccess` alone, in `WorkspaceGroupsLive`: staff in their own session,
  from the session cookie read fresh, and a trusted `Origin` for writes.
  Anyone else, an API key, an OAuth token or staff impersonating someone
  included, gets 404 (`HttpApiError.NotFound`), never 401 or 403, so the
  console never tells it is there. `StaffStanding` decides, from the role
  and the ban the database holds now.
- `POST /api/client-errors` (`ClientErrorsApi`, in `src/app/client-errors/`)
  needs no credentials. `ClientErrorIntake` counts 30 reports a minute per
  address (`AUTH_IP_HEADERS`, else the connection's), in this process, and
  reads the body with a 16 KiB limit before it is decoded; the handler
  replaces email and IP addresses, ids, keys (Peal's, Stripe's), tokens
  (a JWT, an Authorization header's credential) and the queries of the
  links they quote, drops control characters, logs at error level with OpenTelemetry's
  attribute names (`event.name` `peal.client_error`) and counts in
  `peal.client_errors`. Never log more of a report than its schema holds.
- Handler tests through `HttpApiTest.groups` provide `securityTest(member)`,
  `anonymousSecurityTest` or `staffSecurityTest(userId)` from
  `#workspace/api/security.ts`: `HttpApiTest` serves every group, so each
  provides every middleware (nobody is staff in the first two, and the
  error report intake lets everything through). The CLI's in-memory test
  server (`packages/peal-cli/test/support.ts`) serves every contract group:
  add new endpoints there too.

### The cluster

- Publishing runs as Effect Workflows, and token refresh, reconnect warnings
  and retention as `ClusterCron`s, stored in Postgres. There is no Redis.
- `src/app/cluster.ts` builds a `SingleRunner` with SQL message and runner
  storage on the same pool as Drizzle, so `TransactionRunner`
  (`shared/application`) saves rows and starts a workflow in one transaction.
  The runner's name comes from `HOSTNAME`, never `HOST` or `PORT`; shards are
  held with session advisory locks, storage is polled every 2 seconds, and
  shutdown waits up to 60 seconds for platform calls in flight, as the HTTP
  server does for requests (Bun then closes them; Effect's default is 20):
  both in `src/app/shutdown.ts`, which `test/app/shutdown.test.ts` keeps
  10 seconds inside the server's `stop_grace_period` (75 s).
- The crons that call platforms through the gates (post counts at minute
  7, accounts at 37, comments every ten minutes from 2, the token sweep
  every ten from 0) never start on the same minute, and a collection
  starts on a minute no other cron does: `test/app/cron-schedules.test.ts`
  reads every `ClusterCron.make` in `src/` and fails otherwise. A gate
  runs calls in the order they came, so a publish waits for one read of
  each collection at most (`ChannelGate`, in the channels context:
  `test/channels/infrastructure/channel-gate.test.ts`).
- Register crons in `src/app/crons.ts`. Workflow tags, payloads, idempotency
  keys, activity and clock names, result schemas and cron names are persisted
  contract: add a payload field with a decoding default or a union member,
  never rename or remove one, and for a breaking change add a V2 beside V1 and
  drain it. Keep the fixtures in
  `test/publishing/infrastructure/fixtures/persisted`,
  `test/articles/infrastructure/fixtures/persisted` and
  `test/notifications/infrastructure/fixtures/persisted` decoding.
- Tests build their cluster with `clusterOver`
  (`test/publishing/infrastructure/harness.ts`), whose own timers run once
  an hour. Moving `TestClock` wakes every timer due within the jump, one
  after the other, at a real cost: the entity reaper's ten seconds, which
  the cluster sets itself, still make a day of virtual time about 8,600
  wakes. Jump only as far as the behaviour needs (a daily rule and days,
  not weeks), and never raise a timeout for a jump. Test a budget of time
  on `TestClock`, with the calls it waits on let go by the test, never on
  the real clock, which a loaded machine spends on its own. A job's long
  durable sleep (a retry's delay of minutes) is reached by moving the clock
  to the wake-up it stored (`untilWokenLater`,
  `test/articles/article-support.ts`), not a second a round.
- A test that starts jobs on the cluster's shared tables forgets them
  when it ends, however it ends (`forgettingJobs`,
  `test/app/cluster.test.ts`). A run killed part way still leaves its jobs
  due, and the next run's servers run them, so a test counts what its own
  post or channel did, never every call a fake platform took.
- A test that counts a cron's runs on the real clock stops the cron first:
  the cluster suite's ticks pass a gate it shuts before it counts.

### Test shards

- CI runs the tests in shards (the `server` job's matrix), split by the
  time each file took (`test/durations.json`, `test/shards.ts`): the
  sequencer in `vitest.config.ts` gives each file to one shard, a file
  never measured too, and `test/shards.test.ts` checks it. Each shard
  uploads what it measured (`server-test-durations-<n>`); refresh the
  file from a run of `main` with every shard passed, with
  `nx run peal-server:test-durations -- <run id>`, when a shard runs
  far longer than the others. A shard's own `--sequence.shuffle.files`
  shuffles its files.

### Fake servers

- A fake server answers through `fakeHandler`
  (`#test/shared/fake-handler.ts`), which answers 500 when the fake's own
  code fails, and reads a body with `receivedBody` or `receivedText`
  (`#test/shared/received-body.ts`), which forget a request whose client
  left before its body. Node never awaits a request listener, so either
  failure would otherwise reject after the test that caused it.

### Database

- The server reads `DATABASE_URL` (required) with `Config.Redacted`.
  `DatabaseLive` in `#shared/infrastructure/database.ts` provides `PgClient`,
  Effect's `SqlClient` and the `Drizzle` service on one pool, which the
  cluster shares. Better Auth runs on a small pool of its own
  (`AUTH_DB_POOL_MAX`). Repositories use `Drizzle`, or `SqlClient` for raw
  SQL.
- Each context keeps its tables in a Postgres schema named after it
  (`publishing`, `channels`, `media`, `notifications`, `assistant`,
  `analytics`, `billing`, `staff`, `legal`, `review`, `webhooks`, `engagement`, `ads`, `shortlinks`, `agent`; the
  workspace context's are Better Auth's, in `auth`). The articles
  context's three tables stay in `publishing`, where they were made,
  declared from the articles context on the one `pgSchema("publishing")`
  of `#shared/infrastructure/publishing-schema.ts`, as drizzle-kit
  refuses a schema name declared twice. Effect creates its `cluster_*`
  tables in `public`; drizzle-kit never manages them.
- Declare a context's tables in `src/<context>/infrastructure/schema.ts`, then
  run `nx run peal-server:db:generate`, which writes a migration folder under
  `packages/peal-server/drizzle/`. Commit the folder as drizzle-kit wrote it.
- Production runs these migrations, so the one combined migration of the
  first releases has ended: a change to a table is a new folder on top of
  the others, and a folder on `main` is never edited, deleted or generated
  again (`20261112074616_initial` included). A second `db:generate` must
  report no change. Until a branch merges, its folder is its own: after
  merging a `main` that gained a migration, delete the branch's folder and
  generate it again.
- A query on a hot path (the calendar, a job that scans every workspace)
  gets its plan read on a database of the size it will meet:
  `packages/peal-server/scripts/seed-scale.ts` fills an empty, migrated
  database whose name ends in `scale` with synthetic rows for so many users
  (10,000 by default: 40,000 channels, 900,000 posts, 2.25 million targets).
  A job that takes "everything due" pages by cursor and says what it left;
  it never stops at a fixed count.
- The server applies pending migrations before it listens, under an advisory
  lock, so servers starting together take turns. `nx run peal-server:db:migrate`
  applies them without starting the server.
- The server migrates when it starts, so write migrations that the previous
  release can still run against, and roll back by releasing the previous
  commit.
- A release that gives stored JSON a key the previous release ignores, or a
  row a state it never wrote, says in
  `packages/peal-infra/ansible/runbooks/roll-back.md` what the previous
  release does with it and the read-only checks to run before rolling back
  past it. Per-channel posts did: an override's `media` (the release before
  sends the post's media there, unchecked) and `post_targets.dropped` (it
  counts the target, and fails a missed post's claim on it): roll back
  only once no post still to go out has either, with the recycling rules
  whose source gives a channel media of its own paused and the drafts
  that do left alone (the runbook's third check). Polls and first
  comments did too: `posts.poll` (the release before ignores it, so the
  post goes out without its poll) and a first comment in `follow_ups` on
  Facebook Pages, Instagram, LinkedIn or YouTube (the release before's
  router refuses it as a part too many, after the post went live): roll
  back past them only once no post still to go out has either, with the
  drafts and recycling sources asking a poll dealt with. Websites did too: a
  channel of `wordpress`, which the release before cannot decode where it
  reads channels (every workspace's collection jobs included), and the
  events and notices that name one: never roll back past them while any
  is stored; articles and their jobs it ignores (the runbook's checks).
  Chats did too: a channel of `discord` or `telegram`, a target with
  their options or failed as `forumThreadNameRequired` or `chatMigrated`,
  and the events and notices that name one: never roll back past them
  while any is stored (the runbook's "Past chats"). Slack did too: a
  channel of `slack`, a target with its options or failed as
  `cannotPost`, and the events and notices that name one or that reason:
  never roll back past them while any is stored (the runbook's "Past
  Slack"). Unified login did too: `unifiedLogin` in the `connection` of
  a channel, an attempt, a choice or a connect link, which the release
  before cannot decode where it reads them (every workspace's collection
  jobs included): never roll back past it while a channel or a link
  names it (the runbook's "Past Unified login"; unsetting
  `META_INSTAGRAM_CONFIG_ID` makes no roll-back safe). Edits rendered
  whole did too: a slide video job whose `plan` is `{ edit }`, which the
  release before cannot decode when it claims it, so the job stays
  `running` without anything sent until it goes stale: roll back past it
  only once no job on its way has one (the runbook's "Past edits rendered
  whole").

### Product analytics

- Contexts call `ProductAnalytics` (`#shared/application/product-analytics.ts`),
  which decides who an event is about (the person acting, from the
  caller or the request's `AnalyticsActor`, else the workspace's service
  identity `workspace:<id>`), leaves out what must not go (a session
  staff act in, a user or a workspace `PEAL_POSTHOG_EXCLUDED_IDS` names,
  an account or workspace
  erased in this process), checks every property against
  `SafePropertiesSchema` and hands the event to `AnalyticsDelivery`: the
  PostHog adapter on capture v1 (`#shared/infrastructure/posthog-delivery.ts`,
  settings in `posthog-settings.ts`), or none without `PEAL_POSTHOG_KEY`.
  `ProductAnalyticsLive` (`src/app/product-analytics.ts`) is one per build
  of the server, released after the HTTP server and the workers, so it
  sends what they queued.
- Events come from seven seams, never calls sprinkled in use cases: the
  activity journal's adapter (`api_operation`, every write but MCP's), the
  MCP middleware (`mcp_tool_called`, every tool call), the decorator over
  `WebhookEvents` (the milestones nothing else tells: a channel connected,
  disconnected, to reconnect or expiring, a post scheduled, published or
  failed, an article published or failed, a file refused; a channel to
  reconnect or expiring is told again with each daily reminder, and a
  file with each probe, so readers count channels and files, never
  events; what a member
  does in a request is `api_operation`'s, and what comes in, comments and
  messages, is never told, for its volume), Better Auth's hooks
  (sign-ups, workspaces, subscriptions), the decorator over billing's
  `BillingNotices` (`allowance_reached`, with the notice its billing
  managers get, as the billing workspace: once a meter and month, but for
  a unit given back and claimed again), the decorator over
  `RequestLimits` (`api_used`: a key's or an application's first request
  let through each UTC day, through the API or the MCP endpoint, reads
  included, as the key's workspace or the application's person, with the
  workspace its token is bound to and never one a request names, which
  nothing has checked yet there; kept in memory alone, `usesToldADay` at
  most, so a restart tells the day again and readers take one per
  workspace or person, `via` and `day`; never a session's or a partner
  key's) and the daily usage
  snapshot's sink (`workspace_snapshot`: billing's `UsageSnapshotSink`,
  adapter `billing/infrastructure/analytics-usage-snapshot-sink.ts`, one
  event a workspace with a connected account, as its service identity,
  with the day's counters of the usage ledger when it could be read: the
  posts that went out and the billing meters' units). A rerun
  of a day sends that day's snapshots again: readers take one row per
  workspace and `day`, never the event's timestamp, which is when it was
  handed over (the next day, from 00:11 UTC). A workspace that loses its
  last connected account is no longer told: read its latest snapshot
  with its `channel_disconnected` events. The sink only queues: a fiber
  hands the events over at half what the delivery sends (`snapshotPace`,
  50 every 2 seconds), so a day of N workspaces takes about N/25 seconds
  and never fills the delivery's queue of 5,000; what still waits when
  the server stops is counted `dropped`, which the alert
  `peal-product-analytics-dropped` watches. With product analytics off,
  the snapshot reads nothing for it (`UsageSnapshotSink.enabled`). A new event joins
  `ProductEventSchema` (`#shared/domain/product-event.ts`) and the
  samples of `test/shared/product-event-samples.ts`; its names are
  persisted for whoever queries PostHog: add, never rename.
- Events carry `$groups` (`workspace`, `billing_account`), and every group
  fact as a plain property too, as Peal's project has no group analytics
  and its readers query with SQL: `workspace_id` and `billing_account_id`
  on every event about them, and on `workspace_created` and
  `subscription_changed` what `$groupidentify` sets (`workspace_plan`,
  `subscription_status`, `free_tier`, `kind`, `standalone`), so a
  workspace's latest state is an `argMax` over these events.
- A property is an id, an enum, a number or a boolean: never a text
  someone wrote, a name, an address, a URL or what a platform answered.
  Capture never fails, dies or waits on the network, and the delivery
  never sends an event twice; a seam tells one again only where its
  event says so. Staff are marked `internal` when they open the console;
  what they do as a member sends nothing.
- An erasure forgets, durably: closing an account and deleting or
  offboarding a workspace call `ProductAnalytics.erase` inside the
  erasure's transaction, which starts `ForgetAnalyticsV1`
  (`#shared/infrastructure/workflows/forget-analytics.ts`, persisted
  contract) with the erasure, and `forget` once it committed. The
  workflow forgets them in its process, purges what the delivery holds of
  them, waits for a request in flight, then deletes them at PostHog with
  `PEAL_POSTHOG_PERSONAL_API_KEY`, tried again after `forgetRetryDelays`
  across restarts, then given up (`peal.erasure.analytics_failed`,
  counted); without the key it logs their ids
  (`peal.erasure.analytics_manual`) for the operator, as it does with no
  `PEAL_POSTHOG_KEY` at all, for a deletion started before the key was
  removed. A start the database refuses fails the erasure (a
  `DatabaseError`, tried again), so no deletion is left to make by hand
  for an erasure that rolled back. `ReplayErasures`,
  a command, deletes at once and waits (`eraseNow`).
- What comes from stored data (a Stripe event naming the member who once
  subscribed) is sent as the workspace's service identity
  (`asWorkspace`), never as a person who may have been erased since:
  the person behind an event is only ever the request's, or one just
  made. A service identity's events set its `kind` once (`$set_once`),
  as it never changes. Every event is encoded through `ProductEventSchema` with no key
  it does not declare, person and group properties through their own
  schemas, and no key may name an address, a name, a URL, a text or a
  token (`refusedKeyWords`).
- The web app measures its use only where `PEAL_POSTHOG_WEB` is on beside
  the key (`BrowserMeasurement`, provided with product analytics):
  `GET /api/me` answers `browserAnalytics`, null without it, in a session
  staff act in, through an application and for an excluded person; else
  the token, the environment, the person's choice (`undecided` once older
  than 183 days) and their excluded workspaces. `PEAL_POSTHOG_WEB=on`
  requires a project token (`phc_`), which browsers send. A session
  request's `x-posthog-session-id`, when a UUID, joins that person's
  events of the request as `$session_id` (`AnalyticsActor.sessionId`)
  only while the web app is measured and their consent stands
  (`BrowserSessions`), never a key's, an application's, an impersonated
  one's or a service identity's. An erasure deletes the persons'
  recordings too (`delete_recordings`), and counts as done once PostHog
  says they are queued, or that it found nobody (`persons_found: 0`).
- Where `PEAL_POSTHOG_SITE` is on beside a project token
  (`SiteMeasurement`, provided with product analytics), a sign-up links
  the visitor the site, the docs and the blog followed, once they allowed
  it, to the new account, once, in the request that made it:
  `databaseHooks.user.create.after` reads the id in the request's
  `ph_<token>_posthog` cookie (`visitorOf`, auth's `visitor-of.ts`), only
  while the same request's `peal.consent` allows it and is under 183 days
  old and the browser sends neither `Sec-GPC: 1` nor `DNT: 1`
  (`site-answer.ts`: the SDK renews its cookie on each visit, so the cookie
  alone says nothing of the answer), only when it is a version 7 UUID, which users' and workspaces' ids (version 4) never are, and `toldSignUp` sends `ProductAnalytics.link` (PostHog's
  `$create_alias`, the account's id as `distinct_id`, the visitor's as
  `alias`, `AliasPropertiesSchema`) before `user_signed_up`. Then the after
  hook expires that cookie (`expireVisitorCookie`, on
  `PEAL_POSTHOG_SITE_COOKIE_DOMAIN`, the registrable domain PostHog's SDK
  sets it on, where set) after every `/sign-up/email` that carried it and
  went through, so a known address's made-up user (200 too) reads the
  same, never after a refused one (Better Auth runs after hooks on an
  `APIError` too), and after a `/callback/*` that
  made an account: the browser's later visits get a new visitor, linked
  to nobody. Where the same request's answer allowed following the
  visitor, the response also names it in `peal_site_retired`, a session
  cookie (linked or not alike, so a known address reads as a new one),
  which the site's pages compare their own with before anything leaves: a
  page left open across the sign-up keeps the visitor in memory and would
  save its cookie again. A refusal or the browser's signal on the site
  removes it. A route's refusal is its status, 400 or more. Nothing is linked at a sign-in, nor after the sign-up.
  Closing the account deletes the person at PostHog, the visits merged
  into it included.
- Tests use `ProductAnalytics.none`, or `recordedAnalytics`
  (`#test/shared/recorded-analytics.ts`); through the whole server,
  `appWithPostHog` (`#test/shared/fake-posthog.ts`) reads what a fake
  PostHog received.

### Metrics and alerts

- Every metric that says a job falls behind has an alert rule
  (`packages/peal-docker/test/alerting.test.ts`): add the rule with the
  metric.
- Every request through the public HTTP client (`publicHttpClientWith`,
  `publicLibraryHttpClientWith`, `publicFetch`, `publicFetchWith`) counts in
  `peal.outbound.responses`, by service and status class
  (`#shared/infrastructure/platforms/outbound-responses.ts`), which
  `peal-outbound-failing` watches. A new platform's API hosts join the
  fixed table there, with a case in its test; any other host is `other`,
  and a label never holds a host, a path or an id.
- Text Peal did not write is made storable before it is kept:
  `storableText` and `storableLine` (`#shared/domain/platform-text.ts`)
  make it well formed (Postgres takes no NUL, and no lone surrogate in
  JSON), drop control characters, bound it by characters, and, for a name
  or any single line, drop line breaks and the marks that reorder what is
  around it. Clean where the text enters, before it is compared, stored or
  put in a job's history: comments and their authors (`storableReading`),
  what a sign-in says of an account (`storableAuthorized`), what a
  platform answers a publishing call with (`storableResult`,
  `storableFailure`, in the routed publisher), a file's codec and its
  name (`media/domain/file-name.ts`), a webhook
  receiver's answer (`excerptOf`), what visitors type on a review page
  (`review/domain/plain-text.ts`) and the names an ad network gives an ad
  account, a campaign, an ad set or an ad (`ads/infrastructure/meta/
  marketing-mapping.ts`); an ad network's refusal keeps its codes, never
  its words. A new place a platform's string is
  kept goes through the helper, with a test that hands it a NUL and half
  a surrogate pair.
