# API contract

- The API only grows: add a field, an operation, an enum value or an error,
  never rename, remove or tighten one. `nx run peal-sdk:test` (in `bun run
  test`) compares the SDKs' document with the last released one
  (`packages/peal-sdk/released/openapi.json`, `scripts/api-changes.ts`) and
  fails on anything a client could break on; a break that is decided on goes
  into `released/accepted-changes.json` with its reason (the 64-bit
  byte counts are there: the same number on the wire, a wider type in the
  typed SDKs). A break the document cannot show goes there too, with a `kind`:
  `behaviour` (what an endpoint refuses now) or `sdk` (a type the
  generator renamed or narrowed, such as a status-named error body); the
  check keeps it until the release writes it to the changelog. A move of
  operations decided on (`kind` `move`, with `from`, `to` and the path
  parameter it `dropping`s) takes each operation under `from` to its place
  under `to`, where the check compares it as any other: every other
  difference still fails, and a move that moves nothing is stale. It also refuses a tighter limit on what is sent, a way of
  signing in that goes, a value or a union member no longer answered,
  null where there was always a value, and a baseline that lists nothing
  or is not the one the last release recorded (`released/openapi.sha256`).
  The target runs through `nx:run-commands`: `commands` outside `options`
  makes an `nx:noop` target that passes without running. Deprecate with
  `.annotateMerge(deprecated({ since, sunset?, link? }))`
  (`peal-contract/deprecation`): the document marks it and every answer
  carries `Deprecation` (RFC 9745) and `Sunset` (RFC 8594). `GET
  /api/changelog` serves `api-changelog.json`, which only `bun
  scripts/compat.ts --release --date … --title …` (in `packages/peal-sdk`)
  writes, when the SDKs are released: it records what changed and makes the
  current document the released one. The latest entry's day is the API's
  version (`apiVersion`, `src/api-version.ts`): the document's
  `info.version`, the `Peal-Version` header the server answers with and
  the one the SDKs and the command line send. The server counts what
  clients send and answers them alike; it translates nothing between
  versions.
- `openApiDocument()` (`peal-contract/openapi-document`) is the API's
  OpenAPI 3.1 document with a `webhooks` section: one entry per event type
  and `webhook.test`, each a `post` with its `operationId`
  (`on<PascalType>`), the three `webhook-` headers, and its payload, a
  component (`Webhook<PascalType>Payload`, registered through
  `HttpApi.AdditionalSchemas` so `$ref`s match). `scripts/openapi.ts` writes
  it for the docs and the server serves it at `/api/openapi.json` and
  `/openapi.json`: the server's tests check they are equal and list every
  event type. A new event type needs its summary there.
- A group's identifier is its namespace, a dotted path of camelCase
  segments (`inbox.messages`), and an endpoint's is one word without a dot
  (`send`): the operation id is both (`inbox.messages.send`), the SDKs nest
  it (`client.inbox.messages.send`), and the document files it under its
  first segment (`inbox`), whose name and description in the reference are
  `namespaceTags`' (`openapi-document.ts`; a new top-level namespace needs
  its entry). A workspace group's path starts with `/api/v1/` and the
  first segment in kebab case, and holds the later ones, in order, among
  its static segments (`/api/v1/inbox/messages/…`); only
  `workspace.billingActions` shares the billing reads' paths. No method
  has the name of a namespace beside it, and no namespace is called
  `peal`. A namespace that crosses contexts is several groups, one handlers
  layer each. The server's `test/app/namespaces.test.ts` checks these
  rules, and `packages/peal-sdk/scripts/spec.ts` stops on an SDK namespace
  whose last segment another one has. File and class names (`TagsApi`)
  and schema identifiers stay as they were.
- `GET /api/v1/credential` (`CredentialApi`, `credential.ts`) answers every
  principal `Authentication` knows, by kind (`user`, `apiKey`,
  `partnerKey`), never a key, a token, or a partner's workspaces: a new
  principal is a new member of `CredentialSchema`, and the server's
  `toCredential` and `CredentialCheck` (`Match.typeTags`) do not compile
  until it is described.
- The workspace endpoints are under `/api/v1/…` and never name the
  workspace in their path: each takes `headers: workspaceHeaders` (the
  optional `Peal-Workspace`, spread first into headers of its own), and a
  typed client's call passes `headers: forWorkspace(workspaceId)` where its
  credential belongs to no workspace. A path that names a workspace is a
  resource (the partner API's customers, the staff console's).
- Every contract error spreads `errorEnvelope` first, and its `code` is its
  tag in snake case (`errorCodeOf`): a tag never changes once published.
  The server's guide says how answers are shaped
  ([HTTP API and middlewares](../peal-server/AGENTS.md)).
