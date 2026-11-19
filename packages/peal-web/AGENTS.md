<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Web front

- Build screens from `peal-ui` components and Tailwind classes; add no other
  stylesheet.
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
- Pages live under `src/app/[locale]/`: the auth pages (`sign-up`, `sign-in`,
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
  app at the root, in the `(app)` route group: `/` (no page: it opens a
  workspace, below), `agenda`, `report`, `notices`,
  `notices/preferences`, `account`, `new` (a new workspace; in the
  `(personal)` route group), `[workspaceId]` (the workspace's home: the
  measurement's question, connecting channels and assistants, a
  quickstart), `…/platforms` (PealAPI's, for channel:read),
  `[workspaceId]/channels`, `…/media`, `…/calendar`,
  `…/analytics`, `…/inbox` (a split view, its layout the list, for
  `engagement:read`: not-found otherwise, as for staff acting as a member)
  with `…/inbox/[threadId]`, `…/inbox/reviews/[threadId]` and
  `…/inbox/messages/[conversationId]` beside it, `…/ads`,
  `…/posts` (every post, whatever its state, for post:read and
  channel:read; its tabs are the drafts and the posts that need an
  approval, and `…/drafts` and `…/approvals` only redirect to them),
  `…/posts/import` (a CSV file's posts, for
  post:schedule, post:read and channel:read), `…/posts/new`,
  `…/posts/[postId]`, which opens
  a draft or a scheduled post in the composer, and shows a post that went
  out in `PostDetail` (each channel's status, attempts and reasons, with
  repost and confirm, and its analytics), `…/settings` (with `members`, `invitations`, `tags`, `signatures`,
  `channel-sets`, `queues`, `recycling`, `feeds`, `api-keys` and `webhooks`) and `…/billing`. The staff console is
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
  `ShellFrame` leaves every page of the app (`isAppPath`: `/`, the
  person's pages and a workspace's) to its layouts (`frameOf` answers
  `own`). `FrameView` (`components/shell/`) is the frame both
  draw: a sidebar on the page's background (in a `Sheet` on a
  phone; its links close it through `useCloseMenu`), the page in a white
  panel under a 48 px header (the breadcrumb, the page's `h1`, its
  actions), the contract functions closing its content, and a bottom bar
  across the window: the account menu at its start (`AccountMenuView`),
  Help (**Docs** at `PEAL_DOCS_URL`, **Support** at `PEAL_CONTACT_URL`
  when set, the shortcut sheet) and the agent's place, off for now, at
  its end. `(app)/[workspaceId]/layout.tsx`
  gives a workspace's pages `WorkspaceShell`, whose `SidebarView` holds,
  in its head, the workspace switcher, Search (the command menu) and New
  post, then the PealStudio and PealAPI switch with Peal's mark, the
  mode's pages, a section's pages under a way back, and Settings;
  `(app)/(personal)/layout.tsx`
  gives the person's pages `PersonalShell` (their pages, then each
  workspace). Someone signed out, not a member, or who must first turn on
  two-step verification, gets the app's `PlainFrame`. Which workspace pages
  exist, their mode, their section and the permission each asks is one
  table, `#shell/navigation.ts` (`navigationOf`, tested): add a workspace
  page there, with its name in `WorkspaceShell.pages`; the person's are in
  `#shell/personal.ts`. The frame's panel header holds the page's one
  `h1`, its name: a page draws no title or description of its own, puts
  its main actions in `PageActions` (small ghost buttons, icon first) and,
  where it opens one item, names it with `PageTitle`. Each page also
  exports `generateMetadata = workspacePageTitle("<page>")` (or
  `personalPageTitle`, `#shell/page-title.ts`), its name from the
  sidebar's catalogue, which the layouts' templates follow with the
  workspace's name or "Peal" for the browser's tab
  (`components/shell/frame-view.tsx`). A list page puts its items in
  one bordered list with a line between them, never a card each.
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
  never `reservedWorkspaceSlugs` nor an id's shape), set once: the server refuses another (Better Auth's hooks,
  `INVALID_WORKSPACE_SLUG`) and any change (`WORKSPACE_SLUG_FIXED`);
  renaming keeps it. A new workspace tries its name's words, then the
  words and a random tail (`slugsToTry`, `#workspaces/new-workspace.ts`).
  Error reports and the measurement's patterns write the slug's segment
  `:id` (`pathOf`), as it holds the workspace's name.
- `/` is no page: for someone signed in it redirects to the workspace Better Auth keeps
  active on the session (`activeWorkspaceOf`, `#auth/active-workspace.ts`,
  read only for someone with several), else the first (`homeWorkspaceOf`);
  someone signed out is sent to sign in. A workspace becomes the active one
  when it is chosen: from the switcher, the command menu or the person's
  sidebar, and once created (`createWorkspace`), as Better Auth's own
  update leaves the session's cached cookie naming the last one.
  `chooseWorkspace` (`#auth/choose-workspace.ts`) sets it through
  `workspaceClient` while the link opens, waits for nothing, and only
  reports a failure; views take it as `onChooseWorkspace`.
  Every way in lands there: sign-in's default `next`, sign-up, a confirmed
  address, an accepted invitation, the OAuth pages. Someone with none gets
  `FirstWorkspace` (`components/first-workspace.tsx`): an invitation still
  open opens instead (`openInvitationOf`), as on a server by invitation;
  otherwise it creates, once, the workspace named after the first word of
  their name in their account's language (`AppPage.defaultName`), under
  a slug ending in their id's first characters, so two tabs make one,
  then opens it; staff acting as someone are sent to the account page.
  Another workspace is made at `new` (the switcher's and the
  person's sidebar's **New workspace**), which opens it once made. The
  server's `GET /api/me/overview` (what needs attention in each workspace)
  has no page any more; the CLI and the API still read it. `agenda` lists the next 14 days across
  workspaces (`AgendaScreen`, after hydration: the visitor's cookies, the
  current time and their zone), grouped by day, a filter by workspace and
  **Load more**: a list, never the week's grid, as nothing is moved across
  workspaces. `report` (`ReportScreen`, in the reader's zone) is the
  report across workspaces as a table only, never a chart, as counts of
  different platforms are not alike, which it says in one line: each
  total with its change (`reportRowOf`, `#overview/report.ts`), a dash
  where a count is not given or the range before is not all kept, the
  range switch and **Download CSV** (`/api/me/report/export`). Strings in
  `Overview`.
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
  workspace's home while undecided, `ConsentSetting` on the account page.
- Pages fetch through the client derived from `peal-contract`, with
  `@effect/atom-react`: query atoms come from `PealApi` in `src/api/client.ts`.
  Browsers call `/api`; server code calls `PEAL_API_URL`.
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
  `useMounted`). Tiptap editors set `immediatelyRender: false`.
- Settings pages read Better Auth's members, invitations and sessions in
  atoms (`#settings/atoms.ts`), decoding each answer with `authCall`, and
  offer only the role changes its routes accept (`#settings/member-rules.ts`).
  Invitations go through `invite` (`#settings/invite.ts`): Better Auth's
  client types roles from its own defaults. Sign-in opens `next` in the
  language the account keeps (`landingLocale`), which account settings save
  with `updateUser`.
- Client components call Better Auth through `authClient` (`#auth/client.ts`).
  During an OAuth authorization it sends the page's signed query with every
  POST, and Better Auth resumes the authorization after any call that sets
  the session cookie; calls that must not resume it, such as setting the
  active workspace, go through `workspaceClient`. Better Auth error codes map
  to `Auth.errors` in the catalogues.
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
  sets a given zone on part of a page. Calendar and Analytics name the zone
  they read in with `TimeZoneLine` (`components/lists/time-zone-line.tsx`,
  `Lists.timeZoneLine`, tested), rendered after hydration: beside the
  calendar's dates, and under the Period on Analytics.
- The account menu at the bottom bar's start (`AccountMenuView`, the
  person's avatar with a dot while notices wait unread, and their count
  beside Notifications) polls `GET /api/me/notices/unread` every 30
  seconds while the tab is visible and when it is shown again
  (`useUnreadNotices`, `useRefreshWhileVisible`), and announces arrivals
  in a status region. The frame has no bell and no language switcher:
  the language is chosen on the account page. Polling works through any proxy and needs nothing
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
- The composer's options come from `TargetOptionsSection`
  (`components/posts/target-options-panel.tsx`), which renders the fields
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
  `QueueReshuffle` (`queues.reshuffle`, after a confirmation that says
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
  post's rule or offers Follow up to a member with post:schedule.
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
  at once (`posts.tag`, `savedOn`) on a post scheduled or out, as
  `PostDetail` does. `ShortenLinks` with `useShortLinking` shows only on
  a server with short links (`shortLinks.status`): the member's choice,
  else the post's, else the workspace's `byDefault`, sent as
  `shortenLinks` with every save (the server gives a new post that
  leaves it out the same default, whoever makes it); its line counts with the contract's
  `linksToShorten` (`#short-links/count.ts`), the server's rule. A post
  that asked shows `PostLinks` (its links and their clicks over 30 days)
  to members with analytics:read; the general settings hold the default
  (`ShortLinkDefaultForm`).
- Name a channel with `#channels/channel-name.ts`, never `channel.handle`
  alone: `channelName` wherever one line names it (the workspace's name
  with the handle beside it, "Client A (@handle)"), `channelTitle` where
  the handle is written beside anyway (the channels page, the composer's
  picker). The name is Peal's (`Channel.label`, `RenameChannel`,
  `labelUpdateOf`) and never hides the handle. The text tabs still show
  the handle alone. `ChannelPower` turns a channel off, after a
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
  it closes, and `posts.create` and `posts.schedule` take no idempotency
  key. While a scheduled post is due, for ten minutes after its time
  (`isDue`), `ComposerScreen` reads it again until it is publishing.
  `PlainTextEditor`'s `onPasteFiles` hands files pasted into a text to
  the `MediaUploader` of the post or of the part (`ref`, a
  `MediaUploaderHandle`), which refuses them while disabled. Files are
  taken only when the clipboard holds no text or HTML: a spreadsheet puts
  a picture beside its cells, which paste as text (`#posts/paste.ts`). `EmojiMenu` (peal-ui's
  `emoji-picker`, on frimousse) inserts at the caret of the editor that
  last had the focus (`useEmojiTarget`) through Tiptap's commands. Its
  data is emojibase-data's, served by the app itself at
  `/emoji-data/<locale>/<file>` (a static route handler, prerendered at
  build): never point the picker at another host. Categories are named
  from the catalogues (`withCategoryGroups`). `ChannelPicker` offers
  **Select all** (`everyChannel`: never a channel off or to reconnect)
  from three channels up. Every place that shows a post's text as text
  gives its element `dir="auto"`, and the editor `textDirection: "auto"`.
- `PostPreviews`, beside the composer's text, asks `posts.validate`
  (`validatePost`) for the request a save sends (`previewRequestOf` of the
  composer's one `draft`, tags left out: a test fails when the draft and
  the check's request part ways), a second after the last change and only
  while the post can be written, goes to a channel and its options are
  taken. `previewed` lets the latest request win and `previewOf` dims the
  last answer from the moment the post changes; a failure offers "Try
  again", a `Forbidden` hides the previews. It draws the text with
  `PreviewedText`, as the review page does, and repeats no violation: it
  marks the channel and points down to the counters. Never imitate a platform's look.
- The posts list (`…/posts`, `PostList`, views in `post-list-views.tsx`)
  keeps its filters in the query string (`#posts/post-list-filter.ts`:
  `filtersOf`, `queryOf`, `withFilter`), so a link shows the same list,
  and asks `posts.search` (`postSearchPage`) with them; "Show more"
  passes the page's cursor with the same filters and sort, as the API
  requires. An outcome is a filter on finished posts only. Its tabs
  (`postViews`, `postViewPath`) are All, Drafts, Scheduled and Needs
  approval: drafts and approvals have no page of their own, G then D and
  G then A open the tabs (`goViewKeys`, `#shell/keys.ts`), and the old
  `…/drafts` and `…/approvals` redirect to them. Members with
  post:approve decide there, through the calls the post's review makes
  (`usePostDecisions`, which `PostDecisionsProvider` gives the list):
  a decision names the approval read, so a post changed since is refused,
  from `review.pending`, or, for a post that list leaves out (it holds
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
  in `localStorage`, chosen on the account page): `ViewerHourCycle`, in the
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
- A channel's tab in `TextTabs` takes `renderChannelMedia`: the composer
  puts `ChannelMediaField` there, a channel's own media (`MediaAttachments`
  with a `label` of its own), started from the post's. `#posts/channel-media.ts`
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
  Analytics and the report in `PageActions`, the billing usage history
  and the partner's usage per customer in their card's header, each in
  the address as `?period=` (the default left out); the best-times card
  keeps its own under `?bestTimes=`.
- Charts use peal-ui's `chart` (recharts) and come with the same figures as
  a table, behind **Chart** and **Table** tabs; the chart itself is
  `aria-hidden`. Write calendar days, such as a summary's, in UTC
  (`#analytics/report.ts` `dayDate`), and instants in the reader's zone.
- The analytics page ends with `BestTimesCard`
  (`components/analytics/best-times.tsx`, view in `best-times-view.tsx`):
  one channel at a time, picked, over 30, 90 or 180 days, the best hours,
  a weekday by hour grid (`aria-hidden`) and the same figures as a table,
  in words that say it is the channel's past, never a prediction, and
  that nothing is ranked under the floor (`Analytics.bestTimes`).
- A post's page (`PostMetrics`) names the platforms this server counts
  from its capabilities (`GET …/platforms/capabilities`,
  `analytics.perPost`: `countedOn`), never from the contract's
  `countedPlatforms` alone: X is counted only where `X_ANALYTICS` is on.
  It falls back on the list when it may not read the capabilities.
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
  (its name in an `h2`, the way back on a phone); `/inbox` itself is the
  empty detail. Whose messages Peal reads is chosen at
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
  key is `#inbox/review-target.ts`: the first keystroke pins the draft to
  its review, so a refresh that answers that review elsewhere never moves
  the text to another reviewer, and a failure shows only under the review
  it was sent to.
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
  `messages=true`), and, for `organization:secure`, the applications let
  read the messages, by client id.
- The inbox (`components/inbox/`) lists threads with counts and never a
  comment's text (`ThreadRowView`), and shows one whole (`ThreadScreen`):
  views in `inbox-views.tsx` take links as props, so tests render each
  state. Render a comment as plain text, never as markup. Offer reply and
  moderation only where the thread's `abilities` say `available`, show a
  reply's journal status, and for an `unconfirmed` one only the two
  answers a person gives after checking the platform: never a resend.
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
- `AssistantMenu` sits in the composer's text section and works on the text
  for all channels. Render it only for members with `assistant:use`, and
  only while `GET …/assistant` answers `available`; refresh that status after
  every request, which can change the requests left. Show each suggestion in
  a preview the person accepts or discards: never apply one unasked.
- While the status's `source` is `workspace`, the workspace's own text
  provider writes: the menu says so instead of the requests left, and
  never blocks on them (`assistantBlockedBy`). The assistant settings page
  holds that provider (`TextProviderSettings`: kind, address, model, key,
  a test of the saved one) above the image provider; a change passes
  `textProviderChanged`, which refreshes the status too.
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
  the free plan's and a trial's included. The library and the picker mark
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
  on the `account` of `GET …/billing/standing`, which every member
  reads), the dialog names and links it and orders nothing; to a
  member who cannot order, who can; past what any plan holds, how to ask
  for more (`PEAL_CONTACT_URL`). No plan, period or trial is ever
  offered. `UpgradePrompts` puts it around a workspace's pages
  (`(app)/[workspaceId]/layout.tsx`), the new workspace's page and the
  connect callback. A place that sends something a plan can refuse calls
  `useOfferUpgrade()(exit)` (`useOfferAuthUpgrade` for Better Auth's
  errors), or renders `OfferUpgrade` with the failure it keeps in state,
  beside its own message: add it to every new such place. The same
  layout's `PlanGate` shows `OverPlanScreen` instead of the page,
  billing's aside, while the workspace must come back within its plan
  (`standingOfWorkspace`, read with the visitor's cookies): on the free
  tier it says the account holds more than its free accounts without a
  payment method; a grace shows `GraceBanner` above every page instead.
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
- The billing page shows `GET …/billing` (`BillingView` renders each
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
  `GET …/usage` for the last 7, 30 or 90 UTC days (`usageOf`): the
  totals, a partner's plan when `sharedWith` says so, and
  `UsageHistoryView`'s chart (posts published as bars, channels as a
  line) with `UsageDaysTable` behind the **Table** tab, a dash for a day
  without a snapshot. Its strings are `Billing.usage.history`.
  `UsageHistoryView` takes days, totals and a table, so the partner
  settings' **Usage per customer** (`UsagePerCustomer`,
  `components/settings/partner-usage.tsx`, strings
  `WorkspaceSettings.partner.usageReport`) draws `GET …/usage/partner`
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
- The sign-in and sign-up pages show the server's sign-in providers
  (`signUpSettings().providers`, `GET /api/captcha`'s `signInProviders`)
  above the form (`ProviderButtons`, its view `ProviderButtonsView`), as
  DESIGN.md's Icons say; the sign-up page only where its form shows, its
  sign-in with `requestSignUp`, the page's locale and the invitation in
  `additionalData`. Every address given is a path of this origin. The
  provider's callback comes back with `?error=<code>` and the mark
  `?from=provider` (`signInReturn`, `signUpReturn`, `cameFromProvider`),
  which `providerErrorKey` reads into `Auth.errors`: an application's
  authorization the server refused comes to the sign-in page unmarked, its
  OAuth codes reading as `AUTHORIZATION_FAILED`; marked, the same codes
  (`server_error`, `login_required`…) are the provider's and read as its
  failure, only where a provider is offered; anything else is a plain
  failure, and `error_description` is never shown. Google's mark is
  `GoogleMark`, from Google's assets. Where `GET /api/me` says
  `hasPassword: false`, the account page offers `SetPassword` (the reset
  link to the account's address) in place of the password form, and says
  two-step verification and closing need it first (`needsPassword`).
- Creating an account accepts the terms of service: the sign-up form says
  so under its button, linking `PEAL_TERMS_URL` and, when set,
  `PEAL_PRIVACY_URL` (`#billing/terms.ts`, read at request time). Keep
  that line.
- `src/proxy.ts` rewrites `/api/*` and `/.well-known/oauth-*` to
  `PEAL_API_URL`, read per request. Keep it there, not in `next.config.ts`:
  Next resolves config rewrites at build time and writes the URL into the
  build. It answers 400 to a page path with an encoded slash or backslash
  (`isRefusedPath`, `peal-contract/path-spelling`), and its matcher has an
  entry for them, as the one for pages leaves out paths with a dot:
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
  `twoFactorPage`. The account page's `TwoStepSection` draws the key's QR
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
  The body's editor (`rich-text-editor.tsx`) is StarterKit with only
  what the server's allow-list takes (headings 2 to 4, no underline,
  links on http, https or mailto) and `ArticleImage`, a library file by
  `mediaId` shown through the media API's address, never one kept in the
  article: add a node or a mark to the server's `article-body.ts` first.
  Slack connects with a sign-in button, as Pinterest does
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
