<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Web front

- Build screens from `peal-ui` components and Tailwind classes; add no other
  stylesheet, but for the Studio SDK's look (`studio.css`).
- peal-ui's components are shadcn/ui's look on ui-sdk (`@ui-sdk/react`, on
  `@ui-sdk/core`), which gives their unstyled behaviour (keyboard, focus,
  selection, popups, ARIA), as it does for what peal-ui does not cover:
  nothing imports Base UI. Its clone in `.local/references/ui-sdk` is the source of
  truth: before using it, read the skill in `packages/core/skills/ui-sdk`,
  then the React pages in `apps/docs/content/docs/react` (`components/`
  holds one per component). To build a new component, also read
  `apps/docs/content/docs/core` and `react/rendering.mdx`. Style its parts
  as shadcn/ui's are, with peal-ui's theme tokens and Tailwind classes on
  their `data-*` state attributes; never import `@ui-sdk/core/web.css`, its
  default look.
- Add a shadcn component by running `bunx shadcn add <name>` in
  `packages/peal-ui`, which reads its `components.json`. Its style
  (`base-nova`) writes the component on Base UI: put the matching ui-sdk
  part in place of each Base UI one, its classes on ui-sdk's state
  attributes (a bare `data-selected` takes `data-[selected]:`, as shadcn's
  `data-selected:` reads `data-selected="true"`), and add no
  `@base-ui/react`. Point the component's
  `cn` import (the CLI writes `"cn"`) at `../lib/utils` and its sibling imports
  at `./`, rewrite function components as arrow functions, take every
  user-facing string (labels such as a dialog's close button) as a prop, then
  run `bun run fix`. `@shadcn/lint` proves a wrapper classless only around
  Base UI, so it reads every peal-ui wrapper as styled: classes on an
  element a peal-ui part renders go on a component of the screen's own.
- Use theme tokens (`text-muted-foreground`, not `text-gray-500`) and
  component variants and sizes rather than restyling a component; the
  `@shadcn/lint` rules check pages against peal-ui. Peal is light only
  ([DESIGN.md](../../DESIGN.md)): write no `dark:` class.
- Pages live under `src/app/[locale]/`: the auth pages (`signup`, `login`,
  `verify-email`, `forgot-password`, `reset-password`, `invitations/[id]`),
  the contract functions anyone reaches (`cancel`, `withdraw`, and
  `contract-request`, the page of the link emailed to a request's
  address),
  the OAuth pages (`device`, `oauth/workspace`, `oauth/consent`), the
  platforms' redirect URI `connect/[platform]/callback` (which shows the
  account picker when a sign-in reached several accounts), the ad
  networks' `connect/ads/[network]/callback`, Meta's data
  deletion status `data-deletion/[code]`, the page behind a review link
  `review` (no sign-in, noindex; the token is the address's fragment, read
  in the browser), and the signed-in
  app at the root, in the `(app)` route group: `/` (it opens a
  workspace, or shows the setup page, below) and `create` (the setup page
  for another workspace), both in the `(setup)` route group,
  `[workspaceId]` (the workspace's home: the
  measurement's question, connecting channels and assistants, a
  quickstart), `…/agent` and `…/agent/[chatId]` (the agent, for
  assistant:use), `…/platforms` (PealAPI's, for channel:read),
  `[workspaceId]/channels`, `…/editor` (the Studio's video editor, for
  assistant:use and media:upload: not-found otherwise), `…/media`,
  `…/analytics`, `…/inbox` (a split view, its layout the list, for
  `engagement:read`: not-found otherwise, as for staff acting as a member)
  with `…/inbox/[threadId]`, `…/inbox/reviews/[threadId]` and
  `…/inbox/messages/[conversationId]` beside it, `…/ads`,
  `…/posts` (every post, whatever its state, for post:read and
  channel:read; its tabs are the drafts and the posts that need an
  approval, and `…/drafts` and `…/approvals` only redirect to them; with
  `?layout=calendar`, the calendar, which `…/calendar` only redirects to,
  its query kept),
  `…/posts/import` (a CSV file's posts, for
  post:schedule, post:read and channel:read), `…/posts/new`,
  `…/posts/[postId]`, which opens
  a draft or a scheduled post in the composer, and shows a post that went
  out in `PostDetail` (each channel's status, attempts and reasons, with
  repost and confirm, and its analytics), `…/settings` (the workspace itself, with `members`, which holds inviting
  and the invitations waiting, `invitations` only redirecting there, `tags`, `signatures`,
  `channel-sets`, `queues`, `recycling`, `feeds`, `api-keys`, `webhooks` and `agent`, the agent's skills, for assistant:use, with `agent/skills/new` and `agent/skills/[skillId]`) and `…/billing`. The person's own
  pages are every workspace's too, in its Settings: `…/settings/account`
  (their profile and data), `…/settings/account/preferences` (language,
  time format, measurement), `…/settings/account/security` (password,
  two-step verification, sessions, connected applications),
  `…/notifications` (their notifications across workspaces) and
  `…/settings/notifications` (which reach them by email); the account
  menu opens them in the workspace open. There is no personal
  area: no page across workspaces, no sidebar of the person's own. Each
  workspace stands alone, and the API has no overview, agenda or report
  across a person's workspaces to show. The staff console is
  `admin` (the system's health), `admin/users`, `admin/users/[userId]`,
  `admin/workspaces`, `admin/workspaces/[workspaceId]` (with its API
  rate limit, `WorkspaceRequestLimit`: staff set a limit of its own, with
  a reason, or remove it),
  `admin/contract-requests` (through `deskRead`), `admin/billing-accounts`
  (through `accountsDeskRead`: platform accounts under several free billing
  accounts, an account by its id or a workspace's, merging and requiring a
  payment method), `admin/audit` and
  `admin/legal`: its layout and pages read the staff endpoints with the
  visitor's cookies through `staffRead` (`#staff/server.ts`), which shows
  the not-found page for any 404, and its actions are mutations from
  `#staff/atoms.ts`. `admin/legal` (legal requests, `legalRead`) is linked
  and served for staff with the legal role only (`answersLegalRequests`):
  its form (`LegalRequestForm`, `#staff/legal-request.ts`) sends nothing
  without the authority, the reference, the legal basis and what the
  request covers, `LegalAnswerView` shows what came back, and the page
  says before anything is entered that each answer is recorded, as staff
  must be told (Code du travail, art. L1222-4): keep that notice.
  `ImpersonationBanner`, in `AppShell`, shows while staff act as someone.
- The signed-in app has its own frame (DESIGN.md, "The frame"):
  `ShellFrame` leaves every page of the app (`isAppPath`: `/`, `/create`
  and a workspace's) to its layouts (`frameOf` answers `own`). `FrameView` (`components/shell/`) is the frame both
  draw: a sidebar on the page's background (in a `Sheet` on a
  phone; its links close it through `useCloseMenu`), the page in a white
  panel under a 48 px header (the breadcrumb, the page's `h1`, its
  actions; the panel scrolls, never the document, and each scrolling pane
  is `relative`, so `sr-only` text and hidden inputs scroll and clip with
  it. A scroller of its own that is not positioned, inside a pane (the
  tags field, the media picker, the assistant's preview) or beside them
  (the sidebar), keeps a checkbox's, a switch's and a select's input
  through their own boxes, but other absolutely positioned or `sr-only`
  content in it resolves against the pane, or the window, and neither
  scrolls nor clips with it: give that scroller `relative` when adding
  such content there), and a bottom bar
  across the window: the account menu at its start (`AccountMenuView`),
  Help (**Docs** at `PEAL_DOCS_URL`, **Support** at `PEAL_CONTACT_URL`
  when set, the shortcut sheet) and the agent's place (`AgentDock`) at
  its end. `(app)/[workspaceId]/layout.tsx`
  gives a workspace's pages `WorkspaceShell`, whose `SidebarView` holds,
  in its head, the workspace switcher, Search (the command menu) and New
  post, then the mode's pages, a section's pages under a way back,
  and Settings (but while its own pages show); the bottom bar holds, beside the account, `ModeSwitch`
  (the open mode, and **Switch** on hover, whose menu offers PealCreative
  and PealAPI);
  `(app)/(setup)/layout.tsx` gives the setup page `SetupFrame`
  (`components/setup/`): no sidebar and no bottom bar, the way back to
  the workspace `/` would open when the person has one, who is signed in
  and Sign out. Someone signed
  out or not a member gets the app's `PlainFrame`; a member who must
  first turn on two-step verification gets it too, with the notice and
  the security and access page's own controls to turn it on (`TwoStepTurnOnHere`, as
  the staff console does), since that page is a workspace's. Which workspace pages
  exist, their mode, their section and the permission each asks is one
  table, `#shell/navigation.ts` (`navigationOf`, tested): add a workspace
  page there, with its name in `WorkspaceShell.pages`; a page of a
  section goes in its group (`sectionLayout`: Settings' `personal`,
  `publishing`, `automations` and `administration`, named in
  `WorkspaceShell.sectionGroups`), which the sidebar labels. The frame's panel header holds the page's one
  `h1`, its name: a page draws no title or description of its own, puts
  its main actions in `PageActions` (small ghost buttons, icon first) and,
  where it opens one item, names it with `PageTitle`. Each page also
  exports `generateMetadata = workspacePageTitle("<page>")`
  (`#shell/page-title.ts`; the setup page's is `setupPageTitle`), its
  name from the sidebar's catalogue, which the layouts' templates follow
  with the workspace's name or "Peal" for the browser's tab
  (`components/shell/frame-view.tsx`). A list page puts its items in
  one bordered list with a line between them, never a card each.
- A new workspace opens on its second setup step,
  `/create/<slug>/channels` (`(setup)/create/[workspaceId]/channels`,
  `setupChannelsPath`, `useSetupChannelsHref`), which `CreateWorkspaceForm`
  goes to once the workspace is made: the setup card (DESIGN.md, the
  frame's `setup`; `components/setup/setup-card.tsx`, its view
  `setup-card-view.tsx`, its rules `#home/setup.ts`, tested), for members
  with channel:connect (anyone else goes to the workspace's home). The
  member ticks the platforms the server signs in to (`setupOptionsOf`:
  New channel's order, LinkedIn's profile and pages apart, no website or
  chat, none of `PEAL_SETUP_HIDDEN_PLATFORMS`, read per request), and a
  tab of the run's own (`openSignInTab`, opened from the click, as
  browsers open one only then, its `opener` cut while it is blank, as it
  goes to other sites' pages; one of that name it cannot cut off, left
  on another site, is closed and opened again blank, and only where that
  fails too does the step's own tab leave instead) runs their sign-ins one after the other
  while the step stays open in the first tab: the run lives in
  `localStorage` (`#channels/connect-run.ts`), which every tab reads and
  whose storage events keep the step current; `useRunStep` starts its
  next step in that tab (or in the step's own, where the browser refused
  the tab), and the callback page (`CompleteConnection`, which finds the
  workspace through the run, `runWorkspaceFor`, in a tab that remembers no
  connection) and the account picker record each outcome and start the
  next platform's sign-in, or close the tab on any refusal or at the end
  (`leaveSignInTab`, which opens the step there when the browser does
  not close it). A platform's page that strands its tab (Google's "Back to
  safety", Meta's errors, a login abandoned) never takes the step away
  (dogfooded on the sandbox). The step never leaves
  for a platform by itself, so Back never traps the member; **Skip for
  now**, **Stop** and the end lead to the workspace's home, which shows
  no setup card. Each platform's own page names the account it connects
  (Peal cannot see or choose it), which the card says. The cost line
  reads `billingOf` for billing:read only, and every figure from the rate
  card. The server knows nothing of a run: each connection is checked as
  any other.
- The workspace's home builds each assistant's setup (`#home/agents.ts`,
  tested) from the MCP endpoint at the address the browser has Peal open
  at, after hydration: never a key. Brand marks come from simple-icons
  (`BrandMark`); LinkedIn, Slack and Google Business Profile, which are
  not in it, from the files their owners publish, in peal-ui's
  `src/brand-marks` (`linkedinBrand`, `slackBrand`,
  `googleBusinessProfileBrand`); OpenAI's assistant gets a plain tile. PealAPI's Platforms lists `platformRowsOf`
  (`#platforms/rows.ts`): this server's capabilities beside the
  workspace's channels.
- The web app reports its errors to `POST /api/client-errors`:
  `src/instrumentation-client.ts` (uncaught errors, unhandled rejections),
  `app/[locale]/error.tsx` and `app/global-error.tsx` (the error pages, in
  the reader's language), and `src/instrumentation.ts` (`onRequestError`).
  Build reports with `reportOf` (`#errors/report.ts`), which cuts each field
  to the contract's limits and keeps no query, id or address; browsers send
  them without cookies, each error once, ten a page at most. The release
  comes from `PEAL_RELEASE`, through the locale layout's `peal-release`
  meta tag.
- A workspace's pages are `/<slug>/…` (`/fr/<slug>/…`), beside the app's
  other pages at the root: the folder is `(app)/[workspaceId]`, but its
  segment is the workspace's slug (or its id, as the server's emails and
  notices write it: `workspaceAt`, `#shell/workspace-path.ts`). Next
  routes a static segment before the dynamic one, and no slug may be one:
  `reservedWorkspaceSlugs` (`peal-contract/workspace-slug`) holds every
  first segment the app routes, which `test/shell/reserved-segments.test.ts`
  reads from `src/app`, so a new page at the root goes there too.
  Pages resolve it with `viewerOf`/`membershipOf` (`#posts/membership.ts`)
  or `workspaceAt`, and call the API with the membership's `id`, never the
  segment. Write a workspace's address with `workspacePath(slug, rest)` on
  the server and `useWorkspaceHref()(workspaceId, rest)` in components
  (`components/shell/workspace-addresses.tsx`: the `(app)` layout gives
  every page the person's workspaces, by id and slug; outside the app it
  falls back to the id), never by hand. `src/proxy.ts` sends an address
  that names a workspace by its id (`/<id>/…`) to the same page under its
  slug (308, `slugAddressOf`, once `/api/me` says whose it is), as the
  server's emails and notices link by id. A slug is
  `peal-contract/workspace-slug`'s (`isWorkspaceSlug`: lower-case words,
  never `reservedWorkspaceSlugs` nor an id's shape): the server refuses
  another (Better Auth's hooks, `INVALID_WORKSPACE_SLUG`), when a
  workspace is made and when its slug changes. Renaming keeps it; owners
  and admins change it on the Workspace settings (`WorkspaceAddressRow`,
  which then opens the page under the new address). A new workspace is
  made with `CreateWorkspaceForm` (`components/create-workspace-form.tsx`),
  its name and its address offered and both the person's to replace: the
  address follows the name's words (`suggestedSlugOf`,
  `#workspaces/new-workspace.ts`) until the person writes one, is checked
  against `isWorkspaceSlug` then Better Auth's `/organization/check-slug`
  once they pause (`slugAvailabilityOf`), and, while still the one
  offered, gets a random tail when taken or reserved. Create waits for a
  free address. Another workspace may take it between the check and
  Create (the server answers `ORGANIZATION_SLUG_ALREADY_TAKEN`):
  `createRefusalOf` (tested) has the offered address tried again once
  with the tail, and one the person wrote said taken under the field.
  Error reports and the measurement's patterns write the slug's segment
  `:id` (`pathOf`), as it holds the workspace's name.
- `/`, for someone signed in, redirects to the workspace Better Auth keeps
  active on the session (`activeWorkspaceOf`, `#auth/active-workspace.ts`,
  read only for someone with several), else the first (`homeWorkspaceOf`);
  someone signed out is sent to sign in. A workspace becomes the active one
  when it is chosen: from the switcher or the command menu, and once created (`createWorkspace`), as Better Auth's own
  update leaves the session's cached cookie naming the last one.
  `chooseWorkspace` (`#auth/choose-workspace.ts`) sets it through
  `workspaceClient` while the link opens, waits for nothing, and only
  reports a failure; views take it as `onChooseWorkspace`.
  Every way in lands there: sign-in's default `next`, sign-up, a confirmed
  address, an accepted invitation, the OAuth pages. Someone with none gets
  the setup page there, `FirstWorkspace` (`components/first-workspace.tsx`)
  in `SetupColumn`: an invitation still open opens instead
  (`openInvitationOf`), as on a server by invitation; otherwise it shows
  `CreateWorkspaceForm`, the name offered after the first word of their
  name in their account's language (`AppPage.defaultName`: "Ada’s
  workspace", `adas-workspace`), and opens the workspace once made; staff
  acting as someone without one are told so (`AppPage.staffNoWorkspace`),
  as they may not create one. Another workspace is made at `create`
  (`createWorkspacePath`, the switcher's **New workspace**), the same page
  with the name empty, which opens it once made.
- Usage measurement (`#measurement/*`, `components/measurement/`, the
  `Measurement` catalogue): the `(app)` layout wraps every page of the app
  in `Measurement` only where `GET /api/me` answers `browserAnalytics`
  (the server measures for this person: never for staff acting as them).
  `modeOf` decides each page: `off` (outside the app, `isAppPath`, an excluded
  workspace, Do Not Track or Global Privacy Control), `anonymous` (page
  views in memory, nothing kept, no person, no workspace, no recording)
  or `identified` (once the person allowed it: their id, the workspace,
  local storage, a masked recording, `tracing_headers` naming the session
  to the API). The SDK starts once a page load, so one controller
  (`makeController`, `#measurement/controller.ts`) holds it, what was
  applied (`applyState`) and the state `before_send` reads, across
  remounts: leaving the app parks it (memory, no tracing header, no
  recording, its storage cleared), another person in the tab and every
  consent change give a new browser id (`reset(true)`), and a load that
  fails leaves the page unmeasured. Effects depend on primitives, so a
  `router.refresh()` never restarts a recording. A choice, a sign-out or a
  sign-in reaches the other tabs through a storage event (`#measurement/tabs.ts`,
  `peal.measurement-news`, removed as written), and a tab shown again
  reads `GET /api/me` again: another person there forgets the session,
  a changed answer refreshes the page. `posthog-js` is pinned with its `@posthog/core`,
  `@posthog/browser-common` and `@posthog/types`, which the root
  `package.json`'s `overrides` pin to the versions it was released with:
  move all four together on every bump, in this package and in peal-ui,
  which pins the same `posthog-js` for the site (Dependabot's `posthog` group
  holds them). Only `measurement/sdk.ts` imports `posthog-js`
  (a test reads `src/`), behind a dynamic import; its logs never leave
  (`logs.beforeSend`). Every event goes through `sanitized`'s allowlist
  (ids, enums, numbers, booleans; a test refuses the server's
  `refusedKeyWords`). Recordings mask every text, input and attribute,
  keep an address of Peal's own as its pattern and any other as
  `elsewhere`, and block media; content drawn as a CSS background takes
  `data-replay-block`. Errors reach PostHog only through
  `reportBrowserError` (`onReported`). The relay is a route handler
  (`app/pulse/[...path]`, `#measurement/relay.ts`; `src/proxy.ts` lets
  `/pulse` through): only while `PEAL_POSTHOG_WEB` is on with the
  project token in `PEAL_POSTHOG_KEY`, only events and recordings by
  POST (`/e/` and `/s/`, and `/i/v0/e/` and `/i/v0/s/`, where the
  project's configuration sends the SDK: PostHog's cloud names
  `/i/v0/e/`) and `/array/<token>/config` by GET, whose answer it rewrites to
  name the SDK's own `/e/` and `/s/` (`withOwnEndpoints`): the cloud's
  `/i/v0/e/` is a path tracker blockers refuse, so such a browser would
  send its first page view and nothing after. It forwards the request's
  type alone and answers PostHog's status and type alone. Its site mode,
  under `/pulse/site` (`siteRelayPrefix`), is on apart from the app's,
  while `PEAL_POSTHOG_SITE` is on with the token: the edge sends it the
  site's, the docs' and the blog's events from their own host names, and
  it relays `/e/` by POST alone (their SDK loads no configuration), 256
  KiB at most, with the type, the `user-agent` and an `x-forwarded-for`
  set to the address the first header `AUTH_IP_HEADERS` names carries
  when it is an IP address (`visitorAddress`), as PostHog's cookieless
  count is worked out from both; never a cookie, `referer`, `origin` or
  a language. The app's mode never forwards those two; `skipTrailingSlashRedirect`
  is on for it, and the proxy redirects every other trailing slash
  itself. The app's HTTP client keeps the `fetch` it started with, so it never
  sees the SDK's `tracing_headers`: it names the session itself
  (`#measurement/session-header.ts`, set by `Measurement` from the
  controller) while identified. A recording's page addresses (rrweb's
  meta event) leave as patterns, as every event's do. Never set the
  PostHog project's authorized domains for replay: the relay sends no
  `Origin` or `Referer`, so PostHog would turn replay off, and the app
  records its signed-in pages alone anyway. The choice lives on the account
  (`PUT /api/me/browser-analytics/consent`): `ConsentCard` on a
  workspace's home while undecided, `ConsentSetting` on the Preferences page.
- Pages fetch through the client derived from `peal-contract`, with
  `@effect/atom-react`: query atoms come from `PealApi` in `src/api/client.ts`.
  Browsers call `/api`; server code calls `PEAL_API_URL`. A call of a
  workspace endpoint names its workspace in its own `headers`
  (`headers: forWorkspace(workspaceId)`, from `peal-contract`, merged
  with an idempotency key where there is one), never through a transform
  of the client: query atoms are keyed by a call's arguments, so two
  workspaces' queries stay apart. The app's registry is the library's
  (`RegistryProvider`, which keeps and disposes of it), read through
  `renderRegistry` (`#api/registry.ts`, tested), which
  `AppRegistryProvider` puts inside it: a query a render reads, never
  read nor subscribed to before, is held until something subscribes to
  it, as that render's commit does, or `renderHoldMs` (ten seconds) when
  nothing does, and a refusal is let go as soon as it comes: Next's
  router renders the page it opens, its requests sent, before it commits
  it, and the registry's own task, which drops what nothing subscribes
  to, ran in between and cancelled each request, which the commit sent
  again. A node once subscribed to is never held: a query goes with its
  last reader, so a page opened again reads it afresh, which the
  pages count on: give the registry no idle time (`defaultIdleTTL`) and a
  query no `timeToLive`, which would show a page opened again what it
  read before (the calendar without a post scheduled again, a list's
  earlier refusal). A deletion passes the key that lists
  its kind again alone (`postListsChanged`, `articleListChanged`,
  `queueListChanged`, `feedListChanged`; a media's usage reads
  `mediaUsageKeys`), never one a query of the deleted item reads: the
  page still reads it when the answer lands, and would ask for it and get
  a 404 (`test/api/deletions.test.ts`). A link cannot carry that header:
  a file of a workspace endpoint is fetched through the API's client
  (`fetchFrom`, so its refusals are read as every call's, the two-step
  notice included) and saved from an anchor put in the document
  (`downloadExport`, `#analytics/export-download.ts`).
- Server Components read the signed-in user with `currentUser()` from
  `#auth/session.ts` (GET /api/me with the request's cookies, once per
  request); the header uses `currentUserOrNone()`, so pages stay up when the
  API is down. Gate a page by the permissions `/api/me` lists for the
  workspace.
- To render a query on the server, give it a `serializationKey`, run
  `prefetch([…])` from `src/api/prefetch.ts` in an async Server Component
  after `await connection()`, and wrap the client component in
  `HydrationBoundary`. `prefetch` does not forward the visitor's cookies, so a
  query that needs them, and anything that depends on the browser (its time
  zone, the current time), renders after hydration (`useHydrated`,
  `useMounted`). Read during the server's render, such a query has failed
  already (the client's `/api` address has no host there) while the
  browser's first render sees it loading, so what the server renders must
  not depend on its result, or React throws away the page's HTML
  (its hydration error). Either form keeps to that: render the component
  that reads the query only once hydrated, its loading state before
  (`ChannelsSettings`, `PlatformsScreen`), or read it and show its loading
  state until hydrated whatever it holds (`!mounted || …`, as
  `ComposerScreen` does, and `OverPlanScreen`'s lists for those who
  manage billing, `listLoadOf`). Tiptap editors set `immediatelyRender: false`.
- Settings pages follow DESIGN.md's "Settings": the layout puts each in
  peal-ui's `SettingsPage` column; a page is sections (`SettingsGroup`,
  `components/settings/settings-group.tsx`) of `SettingsCard`s of
  `SettingsRow`s from `peal-ui/components/settings`, a list's rows or a
  multi-field form (`SettingsCardBody`) in a card, what cannot be undone
  last under **Danger zone**. A setting saves as it changes: a
  `Switch` or a select at once, text through `InlineTextSetting` (saved
  on blur or Enter, Escape puts it back), each with a toast; only forms
  that create something or ask for a password keep a button.
- Settings pages read Better Auth's members, invitations and sessions in
  atoms (`#settings/atoms.ts`), decoding each answer with `authCall`, and
  offer only the role changes its routes accept (`#settings/member-rules.ts`).
  `/list-sessions` lists sessions, each with its token, only to a session
  signed in less than Better Auth's `freshAge` ago (a day), and answers an
  older one 403 `SESSION_NOT_FRESH`, which trying again never changes:
  `SessionsView` says so in one muted row with **Sign in again**, which
  signs this session out and opens `/login?next=` back to the page (any
  other failure keeps **Try again**). Revoking a session needs no fresh one,
  nor does `/revoke-other-sessions` (Better Auth's
  `sensitiveSessionMiddleware`, which keeps the calling session): the
  stale state's card offers the list's own **Sign out everywhere else**
  row under **Sign in again** (`RevokeOthersRow`,
  `components/account/revoke-others.tsx`, its steps in
  `#settings/revoke-others.ts`, tested), so a lost device is cut off
  without signing in first. It tells the other tabs nothing: their
  session, this one, stays.
  Invitations go through `invite` (`#settings/invite.ts`): Better Auth's
  client types roles from its own defaults. Sign-in opens `next` in the
  language the account keeps (`landingOf`), which account settings save
  with `updateUser`: a page of the app always, another unless its path
  names a language, which goes to the router without its prefix (the
  router adds one, so `/fr/fr/…` never). A provider's sign-in lands the
  same: it comes back to the sign-in page, marked (`signInReturn`), as
  only then is the account's language known, and the page, signed in and
  with no `?error=`, sends on to `landingAddressOf`, its language named.
  `next` is a page of the app or nothing (`nextPathOf`,
  `#auth/next-path.ts`, tested): never a path the server answers (`/api`,
  where a short link redirects anywhere, `/.well-known`), a route handler
  of the app (`/pulse`, `/emoji-data`), a path with a dot, a `%`, a
  backslash, `//` or a control character, after a language or not, in any
  case; nor a path naming more than one language (`/en/en/api/…`, which
  next-intl's redirects shorten to `/api/…`). A new route handler at the root joins its `notPages`.
- Client components call Better Auth through `authClient` (`#auth/client.ts`).
  During an OAuth authorization it sends the page's signed query with every
  POST, and Better Auth resumes the authorization after any call that sets
  the session cookie; calls that must not resume it, such as setting the
  active workspace, go through `workspaceClient`. Better Auth error codes map
  to `Auth.errors` in the catalogues.
- The agent's chats and drafts are kept-alive atoms that last as long as
  the tab, so only a new page load drops them (with the rest of the atom
  registry and every module's state). Whenever the person in a tab
  changes, the next page loads anew (`loadAnew`, `useLoadAnew`:
  `#auth/use-load-anew.ts`, `window.location.assign`), never
  `router.push`, and the browser's other tabs of the app are told who is
  signed in now (`tellOtherTabs`, `#auth/session-news.ts`:
  `peal.session-news` in `localStorage`, written and removed at once, so
  only the other tabs hear it; `signedIn` names the person's id,
  `signedOut` nobody); this news is the app's own, measured or not,
  beside the measurement's (`peal.measurement-news`).
- A tab loads anew only when its person changes, never on the news
  alone: the composer and the article editor keep their text in React
  state, and a sign-in elsewhere by the same person (back after a session
  ended) must not lose it. Each tab knows whom its pages showed
  (`#auth/tab-person.ts`, named by `TabPerson` from the signed-in app's
  layout and the OAuth and device pages; none on a page nobody was signed
  in to). `OtherTabsSession` in `Providers` answers the news, and a page
  the back-forward cache restores (`pageshow`, which reads the session
  only then, and only for a tab that showed someone), with `tabAnswer`
  (`#auth/other-tabs.ts`): the same person, or a tab that showed nobody,
  stays as it is; signed out, the tab loads its own address again (the
  server sends it to sign in); someone else, it loads `/` anew, except on
  the pages that keep their place (`keepsItsPlace`: sign-in, sign-up, the
  OAuth pages and `/device`, whose authorization `/` would lose), which
  load their own address again. Before loading anew the tab is marked as
  leaving (`markLeaving`), and nothing is kept for the person it showed
  after that (the Studio's draft as the page goes, `isLeaving`).
- Every way out of the app signs out through `useSignOut`
  (`#auth/use-sign-out.ts`, its steps in `#auth/sign-out.ts`): the account
  menu's and the setup page's **Sign out**, the Security page's **Sign in
  again** and deleting the account. It ends the session with Better Auth,
  forgets the measured person and the support conversation, tells the
  other tabs, then loads the caller's page anew. A refused sign-out
  leaves the person where they are, with the caller's toast; deleting the
  account leaves whatever Better Auth answers (`sessionGone`, the session
  went with the account). A toast the next page must show crosses the load
  in the tab's `sessionStorage` (`#auth/signed-out-notice.ts`), which
  `SignedOutNoticeToast` in `Providers` says once. Nothing else calls
  `authClient.signOut` or imports `forgetConversation`: the lint rules
  (`no-restricted-properties`, `no-restricted-imports` in
  `oxlint.config.ts`) allow them in `use-sign-out.ts` alone.
- A session that ends without **Sign out** (it expired, or was revoked
  from another device, by staff or by a password changed elsewhere)
  brings the tab to `/login` in place, with what it held: every sign-in
  therefore ends with a full load. The sign-in form, password or second
  step, loads the validated `next` anew (`landingAddressOf`,
  `#auth/next-path.ts`, where a provider's sign-in lands too, its
  language named) and tells the other tabs who signed in, as does a
  sign-up on a server that asks for no confirmation (`signedInAtSignUp`),
  which signs the browser in at once. A sign-in whose answer names nobody
  (a provider's, which leaves for the provider first and may be refused
  or left there, and comes back through the sign-in page,
  `from=provider`, which the server sends on; one during an OAuth
  authorization, which Better Auth's client follows by setting
  `location.href`) never tells the other tabs before anyone is signed in:
  it marks the tab (`expectSignIn`, `#auth/sign-in-arrival.ts`, in
  `sessionStorage`), and the next page rendered for a signed-in person
  takes the mark once (`TabPerson`) and tells them who. The confirmation page reads the session once the
  emailed link signed the new account in, and tells them who. Starting
  and stopping impersonation (`UserActions`, `StopImpersonating`) load
  the next page anew and tell the other tabs the person the session is
  now (the account, then the staff member, `impersonatedBy`). Accepting
  an invitation signs nobody in.
- What the browser keeps of a person's work in a workspace, the
  Studio's draft (`#studio/draft.ts`), the agent panel's tabs
  (`#agent/panel-store.ts`) and the analytics board
  (`#analytics/board-store.ts`), is keyed by the person and the workspace
  (`#auth/person-storage.ts`, `peal.<kind>.<userId>.<workspaceId>`, the
  signed-in user's id from the workspace layout, the editor's page and
  the analytics page, each from the request's one reading of the
  session), so it lasts across a sign-out for its owner and nobody else
  signed in on the browser loads it. A component that keeps one takes
  the id as a required prop, so nothing is read or written for nobody. A
  key named by the workspace alone, as older pages kept it
  (`workspaceKeys`, `peal.analytics.board.<workspaceId>` for the board),
  is never read and is removed when found. Deleting the account forgets
  all of the person's (`forgetPersonKeys`); a new kind joins `KeptKind`
  and `keptKinds`, so it is forgotten too.
- Keep the OAuth pages' views (`WorkspacePickerView`) apart from their state,
  so tests render each state: peal-web has no DOM test environment. A view
  under test imports nothing from `#i18n/navigation.ts`, which needs Next to
  run: take links as props or children (`PostItemView`,
  `MediaUsageNotice`).
- Show dates in the reader's time zone. next-intl's server provider hands the
  client the server's zone (UTC in the image): `ViewerTimeZone`
  (`components/viewer-time-zone.tsx`), in the locale layout, sets the
  browser's on the shared provider once the page has hydrated, so every
  page's dates follow it. `InTimeZone` (`components/notices/in-time-zone.tsx`)
  sets a given zone on part of a page. The calendar names the zone it
  reads in with `TimeZoneLine` (`components/lists/time-zone-line.tsx`,
  `Lists.timeZoneLine`, tested), rendered after hydration, beside its
  dates; Analytics shows no such line (the owner's call).
- The support chat (DESIGN.md, "Support chat"): where `PEAL_CRISP_WEBSITE_ID`
  names a Crisp website (`#shell/support-chat.ts`, read per request), the
  workspace layout puts `SupportLauncher` in the bottom bar, which makes
  peal-ui's `<peal-support>` (placement `menu`: nothing shows) with the
  person's email, name, id and workspace and the page's language, never
  while staff act as someone, and the email's signature where `GET
  /api/me` gives one (`supportChat.emailSignature`: the server's, under
  `PEAL_CRISP_IDENTITY_SECRET`, which Crisp verifies; the app never signs
  anything itself); the account menu's **Support**
  (`supportChat`) opens the chat through `openSupportChat` and shows the
  replies waiting (`listenToSupportUnread`). Every sign-out (`useSignOut`)
  calls `forgetConversation`, which resets Crisp's session where it is
  loaded and expires its cookie in every case (the next page may load
  before the reset is done), so the next person in the browser starts
  their own.
- The account menu at the bottom bar's start (`AccountMenuView`, the
  person's avatar with a dot while notices wait unread, and their count
  beside Notifications) polls `GET /api/me/notices/unread` every 30
  seconds while the tab is visible and when it is shown again
  (`useUnreadNotices`, `useRefreshWhileVisible`), and announces arrivals
  in a status region. The frame has no bell and no language switcher:
  the language is chosen on the Preferences page. Polling works through any proxy and needs nothing
  shared between servers; keep it. Write notices from their events with
  `src/notices/notice-text.ts`.
- The composer's parts after the first (`FollowUpParts`) are a thread or
  a first comment, as the contract's `rulesFor` says, but only where this
  server sends them: `usePartsOffered` reads the platforms' capabilities
  (`followUps` null where it sends none: comments the inbox does not
  read, X threads turned off; a LinkedIn profile never) and `partsTaken`
  takes it, so a channel is
  named as taking a post alone there. A part is counted by
  `partRulesFor` (a comment: text alone, its own limits), in the part's
  counters and in `partsFitOn`. The poll (`PostPoll`, `#posts/poll.ts`)
  goes with the first part, in the content only when there is one
  (`pollContentOf`); each channel whose platform would refuse it is
  named with why (`pollProblemsOn`, the server's rules from the
  contract), and the composer neither schedules nor publishes until it
  fits (`pollFitsOn`, folded into `partsFit`). `PollView` shows a poll in
  `PostDetail` and on both review screens, as an approval covers it.
- The composer is laid out as DESIGN.md's "The composer" says: the
  writing in the main column, its properties (peal-ui's `Property`,
  `PropertyLabel` and `PropertyValue`) in the side column, the actions
  in a bar held at the panel's foot. `ChannelsProperty`
  (`channel-picker.tsx`) opens `ChannelChoices`, the command menu's
  parts in `FilterMenuContent`: a search (`answersSearch`'s rule: every
  word in a name, the handle or the platform), **All channels**
  (`everyChannel`: never a channel off or to reconnect), the channel sets
  (`useChannelSets`, applied with `appliedSet`, a toast naming the
  channels no longer connected), the channels grouped by platform
  (`platformGroupsOf`, `#posts/channel-groups.ts`, tested), each
  platform's line ticking its channels that publish among those the
  search shows (`withGroup`, a dash through `groupChoiceOf`), and **Save
  selection as a set** (`SaveSelectionDialog`, for post:update).
  `WhenProperty` opens `SchedulePlacementFields` in a popover, and
  `PostTagsField`'s `property` draws the tags as one (`TagsPropertyView`).
  The text's toolbar is `MediaAttachments`' `toolbar` (the library's and
  upload's icon buttons, the uploader's file input with no drop zone,
  `compact="hidden"`, opened by its button or a paste), with the emoji,
  `AddToPost`, signatures and the assistant around them.
  `ChannelCustomizations` lists the channels chosen, once there is one,
  a line each (`ChannelEntry`), ordered by platform: what its platform
  would refuse (`useFitProblems`), else the required fields still empty
  (`missingRequired`, `#posts/option-rows.ts`, tested), else what it has
  of its own, and its counter (`countShort`). A row
  mounts its fields the first time it opens and keeps them, hidden, once
  closed, so an upload on its way outlives closing it. A row opens by
  itself when its channel joins those whose options need fixing (a
  refusal names it, `refusedChannelsOf`, or an option filled in is one
  the API would refuse), never again once the member closed it while it
  stays there; a TikTok channel's row starts open, so its creator's name
  and consent line (`TikTokChannelOptions`) show before Schedule.
  An open row is a property list (peal-ui's `PropertyRow`): the
  channel's own text (`ChannelTextField`, the post's until **Write its
  own**), its own media (`ChannelMediaField`) and its options, and, where several channels
  of the platform are chosen, gives them to the others (`copiedOptions`:
  never a lookup or a library file, which are the account's, and never
  TikTok's, `copiesOptions`). The poll and the parts are added from the
  text's toolbar (`AddToPost`) and show once they hold something.
- The composer's options come from `TargetOptionsPanel`
  (`components/posts/target-options-panel.tsx`, `bare` inside a channel's
  row: its fields as `PropertyRow`s through `FieldFrame`, each hint shown
  while its field has the focus), which renders the fields
  `#posts/target-options.ts` describes for each selected channel's platform
  (text, number, tags, choice, yes or no, toggle, and `lookup`, a choice
  among what a lookup answers for the account, shown `under` another once
  that one is chosen; `media`, a file of the library by its id, picked
  with `MediaPicker` among the `contentTypes` and size it takes;
  `initial`, `inverted` and `within` for TikTok's
  boxes), turns them into the contract's `TargetOptions` with
  Schema, and shows each `option*` violation under its field. `optionsOf`
  checks each field filled in against the contract alone and answers what
  is wrong (`OptionProblem`: too many tags or mentions for its `maximum`,
  a value the API would refuse), never "no options": the field shows it
  as typed, and the composer neither saves nor schedules until it is
  fixed, so no choice is dropped unseen. `channelOptionsOf` sends a
  channel's options only when the member chose one at least (a value its
  field does not start with): elsewhere a new draft takes the channel's
  defaults, as through the API, and the composer then shows the options
  the saved draft holds, so its next save keeps them. On a TikTok
  channel, `TikTokChannelOptions` reads `GET …/channels/:id/tiktok-creator`
  and limits the fields by the creator (`#posts/tiktok-account.ts`): their
  nickname, their audiences, interactions they turned off (and set off),
  no Duet or Stitch on photo posts, "Only me" closed to branded content,
  the disclosure's label, and TikTok's consent line, as its content sharing
  guidelines require. A field shown once another holds anything (X's
  sharing with followers, once a community is written) has
  `shownWith: { filled: true }`. A field for some media only has
  `shownFor` (`video`, `photos`, or `reel`: one video alone), read from
  the attachments' kinds (`mediaKindsOf`, passed to `isShown`, `optionsOf`
  and `channelOptionsOf`; every field shows while one is being read): like
  one hidden by `shownWith`, it is not sent. The counter takes the
  channel's options (`fitOn`'s fourth argument), as a Mastodon content
  warning counts with the text, and so do `mediaFitOn`, `showsAltText`
  and `partsTaken`, which read the contract's `rulesFor`: a `format`
  (Instagram's and Facebook's first field, a feed post when nothing is
  chosen) gives a story or a reel its own media rules, and a story no text
  (`textNotSent`, said under the counters). A feed post's own fields have
  `shownWith` on `format` (`feedPost`), so a story sends none. On a Bluesky channel,
  `BlueskyChannelOptions` reads the channel's capabilities
  (`channelCapabilities`) and closes each gate its
  account must be reconnected to set (`optionNeedsReconnect`,
  `#posts/bluesky-account.ts`), with the line saying so; a gate the post
  holds stays, to be taken off. On a Pinterest channel, `PinterestChannelOptions`
  reads the account's boards, ten pages of 50 at most, and the chosen
  board's sections (`pinterestBoards` and `pinterestBoardSections` in
  `#posts/api.ts`, as `LookupChoices`): a field shows that its list is being
  read, or why it could not be with a way to ask again, and keeps a value
  the list lacks.
- Tags, signatures and channel sets each have a settings page (list,
  create, edit, delete: views in `components/<feature>/*-views.tsx`, state
  in `*-settings.tsx`, atoms in `#<feature>/atoms.ts`), read with post:read
  and changed with post:update. Their failures are explained from the one
  `SavedItems.errors` catalogue (`#settings/saved-item-error.ts`). Draw a
  tag with peal-ui's `Tag` and `TagDot`, never a colour value.
- Queues have a settings page too (`…/settings/queues`, views in
  `components/queues/queue-views.tsx`, state in `queues-settings.tsx`,
  atoms in `#queues/atoms.ts`), with each queue's next slots on its own
  clock. A save that changed a queue's slots or zone (`timetableChanged`)
  offers, to members with post:schedule and while posts wait in it,
  `QueueReshuffle` (`automations.queues.reshuffle`, after a confirmation that says
  posts moved by hand move too; its view `QueueReshuffleView`): saving
  alone moves no post. The composer's schedule section (`SchedulePlacementFields`)
  chooses a time or a queue (`QueueChoice`, its view `QueueChoiceView`,
  the default preselected), and puts the saved draft or the scheduled post
  on the queue with `posts.enqueue`; the calendar marks queued posts and
  filters by queue, and `PostQueueLine` names a post's queue.
- Repeating posts have a settings page (`…/settings/recycling`, read with
  post:read, paused, resumed and stopped with post:schedule; `?rule=`
  marks the rule a `RecyclingEnded` notice opened it for), views in
  `components/recycling/recycling-views.tsx`, atoms in
  `#recycling/atoms.ts`, the form's request in `#recycling/rules.ts`.
  `PostRepeat`, on a post's page (scheduled in the composer, or out in
  `PostDetail`), shows the rule that repeats or made the post, or offers
  Repeat to a member with post:schedule; a new post repeats once it is
  scheduled, from its page. Refusals are explained from the
  `Recycling.errors` catalogue (`#recycling/rule-error.ts`).
- Follow-up rules have a settings page (`…/settings/follow-ups`, read
  with post:read, paused, resumed and stopped with post:schedule,
  approved with post:approve; `?rule=` marks the rule a post's page
  opened it for), views in `components/follow-ups/follow-up-views.tsx`,
  atoms in `#follow-ups/atoms.ts`, the form's request in
  `#follow-ups/rules.ts`. `PostFollowUp`, on a post's page, shows the
  post's rule or offers Follow up to a member with post:schedule, only
  where a channel the post is on its way to or live on is on a platform
  where `automations.followUps.platforms` says a comment or a repost acts
  (`followUpOfferOn`); its form shows the comment, the repost or both, as
  that answer says.
  Refusals are explained from the `FollowUps.errors` catalogue
  (`#follow-ups/follow-up-error.ts`); what a channel carries reads the
  API's words (`FollowUps.carries`), never a list of platforms of the
  web app's own.
- Comment rules have a settings page (`…/settings/comment-rules`, read
  with engagement:read, started, paused and stopped with
  engagement:reply), views in `components/comment-rules/`, atoms in
  `#comment-rules/atoms.ts`, the form's request in
  `#comment-rules/rules.ts`.
- Feeds have a settings page (`…/settings/feeds`, read with post:read,
  added, paused, resumed and deleted with post:create, a queue's mode with
  post:schedule; `?feed=` marks the feed a `FeedStopped` notice opened it
  for, its items shown), views in `components/feeds/feed-views.tsx`, state
  in `feeds-settings.tsx`, atoms in `#feeds/atoms.ts`. Preview reads the
  address before it is added; a feed's items list what became of each,
  never what it said. A template's placeholders are written in the
  catalogues escaped (`'{title}'`), as ICU reads braces. Refusals are
  explained from the `Feeds.errors` catalogue (`#feeds/feed-error.ts`).
- The composer takes them through components of their own, each wired
  with a few lines: `ChannelSetPicker` (applies a set with `appliedSet`,
  which leaves out and counts the channels disconnected since),
  `SignatureMenu` (`withSignature`, the contract's `signedText`),
  `DefaultSignatures` with `useDefaultSigning` (only the request that
  first creates a post carries `defaultSignatures`, and the composer then
  takes its texts from the answer), `LinkWarnings` (`#posts/link-check.ts`,
  advice that blocks nothing: never flag a working link) and
  `PostTagsField`, which saves tags with the post while it is written and
  at once (`posts.setTags`, `savedOn`) on a post scheduled or out, as
  `PostDetail` does. `ShortenLinks` with `useShortLinking` shows only on
  a server with short links (`links.status`): the member's choice,
  else the post's, else the workspace's `byDefault`, sent as
  `shortenLinks` with every save (the server gives a new post that
  leaves it out the same default, whoever makes it); its line counts with the contract's
  `linksToShorten` (`#short-links/count.ts`), the server's rule. A post
  that asked shows `PostLinks` (its links and their clicks over 30 days)
  to members with analytics:read; the Workspace settings hold the default
  (`ShortLinkDefaultForm`).
- Name a channel with `#channels/channel-name.ts`, never `channel.handle`
  alone: `channelName` wherever one line names it (the workspace's name
  with the handle beside it, "Client A (@handle)"), `channelTitle` where
  the handle is written beside anyway (the channels page, the composer's
  picker). A picker (a select's option, a Filter menu's value and its
  chip, a box to tick) names a channel with `useChannelLabel`
  (`components/channels/channel-label.ts`): `channelName` and the
  platform, "Client A (@clienta) on Instagram", so two channels of one
  name read apart and a search finds them by platform; a Filter menu's
  value also takes the platform's mark (`PlatformMark`), as Analytics'
  widgets do. The comment rules' form offers only the channels that are
  on, on a platform where `automations.commentRules.platforms` says rules
  answer (`ruleChannelsOf`), and its private message where that answer
  says so (`carriesPrivately`); with none, it names each channel there
  that is off or must be connected again, with its fix on the Channels
  page (`heldChannelsOf`), else one line says where rules answer. The
  form waits for both answers (`ruleFormStateOf`). The name is Peal's (`Channel.label`, `RenameChannel`,
  `labelUpdateOf`) and never hides the handle. A channel's own text is
  still labelled with the handle alone. `ChannelPower` turns a channel off, after a
  confirmation, and back on: every string about a channel that is off
  says to turn it back on, on the Channels page, not to reconnect it.
- `DuplicatePost` (post:read and post:create, `#posts/duplicate.ts`) copies
  a post into a new draft and opens it: in the composer through
  `ComposerActions`' `extra`, on a post that went out through
  `PostDetail`'s `actions`, which `ComposerScreen` fills, as the view under
  test imports no navigation. The calendar's chips are links, with no menu.
- A schedule whose save created the post with default signatures that
  changed a text stops there (`pausesToCheck`,
  `#signatures/signing-pause.ts`): the composer shows the saved texts and
  `SignaturePause`, a status region, asks to check them and choose
  Schedule again, which asks for no signature. Never schedule text the
  counters did not count.
- The composer's comforts, each in a component of its own:
  `PublishNowButton` (`#posts/publish-now.ts`) schedules a draft, or
  moves a scheduled post, to the instant the person confirms, through the
  same path as Schedule (save, signature pause, failures); it is never
  offered where `willWait`, as an approval after the post's time
  publishes nothing, nor before the workspace's approval policy is
  known. The composer runs one action at a time (`#posts/one-at-a-time.ts`,
  refused synchronously): a dialog's confirm button stays clickable while
  it closes, and `posts.drafts.create` and `posts.schedule` take no idempotency
  key. While a scheduled post is due, for ten minutes after its time
  (`isDue`), `ComposerScreen` reads it again until it is publishing.
  `PlainTextEditor`'s `onPasteFiles` hands files pasted into a text to
  the `MediaUploader` of the post or of the part (`ref`, a
  `MediaUploaderHandle`), which refuses them while disabled. Files are
  taken only when the clipboard holds no text or HTML: a spreadsheet puts
  a picture beside its cells, which paste as text (`#posts/paste.ts`). `EmojiMenu` (peal-ui's
  `emoji-picker`, on frimousse) inserts at the caret of the editor that
  last had the focus while it is shown (`useEmojiTarget`: a closed
  channel row's text, kept mounted, is never the target) through
  Tiptap's commands. Its
  data is emojibase-data's, served by the app itself at
  `/emoji-data/<locale>/<file>` (a static route handler, prerendered at
  build): never point the picker at another host. Categories are named
  from the catalogues (`withCategoryGroups`). Every place that shows a post's text as text
  gives its element `dir="auto"`, and the editor `textDirection: "auto"`.
- `PostPreviews` is the composer's **Preview**: `PreviewToggle`, in the
  panel's header (`PageActions`, pressed while on), docks it in the side
  column in the properties' place, and it asks `posts.validate`
  (`validatePost`) for the request a save sends (`previewRequestOf` of the
  composer's one `draft`, tags left out: a test fails when the draft and
  the check's request part ways), a second after the last change and only
  while it shows, the post can be written, goes to a channel and
  its options are taken. `previewed` lets the latest request win and `previewOf` dims the
  last answer from the moment the post changes; a failure offers "Try
  again", a `Forbidden` hides the previews. It draws the text with
  `PreviewedText`, as the review page does, and repeats no violation: it
  marks the channel and points to its row under Each channel. Never imitate a platform's look.
- The posts list (`…/posts`, `PostList`, views in `post-list-views.tsx`)
  keeps its filters in the query string (`#posts/post-list-filter.ts`:
  `filtersOf`, `queryOf`, `withFilter`), so a link shows the same list,
  and asks `posts.list` (`postSearchPage`) with them; "Show more"
  passes the page's cursor with the same filters and sort, as the API
  requires. An outcome is a filter on finished posts only. Its tabs
  (`postViews`, `postViewPath`) are All, Drafts, Scheduled and Needs
  approval: drafts and approvals have no page of their own, G then D and
  G then A open the tabs (`goViewKeys`, `#shell/keys.ts`), and the old
  `…/drafts` and `…/approvals` redirect to them. Members with
  post:approve decide there, through the calls the post's review makes
  (`usePostDecisions`, which `PostDecisionsProvider` gives the list):
  a decision names the approval read, so a post changed since is refused,
  from `approvals.list`, or, for a post that list leaves out (it holds
  the 100 oldest), from the post's own review, which its row reads. The
  approve and request-changes mutation atoms are not concurrent (a
  second call interrupts the first and may settle with its result), so
  every decision of the list, from a row or the choice, waits its turn
  (`oneAfterAnother`, `#review/decision-queue.ts`) and the list's
  buttons wait while one runs. Decisions show on a row that waits
  (`PostDecisionActions`, through `PostItemView`'s `trailing`: under the
  text on a phone, at the row's end from 640 px) and as actions of the
  choice in `PostSelectionBar` (**Approve**, V, which asks first;
  **Request changes**, R, with one comment in `RequestChangesDialog`),
  one toast saying how it went.
- The CSV import (`…/posts/import`, `PostImport`, views in
  `post-import-views.tsx`, states in `#posts/import-state.ts`) never
  parses the file: the browser reads it as text (`#posts/import-file.ts`,
  the CLI's bounds, a leading BOM dropped) and the server is the one
  reader of CSV, so the check and the import cannot disagree. Choosing a
  file sends it with `dryRun`; **Import** is offered only once every row
  is valid, asks once, and sends the same file under the
  `Idempotency-Key` made when that check passed, kept for a retry and new
  for each check, one request at a time (`oneAtATime`). A row's refusal
  and a file's problem get their words from `#posts/import-refusal.ts`,
  matched exhaustively, so a refusal the contract adds needs words to
  compile; never show the server's English `message`. A
  `PlanLimitReached` among the rows opens the upgrade dialog
  (`OfferUpgrade`), as it comes inside a 200 answer.
- A pending invitation's **Copy link** (`#settings/invitation-link.ts`)
  copies the emailed link, which Better Auth lets only a session of the
  invited, verified address accept: there is no open invitation link.
- The posts page has two layouts (`#posts/posts-layout.ts`, tested): the
  list and the calendar, `?layout=calendar` in the address. Display
  offers them first (`DisplayMenu`'s `layouts`, peal-ui's
  `DisplayLayouts`, through `usePostsLayouts`), in both layouts' toolbars;
  choosing one writes `layoutQuery`, which carries the channel, tag and
  queue filters both read (the list keeping the first of several) and
  leaves the rest. The calendar writes its own query behind its layout
  (`calendarLayoutQuery`). `PostsActions` are the page's actions in both.
  The calendar has no line in the sidebar: the command menu and G then C
  open it (`navigation.ts`'s `calendar`, its path the posts page's with
  the layout).
- The calendar filters the posts it loaded in the browser
  (`#posts/calendar-filter.ts`) through `CalendarToolbar`, the list
  toolbar of DESIGN.md (views as tabs, the way through time, the Filter
  menu, whose channels, tags and queues each keep several, and chips),
  and keeps its view, date and filters in the address
  (`#posts/calendar-query.ts`: `calendarStateOf`, `calendarQueryOf`, the
  defaults left out), so a link shows the same calendar; it links each day and
  each hour still to come to `…/posts/new?at=YYYY-MM-DDTHH:mm`
  (`#posts/start-time.ts`), which the composer reads on the viewer's clock
  and ignores when malformed or past.
- The calendar has a day, a week and a month view. The day view
  (`CalendarDayView`, links passed in, rows from `#posts/day-rows.ts`,
  tested) has a row per instant that holds a post or a queue's slot, each
  queue's slots read on its own clock with `instantOf`'s daylight saving
  policy over the queue's dates two before to two after, a slot held by
  a post of its queue (scheduled, waiting or going out, or any at a time
  past; a filtered one too: `slotHolders`) never shown free; on a day the clocks change, times
  carry their zone's name, and a free slot at the second of a repeated
  time has no new post link (`slotStartOf`), as the composer reads the
  earlier. A month cell's "more"
  opens its day. A tag's colour shows only in its dots (`ChipTags`), as a
  post's state is the one colour a chip carries (DESIGN.md).
- Times of day follow the browser's own preference (`#i18n/hour-cycle.ts`,
  in `localStorage`, chosen on the Preferences page): `ViewerHourCycle`, in the
  locale layout, gives every message's `{at, time, short}` the clock
  chosen, and code that formats a time itself adds `useTimeOptions()` to
  its options. The server renders the language's clock; the preference
  applies after hydration.
- The media library (`components/media/media-library.tsx`) narrows its
  pages with `LibraryToolbarView` (a search field, then the Filter menu
  with the kind, `#media/library-search.ts`: `queryOf`, and the atoms'
  `pageKeyOf`), asking once the person pauses (`useDebounced`,
  `searchDelayMs`): never a request per key. The search lives in the
  address (`librarySearchOf`, `libraryQueryStringOf`), written with
  `history.replaceState` as it changes and read when the page opens and
  on `popstate` only, never as it is written, which would race the keys. A file's name
  is the member's text, rendered as text; one without a name is called by
  its kind (`useMediaName`). A thumbnail, a button of the card's own
  with an inset focus ring, opens `MediaPreviewDialog`: no taller than
  the window (`max-h-[90dvh]`), its title and close button fixed, the
  file and its text scrolling below them, the focus back on the
  thumbnail once closed; an image whole, a video muted with controls, a
  document as a link to a tab of its own, never embedded. The toolbar is
  a `search` landmark, `SearchStatus` (an `output` that stays mounted)
  says what a search found, and clearing a search focuses the field.
  With nothing to show, `LibraryEmptyView` is the empty state: no file
  yet, with Upload (`MediaUploaderHandle.choose` opens the uploader's
  picker), or, while a search narrows the library, none matching, the
  strip counting the whole library's first page as hidden, and Clear.
- A channel's row holds `ChannelMediaField`, a channel's own media
  (`MediaAttachments` with a `label` of its own), started from the post's. `#posts/channel-media.ts`
  (tested) turns the texts and media by channel into overrides: a channel
  with media and no text of its own sends the post's text, and reads back
  as following it (`channelTextsOf`); with no text at all its media are
  not sent: the composer neither saves nor schedules, and
  `ComposerActions` says why beside its buttons (`blocked`). Counters and
  media checks read each channel's own (`attachedOn`). A scheduled or held
  post's page lists its channels in `PostChannels`
  (`components/posts/post-channels.tsx`, through `posts.removeTarget`,
  for those who may cancel it), every one removable but the last;
  `connectedTargets`, the list's channel names and the calendar's channel
  filter leave a `dropped` target out, and the composer is keyed by the
  count of them so it starts again after a removal.
- The composer's attachments come from `MediaPicker` (ready media of the
  workspace) or `MediaUploader` (`onUploaded` attaches ready uploads).
  `#posts/attachments.ts` keeps the list: order, alt text seeded from the
  library description, `maxMediaPerPost` at most. `#posts/media-fit.ts`
  checks it against the contract's platform rules, so Schedule waits until
  nothing would be refused. Keep `MediaUploader` mounted while the post is
  editable and pass `disabled` while it is busy: unmounting it cancels the
  uploads in flight.
- A span of days is chosen with `PeriodMenu` and `usePeriod`
  (`components/lists/period-menu.tsx`), never a select of a screen's own:
  the billing usage history and the partner's usage per customer in
  their card's header, each in the address as `?period=` (the default
  left out). An analytics widget keeps its own period in the board,
  chosen in its Filter.
- Charts use peal-ui's `chart` (recharts) and come with the same figures as
  a table, behind **Chart** and **Table** tabs; the chart itself is
  `aria-hidden`. An analytics widget is the exception: one chart, no
  tabs, its table `sr-only`. Write calendar days, such as a summary's, in UTC
  (`#analytics/report.ts` `dayDate`), and instants in the reader's zone.
- The analytics page is a board of widgets (DESIGN.md, "Analytics
  board"; `components/analytics/widgets/`): `AnalyticsBoard` lays them
  out, `WidgetCardView` draws one, `widget-bodies.tsx` holds what each
  kind shows (views that take links and excerpts as components, so
  tests render them), `widget-controls.tsx` the Filter, the menu and
  renaming, `add-widgets.tsx` the sheet. The kinds, their widths
  (starting and least), periods and channel filter, the board's
  changes, sizes (`sizeFor` snaps a resize to whole columns and rows)
  and each period's days are `#analytics/widgets.ts` (pure, tested): a
  new kind goes there, with its name and line in `Analytics.widgets`.
  The grid's rows are fixed (`--widget-row`), so every body fills its
  card: charts take `flex-1` and stretch, lists show as many rows as the
  widget's height allows (`room`). Resizing pulls any edge or corner (`pulls`:
  the signs of the sides it moves; pulled from the start or top, the
  card also moves by `--resize-x` and `--resize-y`, so its other side
  stays) with pointer capture: the card follows the pointer to the pixel through
  `--resize-width` and `--resize-height`, set once a frame outside
  React, then the size snaps (`sizeFor`, from the grid's computed
  columns and rows), committed in `flushSync` so every widget glides
  from its noted place (`glideFrom`, Web Animations; none under reduced
  motion); the end and bottom pills alone take the arrow keys, the others staying out of the tab order.
  Moving is `@dnd-kit/react`'s sortable (`SortableWidget`, its handle
  `handleRef`), which animates the others aside and takes the keyboard;
  the board takes the order on drop (`isSortable`, `index`). `@dnd-kit/dom`'s
  `Feedback` (`boardPlugins`) sets the drop's curve, the one `glide`
  and `settle` share (`motion`); dnd-kit hides the placeholder it leaves,
  so its slot is drawn by the placeholder's `::after`
  (`data-[dnd-placeholder]:after:visible`), a skeleton with peal-ui's
  `bg-shimmer`. It ignores untrusted pointer
  events: check a move in a browser with its keyboard (Space, arrows). The board is
  the person's, kept for them and the workspace in `localStorage`
  (`#analytics/board-store.ts`, `peal.analytics-board.<user>.<workspace>`
  through `#auth/person-storage.ts`, the user's id from the analytics
  page; decoded with Schema, the default board when nothing is kept or
  it does not read), the same in every tab through the storage event.
  Nothing is written until the person changes it; **Reset layout**
  writes the default board under their key alone. A widget reads the
  dashboard of its own range (queries of one range are shared), and
  one channel's series beside it when it shows one channel
  (`channelFigures`). Best times (`best-times-view.tsx`) takes one
  channel, over 30, 90 or 180 days, with the best hours, a weekday by
  hour grid (`aria-hidden`; three best hours and no footnote one row
  high, `compact`) and the same figures as a table (`BestTimesTable`,
  `sr-only` in the widget), in words
  that say it is the channel's past, never a prediction, and that
  nothing is ranked under the floor (`Analytics.bestTimes`).
- A post's counts (`PostMetrics`) show on its page in `PostDetail`, after
  its channels, to members with analytics:read once it is live on a
  channel: the composer never shows them, as a post it opens has gone
  live nowhere. Each channel the post went out on is a row, named as its
  card is (`channelNamed`), whose state is `countsRowsOf`
  (`#analytics/post-counts.ts`, tested): its counts and when they were
  read, or why there are none. It promises no time: a channel analytics
  follows, or may still follow (`followedWithin` of going live), says its
  counts show once read, or that a channel turned off or to reconnect is
  not read; a post removed from its platform, and a story, are never
  read. Why reads ended
  comes from what the page holds (the window, `removedAt`, a channel
  gone), as the contract says only that they did. The readings chart
  draws its lines in colours of 3:1 or more, three of them dashed
  (`readingLines`), never lavender or yellow, and marks days, or hours
  with the day where it changes, on its time axis (`readingTicksOf`).
  The counts are read once for each state of the post's channels
  (`postAnalytics`' `revision`, `channelsRevisionOf`), so Unpublish or
  Post again reads them again. It names the platforms this server counts
  from its capabilities (`GET …/channels/capabilities`,
  `analytics.perPost`: `countedOn`), never from the contract's
  `countedPlatforms` alone: X is counted only where `X_ANALYTICS` is on.
  When it may not read the capabilities, it promises no count, and names
  as uncounted only the platforms Peal has no reader for.
- The composer's parts are `FollowUpParts` (`components/posts/
  follow-up-parts.tsx`, state in `#posts/parts.ts`): each part its own
  text, media and wait, checked against each selected channel as a post
  of its platform, and refused in words on a platform that takes a post
  alone. A part's text of its own on a channel (`overrides`, which the
  API and other clients set) is shown, counted for that channel
  (`partTextOn`) and editable, or dropped for the text for all channels:
  the composer never sends a text it does not show.
- The inbox is a split view (DESIGN.md, "Split view"): `navigation.ts`
  marks the page `split`, so `FrameView` leaves its header and footer to
  `SplitView`, which the inbox's layout draws (`InboxSplit`: the list, and
  the page under it beside it, an item open once the address goes past
  `/inbox`). `InboxList` (`inbox-list.tsx`) holds its tabs (Comments;
  Reviews while the workspace has a location with reviews; Messages for
  `engagement:readMessages`), the comments' Filter in the header
  (`PageActions`: Status, waiting for an answer, and Channel) with its
  chips, and the rows (`inbox-rows.tsx`: links passed in, the open one
  `aria-current`). What it shows is in the address
  (`#inbox/inbox-query.ts`: `?view=`, `?status=waiting`, `?channel=`),
  which each row's link carries. An item's page draws `SplitDetail`
  (its name in an `h2`, the way back on a phone, to the list with the
  page's query: `inboxStateOfParams` reads its `searchParams`); `/inbox`
  itself is the empty detail. Whose messages Peal reads is chosen at
  `…/settings/messages` (`channel:connect`), not in the inbox.
- The inbox's reviews (`review-screen.tsx`, views in
  `review-views.tsx`, atoms in `#inbox/review-atoms.ts`) list a
  location at `…/inbox/reviews/[threadId]`: stars, text as text, the
  reviewer's display name or "anonymous", a photo count (never a photo),
  the location's reply with Google's moderation; a reply counted in
  UTF-8 bytes (Google's 4,096), withdraw (confirmed in a dialog) and
  "needs no answer" where the channel's `abilities` say `available`. It
  reads as DESIGN.md's `split-thread`, like a post's comments:
  `ReviewSummaryView` on top, each `ReviewView` flat (avatar, a muted
  line with stars, date and state, `xs` ghost actions with Reply first,
  the location's reply and Peal's behind a 2 px line), and one
  `ReviewReplyBoxView` sticky at the pane's foot, naming the reviewer
  Reply chose (the oldest still waiting until then), with a new
  `Idempotency-Key` for another review. Whom it answers and under which
  key is `#inbox/review-target.ts`, and what the member chose
  `#inbox/composer-choice.ts`, as for comments: the first keystroke pins
  the draft to its review, so a refresh that answers that review
  elsewhere never moves the text to another reviewer, and sending or
  emptying the draft lets go, so the box moves on to the next review
  waiting. A failure shows only under the review it was sent to.
- The inbox's direct messages (`message-screen.tsx`, views in
  `message-views.tsx`, atoms in `#inbox/message-atoms.ts`), for members
  with `engagement:readMessages`, open one at
  `…/inbox/messages/[conversationId]` (`engagement:readMessages`, a page
  at a time, `?cursor=` for older ones, its links keeping the list's
  query through `withInboxQuery`; as a `split-thread`:
  `ConversationSummaryView`, the messages flat and oldest first, those
  sent from Peal behind a 2 px line, and one `MessageBoxView` sticky at
  the pane's foot with `ReplyWindowView` above it; the box,
  "mark read" and confirming an unconfirmed message take
  `engagement:message`): text as text, never markup, a file count (never
  a file), the box only where `abilities.send` is `available` and the
  reply window is open, under an `Idempotency-Key` kept until the message
  is made; where the window has an end (Messenger's and Instagram's 24
  hours) `ReplyWindowView` says until when, or why the box is gone.
  Reading a conversation never marks it read. The settings
  (`message-settings.tsx`, at `…/settings/messages`) show to `channel:connect`: each Mastodon,
  Bluesky, Facebook Page and Instagram channel's switch (a Meta one says
  who may write before Meta's App Review, an Instagram one the Connected
  tools setting; one refused `reconnect` offers the sign-in with
  `messages=true`; one whose messages Peal reads none of, an Instagram
  account through a business portfolio (`readsNoMessages`,
  `#inbox/message-channels.ts`) or one refused `unsupported`, says so in
  place of its switch), and, for `organization:secure`, the applications let
  read the messages, by client id.
- The inbox (`components/inbox/`) lists threads with counts and never a
  comment's text (`ThreadRowView`), and shows one whole (`ThreadScreen`):
  views in `inbox-views.tsx` take links as props, so tests render each
  state. Its one composer answers the comment Reply chose, else the
  oldest still waiting (`#inbox/comment-target.ts`); the first keystroke
  pins the draft to its comment (`#inbox/composer-choice.ts`), so a
  refresh that answers or deletes it never moves the text to another
  author, and sending or emptying the draft lets go, so the box moves on
  to the next comment waiting. Render a comment as plain
  text, never as markup. Offer reply and moderation only where the
  thread's `abilities` say `available`, show a reply's journal status,
  and for an `unconfirmed` one only the two answers a person gives after
  checking the platform: never a resend.
- A comment's private reply (`PrivateReplyPart` in `thread-screen.tsx`,
  `PrivateReplyView` and `PrivateReplyFormView` in `inbox-views.tsx`):
  its state shows to who may read messages (the server answers it null
  otherwise); "Reply privately" opens a dialog only for
  `engagement:message`, while `abilities.privateReply` is `available`,
  the comment is shown and before its `privateReplyUntil`, and none holds
  the comment (a failed one lets another through). The dialog counts the
  text as Meta does (`privateReplyFit`: Instagram's bytes, Messenger's
  characters), sends under an `Idempotency-Key` kept until the reply is
  made, says one message within seven days and that the person answers
  first, and that saying the message is automatic is the member's to
  write: Peal appends nothing. An `unconfirmed` one offers the two
  answers after checking the conversation, never a resend; `reconnect`
  links to the inbox's message settings.
- The agent (`#agent/*`, `components/agent/`, the `Agent` catalogue;
  DESIGN.md, "The agent") talks to `AgentApi` (`peal-contract/agent`),
  apart from `Api`, through its own client (`PealAgentApi`,
  `#agent/client.ts`). A run is a stream of `AgentEvent`s that
  `agentRun` (`#agent/atoms.ts`) folds into the chat's one atom
  (`agentChat`) with `foldChat` (`#agent/run-state.ts`, pure and
  tested); Stop writes `Atom.Interrupt`, which closes the stream. Both
  are kept while the tab lives, so the page and the panel show the same
  chat and a run goes on when either closes. The agent's answer is the
  markdown `#agent/markdown.ts` reads (paragraphs, lists, bold,
  italics, inline code, links to this origin's paths only: an address
  out of Peal, or a path a browser could read as one, keeps its words,
  as text a tool answered could have the model write a link that
  carries what it read),
  rendered as elements by `AgentMarkdown`, never as HTML. Cards and
  approvals show what the server sent, never the agent's words, and an
  approval all of it (`ApprovalCardView`: the post whole, its media
  through `renderMedia`, `ApprovalMedia`; each channel's settings and
  waits through `#agent/approval-details.ts`, tested); a change past
  `agentApprovalLifetimeHours` reads as expired (`lapsedAt`); a step
  and a change are named from their tool (`#agent/steps.ts`), with a
  word of their own for a tool the list does not know. The panel's tabs
  and the chat shown are the browser's (`#agent/panel-state.ts`, in
  `localStorage` per workspace through `makePanelStore`), around every
  page of the workspace (`AgentPanelProvider` in `WorkspaceShell`).
  The status is read after hydration, as it needs the visitor's
  cookies. Refusals before a run get words from `Agent.errors`
  (`refusalMessage`), never the server's English, and a plan's opens
  the upgrade dialog, which `UpgradePrompts` therefore puts around the
  whole frame.
- Skills (`#agent/skills.ts` atoms through `PealAgentApi`, the
  `agent-skills:<workspace>` reactivity key; `AgentSkills` catalogue) are
  the person's and the workspace's instructions a message picks
  (`skillIds`, three at most). The composer picks them under **+** >
  **Skill** and with "/", ui-sdk's `TriggerMenu` on the field
  (`textFieldAdapter`), whose list and closing are
  `slashSkillsOf` (`#agent/skill-picker.ts`, tested): `ComposerView`
  sends nothing on a key the open menu took (`defaultPrevented`,
  `isMenuOpen`), and Escape is the menu's own. The menu's state lives
  in `SlashSkillMenu` alone: a state change of the component that draws
  the field, set from ui-sdk's input listener, renders before React
  reads the field and puts the text back without the "/". Picked skills are the chat's (`ChatState.skills`, back on
  a refusal), shown as chips; a message of skills alone sends their
  names as its text (`sentTextOf`). The settings page
  (`components/agent/skills-settings.tsx`, views in `skill-views.tsx`)
  explains refusals through `skillProblemOf` (`#agent/skill-refusal.ts`),
  never the server's English; **Use in chat** opens `…/agent?skill=<id>`,
  which the agent page picks once and drops from the address.
- `AssistantMenu` sits in the composer's text section and works on the text
  for all channels. Render it only for members with `assistant:use`, and
  only while `GET …/assistant` answers `available`; refresh that status after
  every request, which can change the requests left. Show each suggestion in
  a preview the person accepts or discards: never apply one unasked.
- While the status's `source` is `workspace`, the workspace's own text
  provider writes: the menu says so instead of the requests left, and
  never blocks on them (`assistantBlockedBy`). The assistant settings page
  (`AiSettings`, `components/assistant/ai-settings.tsx`) is two sections.
  **AI providers**: a row per connected provider (`ConnectionRowView`: its
  mark, its name, the host when it is not the provider's own address,
  **Key saved** or **Key unreadable**) whose **Edit** opens its form in a
  dialog (`ConnectionFormView`: the key, the address under **Advanced**,
  typed up front for **Another provider**, `openai-compatible`; **Test**
  where `testModelOf` knows a model, **Remove** after a confirmation), and
  **Connect a provider** at the section header's end (`ConnectDialogView`),
  the same form with the picker of the providers not connected yet
  (`connectable`). **Models**: a row per use of the contract's
  `AiCapability` (`ModelRowView`: its icon, what it is for, the provider
  select of the connected providers that offer it (`providerChoicesFor`)
  with "This server's model", or "Off" where the server has none, then the
  model, the catalogue's suggestions and **Another model…**, a field saved
  on blur or Enter), each applied at once with a toast; a provider without
  suggestions waits for the model typed (`startingModelOf`). A later use
  gets its icon and strings there; Video's row offers the providers the
  catalogue gives a `video` offer, and "Off" alone, as the server has no
  video model. Slide videos' row (`composition`) is the provider select
  alone (`takesModel` false): choosing Shotstack saves at once and sends
  no `model`. Shotstack's form shows no address field: under
  **Advanced** an environment select, production (its own address, the
  default) or its sandbox (`sandboxAddressOf`, `sandboxChosen`, free and
  always watermarked, with its sandbox key), and its row says when it is
  in the sandbox (`isSandboxAddress`); it writes no text, so no **Test**. The catalogue's order and what each
  provider offers are `#assistant/provider-catalogue.ts`, from
  `peal-contract/ai-providers`, so a new provider is added there; the
  form's request is `changeOf` (`#assistant/connections.ts`: the address
  only when it is not the provider's own, the key only when typed), its
  refusals `connectionErrorKey` and `testFailureKey`, a choice's
  `modelErrorKey` (`#assistant/models.ts`). A provider's mark comes from
  simple-icons when it has one, its initial otherwise. Every change passes
  `providersChanged`, which reads the providers, the models and the
  status again, and closes the dialog.
- The assistant's first item, "Write a post…" (`AssistantWriteForm`),
  takes a subject, a tone and, among the post's platforms with a short
  limit (`writablePlatforms`), one to fit: offered with or without text,
  its suggestion shows in the same preview.
- `GenerateImage` (`components/media/generate-image.tsx`) makes an image
  into the library, in `MediaPicker` (the new image is picked) and on the
  media page, for members `canGenerateImages` allows (assistant:use and
  media:upload) and only while the status answers `images.available`; it
  shows the cost and the requests left (`imageAllowanceHint`) without
  blocking: a refusal of the quota or the storage opens the upgrade dialog,
  the free plan's and a trial's included. `GenerateVideo`
  (`components/media/generate-video.tsx`, helpers in `#assistant/videos.ts`)
  sits beside it on the media page, for the same members, only while the
  status answers `videos.available`: its dialog offers what the chosen
  provider's `video` offer takes (`videoAspectsOf`, a length only where
  `videoDurationsOf` lists some, a first frame through `MediaPicker` where
  `imageInput`), sends `videoRequestOf` and answers at once, as the server
  makes the video in a job; refusals read `Assistant.videos.errors`
  (`videoFailureKey`), storage's opens the upgrade dialog. `VideoJobs`
  shows the jobs still on their way as placeholders (`VideoJobsView`,
  `video-jobs-view.tsx`), reads `videoGenerations` again every five seconds
  while one is and the tab is visible (`useRefreshWhileVisible`), and, for
  each that ended since (`endedSince`), toasts how, a failure with its
  reason (`Assistant.videos.reasons`), and reads the library again
  (`libraryChanged`) when one came. `GenerateVoiceover`
  (`generate-voiceover.tsx`, helpers in `#assistant/audio.ts`) sits beside
  them while the status answers `voiceovers.available`. `GenerateSlideshow`
  (`generate-slideshow.tsx`, helpers in `#assistant/slideshows.ts`) sits
  beside **Generate a video** while the status answers
  `slideshows.available`; while `slideshows.paymentMethodRequired` its
  button opens the upgrade dialog instead (`slideshowsNeedPayment`, the
  `feature` reason of `#billing/upgrade.ts`, which a
  `CompositionNeedsPayment` answer opens too). Its dialog picks 2 to 10
  JPEG or PNG images through `MediaPicker` (`isSlideImage`), listed as
  rows in order (`withPicked`, `moved`, `removed`) each with a caption
  and a motion, an optional voice-over (`isVoiceover`: audio of a known
  length), the shape, each image's length or **Fit to the voice-over**,
  and the transition; it says the total and why it cannot be sent yet
  (`slideshowProblemOf`), names the sandbox when the connection is it,
  and sends `slideshowRequestOf`. Refusals read
  `Assistant.slideshows.errors` (`slideshowFailureKey`), storage's and a
  payment method's open the upgrade dialog. `SlideshowJobs` shows the
  jobs on their way (`SlideshowJobsView`, beside `VideoJobsView`) as
  `VideoJobs` does. The Studio's **Editor** (`…/editor`, DESIGN.md "The
  editor", `components/studio/`) runs Shotstack's Studio SDK
  (`@shotstack/shotstack-studio`, pinned, PolyForm Shield: README,
  "Licensing") with its own interface: `studio-engine.ts` loads its
  `Edit`, `Canvas`, `UIController`, `Timeline` and `Controls` in the
  browser only (a dynamic import), never its `VideoExporter` (a render is
  always the workspace's Shotstack account, through `POST
  …/media/slideshows/edits`) nor its `./internal` entry. Peal restyles it
  in `studio.css` alone (colours, type, radius, and hiding what the server
  does not render) and builds no control of its own over it, so leaving
  Shotstack removes one folder. Its buttons beside the
  preview are `studio-tools.ts` (text; shapes, which are SVG clips, as the
  SDK's toolbar edits those and not Shotstack's shape asset; captions,
  which the SDK links to a sound or a film by itself). The SDK listens to the whole
  page's keys: `isNotForSdk` takes back those of fields, open dialogs and
  menus, and buttons. The SDK's Generate button
  asks `useStudioGenerator`, which makes the file with the workspace's own
  providers into the library; the export sends what was made by its file
  alone (`renderedOf`) and refuses a clip not made yet
  (`waitsToBeGenerated`), as Shotstack would generate a prompt again, on
  the workspace's credits. It opens over the whole window
  (`useFullWindow`, which `FrameView` answers by hiding the sidebar and
  the bottom bar, never remounting the page). The document is Shotstack's Edit
  (`#studio/edit-document.ts`, tested), library files named
  `peal:media/<id>` wherever it is kept or sent, swapped for their
  hour-long addresses only in the preview (`previewOf`, `storedOf`, which
  also writes the SDK's size as the server's aspect and resolution); the
  draft lives in `localStorage` (`#studio/draft.ts`). The SDK loads an
  edit only with a clip on every track, so a new one starts with a text.
  The SDK fetches fonts, WebAssembly and emoji: the committed patch
  (`patches/`, made by `scripts/relay-studio-assets.ts`, which a
  version bump runs again inside `bun patch`) points them at
  `/studio-assets/<host>/…`, a route handler that fetches a fixed list
  of paths (`#studio/asset-relay.ts`, tested), so no visitor's address
  reaches those hosts; the bucket's CORS rule (`media-cors`) takes the
  canvas's GETs. `GenerateVoiceover`'s dialog takes the text, and the
  voice as the provider's `speech` offer takes it (`voiceFieldOf`: a
  select of its voices, a field for a voice's id, or nothing), sent by
  `voiceoverRequestOf`; the new file lands in the library. A card of an
  audio or video file shows `TranscribeMedia` (`transcribe-media.tsx`) to
  members with assistant:use and media:read, while `canTranscribe` (the
  status's `transcriptions`: available, the file ready and within
  `maxBytes`): **Transcribe** shows the transcript with **Copy** and, with
  media:upload, **Use as description** (`describeUpload`, a transcript
  longer than a description disabling it). Refusals read
  `Assistant.audio.errors` (`audioFailureKey`). Audio files show their
  kind's icon in the grid and play in the preview. The library and the picker mark
  `aiGenerated` files. Attaching one, to the post or a follow-up part,
  presets the AI label of each channel whose platform has one
  (`#posts/ai-labels.ts`, through `useAiLabels`): once a channel, only
  while the post can be written, never over a label the member changed,
  which they may turn off. A channel whose label is settled always sends
  its options (`channelOptionsOf`'s `settled`), so a label turned off is
  stored as off. `AiLabelsNotice` says where the label is on, where it is
  not, and when one outlived the media.
- A plan's refusal opens the one upgrade dialog (`UpgradeDialog`, its view
  `UpgradeView`): the limit reached with what the billing account holds
  and its plan (the free tier's accounts or storage, the ceiling before a
  first paid invoice, a legacy plan's own words), then what a payment
  method changes, from the rate card the server answered (`card`, the
  app's own for a member who cannot read billing): for accounts, what the
  order bills for those held (`accountsMonthly`), then the next one
  (`nextAccountOf`, `#billing/ladder.ts`; "free" while it is), or storage,
  every price excluding VAT with France's VAT beside it; the VAT line
  (`VatNote`) and the two currency sentences (`CurrencyNote`), the
  consent box and the order button of the billing page (`Consent`,
  `OrderButton`), then checkout (`useCheckout`:
  `payAsYouGo`, monthly, the one plan sold), back to the page the person
  was on. Where another workspace bills the account (`billedElsewhereOf`
  on the `account` of `GET …/workspace/billing/standing`, which every member
  reads), the dialog names and links it and orders nothing; to a
  member who cannot order, who can; past what any plan holds, how to ask
  for more (`PEAL_CONTACT_URL`). No plan, period or trial is ever
  offered. `UpgradePrompts` puts it around a workspace's pages
  (`(app)/[workspaceId]/layout.tsx`), the setup page at `create` and the
  connect callback. A place that sends something a plan can refuse calls
  `useOfferUpgrade()(exit)` (`useOfferAuthUpgrade` for Better Auth's
  errors), or renders `OfferUpgrade` with the failure it keeps in state,
  beside its own message: add it to every new such place. The same
  layout's `PlanGate` shows `OverPlanScreen` instead of the page,
  billing's aside, while the workspace must come back within its plan
  (`standingOfWorkspace`, read with the visitor's cookies): on the free
  tier it says the account holds more than its free accounts without a
  payment method; a grace shows `GraceBanner` above every page instead.
  Its title, explanation and offer come from the standing and the
  workspace the server read, and show at once, on the server too (the
  offer takes that standing, `UpgradeOffer`'s `standing`, for the
  workspace that bills the account). For those who manage billing, the
  card that chooses what stays shows its title at once, and each of its
  two lists, the channels and the members, rows in their place until the
  browser has read it (`HeldList`: as many as the standing counts, ten at
  most), or that it could not be read, with **Try again**, which reads
  that list again; the confirmation waits for both. The others read who
  can fix it at once.
- A meter's refusal (`UsageAllowanceReached`) opens the same dialog when
  it asks for a payment method (`MeterReached`, `isMeterReason` in
  `#billing/upgrade.ts`: what the month allowed, when it starts again, what
  a payment method includes, never an unconfirmed price); a ceiling
  reached is the page's own message (raise it on the billing page). The
  composer's assistant, the image dialog and the inbox reply box offer it.
  The billing page's `MeterTable` lists `meters`: counts and allowances
  for every member, each unit price excluding VAT and with France's VAT,
  "coming" while `priceConfirmed` is false, and the money so far for the
  workspace that bills the account only; its managers with a payment
  method set the assistant's ceiling (`setSpendCeiling`). X's row is
  money (its units are thousandths of a dollar), "at X's rates", and
  `XPassThrough` below lists X's rates from the rate card with the day
  they were read (`x.ratesReadOn`), France's VAT beside them, the
  workspace's reads (`x`, switched by `setXReads` for its billing
  managers, `xReads` from the screen, on any workspace of the account)
  and, on the billing workspace with a payment method, X's ceiling. An
  X connection refused for a payment method (`xPaymentMethod`) opens the
  dialog, whose words for `xApi` are X's (`reachedX`, `givesX`), never a
  count of units.
- Dialogs fit the window (`DialogContent`: at most the viewport's height,
  scrolling): check a new one at 320 and 375 px wide, in English and
  French, as `upgrade-prompt.e2e.ts` does.
- The billing page shows `GET …/workspace/billing` (`BillingView` renders each
  state, `BillingStep` the cancellation and withdrawal steps): the plan
  (the free tier, per-account pricing with its next invoice, or a legacy
  plan read as it is, with its period's end); the billing
  account's month (`ThisMonth`) for the members of the workspace that
  bills it only, as the server answers `accountDays` to them alone
  (connected accounts, account-days so far, `estimate` excluding tax,
  the next account's price, Stripe's `upcomingInvoice` tax included,
  "the invoice is the one that counts"), any other workspace of the
  account, a partner's customer included, the account's pool and limits
  as its usage does, and never the account's plan card, contract or
  money (the server answers none of them there); a contract whose payment failed
  (`paymentFailed`: past due shows its alert and the portal, unpaid also
  replaces the order), or
  an order refused as `AlreadySubscribed`, sends to the portal; the free
  tier's accounts are the answer's `allowances.channels` (none once staff
  required a payment method, `freeWithoutCard`); a legacy plan shows its
  channels against its allowance and no per-account figures; adding a
  payment method, on the free tier only, behind the unticked box, and
  **Order with obligation to pay**, its refusal beside it, and for a
  legacy plan on the workspace that bills, **Move to per-account
  pricing** (`MoveToPerAccount`), the same order and box: the server ends
  the legacy plan once per-account pricing starts, refunding its unused
  time;
  the ladder (`ladderOf`, from the answer's `rateCard`) with the day rule
  and the two currency sentences; and the other limits. Every price comes
  from the rate card, in US dollars, excluding tax with the amount with
  France's VAT beside it (`withDisplayVat`, `displayVatRate`, labelled
  as France's, with the line that the VAT paid depends on the country
  and that a business with a valid VAT number pays the price excluding
  it): the server knows no customer's own rate. Never type a price. The
  meters (assistant, messages, ads) are left out until they are built.
  It places the order (`#billing/api.ts`), then opens Stripe's checkout
  and customer portal through `billingClient` (`#auth/billing-client.ts`,
  Better Auth's Stripe client), with `disableRedirect` and the page as
  the way back. It links the terms of service at `PEAL_TERMS_URL`. Above
  it, `BillingAccountView` says whose billing account the workspace is
  on, links the billing workspace and the others for their members
  (`linkTo`), and holds the offer to hand the workspace over (offer,
  accept, decline, withdraw); a workspace another bills orders nothing
  (`canManage` only where it bills). Explain a `PlanLimitReached`, and
  Better Auth's `MEMBER_LIMIT_REACHED`, wherever they surface, from the
  `Billing` catalogue and `Auth.errors`.
- Below it, on a server that bills or not, `UsageHistoryScreen` reads
  `GET …/workspace/usage` for the last 7, 30 or 90 UTC days (`usageOf`): the
  totals, a partner's plan when `sharedWith` says so, and
  `UsageHistoryView`'s chart (posts published as bars, channels as a
  line) with `UsageDaysTable` behind the **Table** tab, a dash for a day
  without a snapshot. Its strings are `Billing.usage.history`.
  `UsageHistoryView` takes days, totals and a table, so the partner
  settings' **Usage per customer** (`UsagePerCustomer`,
  `components/settings/partner-usage.tsx`, strings
  `WorkspaceSettings.partner.usageReport`) draws `GET …/workspace/usage/partner`
  with it, then a table of workspaces, external id first, with **Load
  more** for the next pages; the billing page wraps it in
  `WorkspaceUsageHistory`.
- The sign-up and password reset pages read the Turnstile site key at
  request time (`captchaSiteKey()`, `GET /api/captcha`); `useCaptcha` shows
  the widget only with one, sends its token as `x-captcha-response`, and
  resets it after every call, since a token works once.
- The sign-up and sign-in pages read who may sign up at request time
  (`signUpSettings()`, the same answer's `signUp`, `open` when it says
  nothing). By invitation, the sign-up page shows the form only to a
  visitor the invitation page sent (`?invitation=<id>`,
  `signUpFormShown`), whose form sends the id in `signUpInvitationHeader`
  (`invitationOf`), `SignUpByInvitation` otherwise, and the sign-in page
  hides its link to sign up (`offersSignUp`). The server answers `open`
  while it has no account, so the first one can be made. The server decides: its
  `SIGN_UP_BY_INVITATION` reads from `Auth.errors`.
- The confirmation email's link opens `verify-email?token=`, which
  confirms nothing by itself: `ConfirmEmail`
  (`components/auth/confirm-email.tsx`) takes the token out of the
  address bar, posts it once to `/api/auth/confirm-email` on its own
  (`intent: "auto"`, which confirms only from the browser that made the
  account), and says what the server answered (`confirmationResultOf`,
  `#auth/email-confirmation.ts`, tested): signed in; from another
  browser, what confirming there does, with **Confirm my address**
  (`confirm`), after which the person chooses a password; an account in
  use, to sign in on this browser and open the link again, or **This
  account isn't mine**, which asks again before **Delete it so I can sign
  up** (`erase`), the one way a page deletes an account; deleted, so sign
  up again; not deletable, so ask the operator; already confirmed, so sign
  in or choose a new password; a link that no longer works, with the
  resend form. A reset of an account someone used before its address was
  confirmed (`usedBeforeConfirmation`) always warns, with the keys and
  invitations removed, zero included, and what to check: members,
  invitations, webhooks, keys, connected channels (`ResetPasswordForm`). The page sends no Referer and is
  never cached nor indexed (`next.config.ts`, `metadata.referrer`), and
  loads no measurement nor support chat (both live under `(app)`).
- The sign-in pages (sign-in, sign-up, forgot and reset password,
  verify email) have a frame of their own (`frameOf` answers `signIn`:
  no header, no language switcher) and draw `AuthCard`, DESIGN.md's `sign-in` column. The sign-in
  and sign-up pages offer the ways in through `SignInChoices` (its view
  `SignInChoicesView`): the server's sign-in providers
  (`signUpSettings().providers`, `GET /api/captcha`'s `signInProviders`)
  and **Continue with email**, which shows the page's form in their
  place; a server with no provider shows the form at once. The way this
  browser last signed in comes first, as the main action (`methodsOf`,
  `#auth/last-sign-in.ts`), read at request time from the server's
  `lastSignInCookie` (`peal-contract`, set by Better Auth's
  `lastLoginMethod` plugin, `#auth/last-sign-in-cookie.ts`); the sign-up
  page offers them only where its form shows, its providers' sign-in
  with `requestSignUp`, the page's locale and the invitation in
  `additionalData`; the sign-in page asks the same, without an
  invitation, where anyone may sign up (`signInReturn`), so an unknown
  address gets its account in one go, under its own terms line
  (`SignUpTerms`, `providerTerms`). Every address given is a path of this origin. The
  provider's callback comes back with `?error=<code>` and the mark
  `?from=provider` (`signInReturn`, `signUpReturn`, `cameFromProvider`),
  which `providerErrorKey` reads into `Auth.errors`: an application's
  authorization the server refused comes to the sign-in page unmarked, its
  OAuth codes reading as `AUTHORIZATION_FAILED`; marked, the same codes
  (`server_error`, `login_required`…) are the provider's and read as its
  failure, only where a provider is offered; anything else is a plain
  failure, and `error_description` is never shown. Google's mark is
  `GoogleMark`, from Google's assets. Where `GET /api/me` says
  `hasPassword: false`, the security and access page offers `SetPassword` (the reset
  link to the account's address) in place of the password form, and says
  two-step verification and closing need it first (`needsPassword`).
- Creating an account accepts the terms of service: the sign-up page
  says so under every way to sign up, and the sign-in page under its
  providers where they make accounts (`SignUpTerms`), linking
  `PEAL_TERMS_URL` and, when set, `PEAL_PRIVACY_URL` and `PEAL_DPA_URL`
  (`#billing/terms.ts`, read at request time; `documentsOf` picks the
  sentence). Keep that line.
- `src/proxy.ts` rewrites `/api/*` and `/.well-known/oauth-*` to
  `PEAL_API_URL`, read per request. Keep it there, not in `next.config.ts`:
  Next resolves config rewrites at build time and writes the URL into the
  build. It answers 400 to a page path with an encoded slash or backslash,
  or a semicolon (`isRefusedPath`, `peal-contract/path-spelling`), and its
  matcher has an entry for them, as the one for pages leaves out paths with
  a dot (cloudflared drops what follows a `;` in a segment, so `..;` is a
  dot segment to it):
  cloudflared decodes such a path and resolves its dot segments before it
  picks the rule that says whether Access guards it, so
  `/en/admin/users/x%2F..%2Fy` was open to it and the staff console to
  Next.
- `next dev` serves its scripts only to `localhost`: open the app at
  `http://localhost:3001`; on `127.0.0.1` pages never hydrate.
- English is the default language and French the second. Write no user-facing
  string outside the message catalogues, notifications and emails included:
  store events, render them in the reader's language. Give each feature its
  own namespace (`ChannelsPage`, `Posts`, `Media`, `OAuth`…).
- `messages/en.json` is the reference: every other catalogue has exactly its
  keys, which a test and the types check. Use ICU arguments rather than
  building sentences in code.
- English has no prefix (`/`) and French is under `/fr`. Navigate with the
  helpers in `src/i18n/navigation.ts`, not `next/link`.
- A page's language: next-intl's proxy takes the address's, then its
  `NEXT_LOCALE` cookie's, then the browser's. On the signed-in app's
  pages (`isAppPath`) the account's language wins over both: the
  `(setup)` and `[workspaceId]` layouts, from the `/api/me` they read
  anyway, send a page shown in another to the same path and query in the
  account's (`toAccountLanguage`; `accountLanguageAddress`,
  `#i18n/account-language.ts`, tested), from the address the proxy hands
  every page (`x-peal-page`; layouts have no other). The browser can send
  that header too, where the proxy does not run: it is taken only when
  its language and first segment are the route's own params, so it lives
  in the layouts that receive them, not in `(app)`'s, which receives the
  language alone. English is sent to as `/en/…`, and the proxy sets the cookie to
  English there for every request, the router's included, so the address
  without a language does not open in the cookie's again. No new request
  to the API: the layout's own answer decides. Staff acting as someone,
  someone signed out, and every page outside the app (sign-in, review
  links, connect links, OAuth, the staff console) keep next-intl's order.
  So does a page of the app whose address `nextPathOf` refuses (a `%`, a
  raw `//` in its query, a character outside ASCII): it is never sent
  on, and keeps the address's language. The plain frame shows no
  language switcher to someone the account's language decides for.
- Folders in `peal-web` import each other through `#…` (package.json
  `imports`); `#messages/*` points at the catalogues.
- The page is `connect/link` (`components/connect-link/`), which reads
  the token from the fragment, with
  the partner's name and logo (`PartnerOwnership.presentedAs`), or the
  workspace's name. `next.config.ts` gives it `Cache-Control: no-store`,
  `Referrer-Policy: no-referrer` and `X-Robots-Tag: noindex, nofollow`,
  beside the frame headers every page has; `ShellFrame` leaves the app's
  header out of it. A tab that started from a link marks itself in
  `sessionStorage` (`#connect-link/pending-link.ts`), so the platforms'
  one callback page, `connect/[platform]/callback`, finishes the link
  rather than a member's connection. Its strings are the `ConnectLink`
  catalogue; the member's flow is unchanged.
- Ads (`#ads/*`, `components/ads/`, the `Ads` catalogue; a boost is
  "boost" and "mise en avant"). The ads page (`AdsScreen`, ads:read) says
  only that ads are off when `status.mode` is `off`; ads:manage connects
  and disconnects, and only ads:authorize (owners) sees `SpendingFormView`,
  which says what a ceiling allows before its button: keep that text.
  The tab keeps the sign-in's workspace in `sessionStorage`
  (`#ads/pending-sign-in.ts`) for the callback page (`CompleteAdSignIn`,
  its view `AdSignInView`). Connecting Google Ads opens a dialog first
  (`GoogleAdsDisclosureView`, which Google's policy for tools asks of a
  web app): what Peal reads, that it changes nothing though Google's
  consent screen names editing, how often, how to remove it, and a link
  to the docs. Hide what an account's `capabilities` say it lacks (the
  spending form, results, the ads list); show a campaign's `kind` where
  it has one.
- Ad amounts are whole minor units: read what a person types with
  `parseAmount` and write amounts with `useMoney` or `formatMoney`
  (`#ads/money.ts`), with the account's `minorUnitDigits`; never multiply
  or divide an amount. A `Boost` comes without digits: take its account's,
  else `digitsOfCurrency`.
- `PostDetail` offers `BoostDialog` on a published Facebook or Instagram
  channel to members with ads:spend, on a server whose mode is `spend`.
  `checkBoost` (`#ads/boost-draft.ts`) makes the request: days are the ad
  account's calendar, `specialAdCategory` is sent only once declared, and
  an audience in the EU names who benefits and who pays. `quoteBoost`
  comes first, and `BoostSummaryView` shows what it answers (the most the
  boost can cost, the ceiling, what is committed) before the one button,
  which names the amount and the end. `createBoost` carries the
  `Idempotency-Key` made when the review opened: never make one per
  click. Explain every refusal with `adsErrorOf` and `useAdsErrorLines`:
  a new contract error gets its words in `Ads.errors`.
- `PostDetail` offers **Unpublish** on a published channel to members with
  post:publish (`components/posts/live/`: `LivePostActions` reads the
  post's changes and the platforms' capabilities, `LivePostView` shows
  each state of `liveStateOf`, `#posts/live-post.ts`), behind a
  confirmation that names the channel and says it cannot be undone;
  `TargetView` shows when a channel was removed and strikes its address
  through, and the calendar dims a post removed from every channel it went
  out on (`isRemovedEverywhere`). Strings are in `Posts.Live`. Beside it,
  `LivePostEditView` offers **Edit** where the platform takes it
  (`editStateOf`), on that part's text on the channel (`partTextOn`) with
  the channel's counter (`fitOn` and the target's options), and says
  when the channel was last edited; `liveStateOf` is `editing` while an
  edit runs, so nothing else is offered then.
- `PostPaid` (ads:read) shows a post's boosts and `PaidSectionView`'s two
  columns, organic and paid: never add them up. Pause and stop take
  ads:spend or ads:manage, resume ads:spend (`controlsOf`); stopping asks
  first, and an `unconfirmed` boost says it may be spending.
- The consent page lets a person leave `workspace:ads` out as it does
  publishing (`mayLeaveAdsOut`, `consentAnswer` in
  `#auth/consent-scopes.ts`).
- Better Auth binds a client's tokens to the session's active workspace
  when the consent is posted, and choosing a workspace in any tab moves
  it: allowing first sets the workspace the consent page shows as active
  again through `workspaceClient`, and fails without consenting when that
  is refused (`makeAnswerConsent`, `#auth/answer-consent.ts`).
- The webhooks settings (`components/webhooks/`) offer an endpoint's
  channels as a picker (`workspaceChannels`) and a partner endpoint's
  workspaces as ids, one a line (`#webhooks/endpoint-draft.ts`; an edit
  always sends `channelIds`, an empty list hearing every channel), a status
  and event filter on each log, a **Failed** tab across endpoints
  (`searchPage`), "Send all failed again" naming how many and the hour's
  budget, and a test event type (a sample). Headers are rows (`HeaderRow`):
  a saved one shows its name and its value as "set", never the value, and
  keeps it unless typed again; an edit sends `headers` only when a row
  changed, the whole list, a saved row without a value by its name alone
  (the server keeps its value). Values are typed in password fields. Every
  string is in the `Webhooks` namespace, en and fr.
- Two-step verification (`TwoStep` catalogue): the sign-in form asks for
  the second step in place (`TwoStepChallengeView`, its state in
  `sign-in-form.tsx`) when the answer has `twoFactorRedirect`, so an OAuth
  authorization's signed query is kept: never set the client plugin's
  `twoFactorPage`. The security and access page's `TwoStepSection` draws the key's QR
  code in the browser (`qrcode.react`, SVG) beside the key as text; the
  URI and the recovery codes stay in component state, sent nowhere but to
  Better Auth's routes, never logged. A workspace that requires it shows
  `TwoStepRequiredNotice` instead of its pages to a member without it
  (`(app)/[workspaceId]/layout.tsx`); a 403 `twoStepRequired` met later is
  read once, in the API client (`#two-step/refusals.ts`), and
  `TwoStepRefusalWatch` reads the page again. The owners' switch is
  `settings/security`.
- Articles (`#articles/*`, `components/articles/`, the `Articles`
  catalogue, under Posts in the sidebar at `/articles`) go to a website's
  channel. The composer's posts read social channels only
  (`workspaceChannels` filters with `isSocialChannel`, and the posts area
  types its channels `SocialChannel`); a website's are `workspaceSites`.
  A post may go to a website through the API, which the composer does
  not show yet: `ExistingPost` shows a notice instead of the composer
  for one (`goesToWebsite`, over `websiteChannelIds`), so saving it here
  never drops its website.
  The body's editor (`rich-text-editor.tsx`) is StarterKit with only
  what the server's allow-list takes (headings 2 to 4, no underline,
  links on http, https or mailto) and `ArticleImage`, a library file by
  `mediaId` shown through the media API's address, never one kept in the
  article: add a node or a mark to the server's `rich-body.ts`
  (`src/shared/domain/rich-text/`) first.
  Slack connects with a sign-in button, as Pinterest and Snapchat do
  (`buttonPlatforms`), the channel picked on Slack's page.
  A chat connects with `ChatFields` (`connect-chat.tsx`), offered from
  the connectable platforms' `chats`: Discord's webhook address, or
  Telegram's bot token and chat, typed in password fields, each refusal
  worded with its fix (`chat.<reason>` in `ChannelsPage.errors`); the
  card links the docs page where `PEAL_DOCS_URL` is set, and a chat's
  channel reconnects through the same form (`ReconnectChat`).
  A website connects with `WebsiteFields` (`connect-website.tsx`): the
  application password goes to the server once, and a site's channel
  reconnects through the same form, as it has no sign-in.
- The Channels page (`ChannelsSettings`, its view `ChannelListView`) is
  a list (DESIGN.md, "Pages"): views, the Filter's Platform, Type and
  Feature, and Display's ordering (`orderedChannels`) in the address
  (`#channels/channel-filter.ts`), the toolbar over the empty state too,
  no connecting on it. **New channel** opens `…/channels/new` (`NewChannel`): the
  catalogue (`PlatformCatalogueView`) of `connectablesOf` (what
  `channels.platforms` answers, the websites by key and the chats it
  names), then one platform's `ConnectForm` at `…/channels/new/<platform>`
  (named with `PageTitle`). What Peal
  does on a platform is `featuresOf` (`#channels/platform-features.ts`):
  analytics from the server's capabilities (`countedOn`), comments from
  the contract's `inboxPlatforms`, and `messagePlatforms`, which the
  inbox's message settings read too; a feature Peal gains is added there.
- The panel header's breadcrumb is `navigationOf`'s `breadcrumb.trail`:
  the steps a page is nested under (`Crumb`), each a link
  (`crumbHrefOf`) that `WorkspaceShell` renders. A page nested under
  another gets its steps there (`trailOf`), never a "Back" link of its
  own; one that names its item (`PageTitle`) keeps them.
