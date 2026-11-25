# End-to-end tests

- Run them with the development stack up and a database of their own:
  `DATABASE_URL=postgres://peal:peal@127.0.0.1:15432/peal_e2e bun nx run peal-e2e:e2e`.
  The target builds the web app first and is never cached. Like the
  server's tests, a run writes to the database `DATABASE_URL` names; Mailpit,
  SMTP and SeaweedFS (under `e2e/`) default to the stack, and `MAILPIT_URL`,
  `SMTP_URL` and `PEAL_S3_*` override them.
- `scripts/serve.ts` starts the server and `next start` on free ports, with
  the synthetic secrets in `e2e.config.ts`, and stops both when either exits.
  It passes `next start` no `--hostname`: bound to 127.0.0.1, every page
  redirects to itself.
- Install Chromium with `e2e-web install chromium`, from
  `packages/peal-e2e/node_modules/.bin`; CI adds `--with-deps` for the
  system libraries it needs.
- Write steps with exact locators (`screen`, `expect`) only, so tests need no
  model and run in CI. Find elements by role and label, and scope to `main`,
  `banner` or a named `navigation` when a name repeats.
- Sign up a new synthetic user each run (`member+<uuid>@example.test`, from
  `credentials.member`), and read its emails through Mailpit's API
  (`tests/support/mailpit.ts`). Accounts a test acts on rather than as sign
  up through the API with `confirmedAccount`, and `makeStaff`
  (`tests/support/accounts.ts`) gives one the staff role in the database, as
  self-hosters do; it signs in again afterwards.
- The run's server bills, against a stand-in for Stripe that lists Peal's
  meters and prices, the rate card's and the legacy plans', from the
  contract, by lookup key when asked (`scripts/stripe.ts`), as the server
  checks them when it starts: a new workspace is on the free tier, two
  channels across the account's workspaces, so a journey stays within
  them, or puts its workspace on per-account pricing in the database
  (`seedPerAccountSubscription`, `tests/support/billing.ts`, as
  `composer-comforts.e2e.ts` does for its three). The stand-in makes each
  customer an id of its own and opens a checkout whose page is the way
  back it was given, as if the card were taken: `upgrade-prompt.e2e.ts`
  reads the billing page on the free tier, is refused a third account,
  checks the dialog fits a phone (320 and 375 px, English and French),
  orders from it, comes back, posts the webhook event Stripe would send,
  built from the checkout the server opened (the stand-in writes each to
  `checkoutsFile`, `.e2e/stripe-checkouts.jsonl`: its prices and
  metadata; `postPerAccountSubscription` refuses one that lost a line or
  its order, and signs with the stand-in's `webhookSecret`, the customer
  read from `auth.organization`), then reads per-account pricing on the billing
  page, and the third account goes past the plan to the Mastodon server
  it names, which does not exist. The run has no billing grace. No test
  pays.
  So the functions to cancel and withdraw are on
  (`contract-functions.e2e.ts`): a journey there sends requests no
  contract answers, and reads their acknowledgement in Mailpit.
- The run measures, against a stand-in for PostHog (`scripts/posthog.ts`),
  whose project configuration is the one PostHog's cloud served Peal's
  project (events to `/i/v0/e/`, replay after 10 s), and the journey's
  browser refuses `/i/v0/e/`, as tracker blockers do:
  the server and the web app get `PEAL_POSTHOG_WEB=on` and its address,
  and it writes every request it receives, decoded, to
  `.e2e/posthog-requests.jsonl`. Each member's home shows the consent
  card. `tests/usage-measurement.e2e.ts` reads the file: anonymous page
  views with nothing stored, then, once allowed, identified events, a
  recording and a server event joined to the browser's session, and
  anonymous again once withdrawn, in place; no id passes from one
  consent to the next, and the relay forwards no header of the
  browser's but the request's type (`relayedHeaders`, the rest the
  relay's own fetch adds). The SDK drops a test browser's events
  as a bot's, so the journey makes the page read as a person's
  (`asPerson`); it writes the storage keys the SDK kept to
  `.e2e/posthog-storage.json`, which the privacy policy names. It
  checks pages opened without a reload in both modes, Allow and
  withdrawal in place, the app's own requests naming the session (a tag
  added in the settings, its header read with `browser.route`) and no
  longer once withdrawn and the recording going on across pages. It ends by
  disconnecting a seeded channel on the channels page and reading the
  server's `channel_disconnected` at the stand-in, as the member's. Every
  journey runs in Chromium alone: WebKit's runs in CI failed more often
  than they found anything, and are gone.
- The run serves the marketing site too (`scripts/site.ts`): the build
  `nx run peal-site:build-e2e` writes to `packages/peal-site/dist-e2e`,
  measured with the stand-in's token, `SITE_POSTHOG_HOST=/pulse/site` and
  `SITE_POSTHOG_ENVIRONMENT=e2e`, served on a free port as nginx serves
  it, its `/pulse/` forwarded to the run's web app with the visitor's
  address in `cf-connecting-ip` (`203.0.113.7`), as the tunnel does; the
  web app and the server get `PEAL_POSTHOG_SITE=on`, the web app
  `AUTH_IP_HEADERS=cf-connecting-ip`. Its address is in `.e2e/site-url`.
  Site and app share the host name 127.0.0.1, so they share cookies, as
  peal.social's parent domain makes them. `tests/site-measurement.e2e.ts`
  reads the consent notice and what the stand-in received: cookieless
  page views before an answer and after **Don't allow**, the campaign
  labels alone of a query, **Cookie settings** and its focus, one
  visitor across pages once allowed (it writes the cookies and storage
  keys the SDK kept to `.e2e/posthog-site-storage.json`, which the privacy
  policy names), the server's `$create_alias` at a sign-up in the same
  browser and the cookie gone after it, nothing for a browser that sends
  Global Privacy Control, a still notice with reduced motion, and the
  notice at 320 and 375 px and at 1280 px in both languages (screenshots
  `.e2e/site-notice-*.png`); and the site's scripts against their gzip
  budgets (`.e2e/site-budgets.json`). The web app's journey leaves the
  site's events (`source: "site"`) aside, and checks it never carries the
  site's visitor.
- No platform can be connected in a run, so a test that needs a channel
  inserts a synthetic one with `seedChannel` (`tests/support/channels.ts`).
  Update it when `channels.channels` changes. Publish nothing, and cancel any
  post a test schedules, through the UI.
- Nothing goes live in a run either, so a test that needs a post's counts
  or its comments seeds them as analytics and the inbox keep them
  (`seedCountedPost`, `seedComment`, `tests/support/followed.ts`), written
  as no longer read (`ended_at`): the run's server runs its collections,
  which would otherwise call a platform for them. Update them when
  `analytics.tracked_posts` or `engagement.threads` change. Mark a comment
  answered rather than reply: a reply's job would call the platform.
- A part of a page that loads after it moves what is below it, and an
  open list follows its field off the screen ("element is outside of the
  viewport"): wait for that part (the post's review shows "Your comment")
  before opening a list beneath it.
- `tests/agent-skills.e2e.ts` turns the agent's composer on with a text
  provider of the workspace's own (a synthetic key; nothing is sent, so
  no model is asked), sees "/" offer **Create skill…** and Escape close
  it, saves a skill on `…/settings/agent`, then picks it under "/" with
  Enter, which sends nothing. ui-sdk's trigger menu reads the field's
  keys in the capture phase: type with `browser.keyboard`, not `fill`.
- `tests/tags.e2e.ts` signs up a member of its own, adds a tag in the
  settings, schedules a tagged post and another, filters the calendar by
  the tag (the Filter menu's Tag, its chip, `?tag=` in the address) and
  clears it with **Clear**, then cancels both. The calendar names a
  tagged post "<time>, <status>: <text> Tag: <name>.", so a locator for one
  ends with its tags. A menu or popover that stays open after a choice is
  closed with `press("Escape")` before the page behind it is read.
- A toast's text is also in the page's live region, which keeps it after
  the toast has gone: find a toast inside the `region` "Notifications",
  as the journeys find "Post cancelled.".
- `tests/composer-comforts.e2e.ts` seeds three channels, selects them all
  and none, ticks one by pointer and by Space and scrolls the wheel, the
  document staying the window's height and unscrolled throughout (the
  composer's panel scrolls, never the frame), inserts an emoji from the
  picker, reads the previews, opens
  **Publish now** and leaves it ("Not now": nothing goes out), finds the
  saved draft among **Posts**, filters it out by status (the Filter
  menu's Cancelled, which no tab shows) and back with **Clear**, then
  discards it, and reads a pending invitation's **Copy link**. Pasting
  files is tested below the pages (`#posts/paste.ts`): the runner offers
  no clipboard.
- `tests/csv-import.e2e.ts` opens **Import from a file** from the
  header of **Posts**, sets the file input (`setInputFiles`) to files it
  writes under `.e2e/csv-import/`: a row on a channel the workspace lacks is refused
  and nothing is offered to import; a row next year on a seeded channel
  (`seedChannel` answers its id) is checked, imported and its post
  cancelled. It never imports a row dated `now`.
- `tests/queues.e2e.ts` adds a queue with two slots late today (the
  test's weekday), adds two posts to it from the composer's **Add to
  queue**, reads that they took 23:57 then 23:58, swaps the 23:57 slot
  for 23:59 and moves both posts onto the new slots, then cancels both.
- `tests/media-library.e2e.ts` seeds named images and a video
  (`seedImage`, `seedVideo`: rows only, no file), finds one by its name
  whatever its case, narrows the search by kind (the Filter menu's Kind, `?q=…&kind=image`
  in the address) and clears it (the focus
  goes back to the search field), then opens a tall image's preview at
  320 × 640 (`browser.setViewport`) and checks the dialog, its title and
  its close button fit the window, and that closing it gives the focus
  back to the thumbnail. A seeded description has no surrounding spaces,
  which the server refuses to read.
- `tests/page-loads.e2e.ts` loads a new workspace's main pages from the
  server, one after the other in one test, and finds no error in the
  console: an init script, registered once, keeps what the page writes
  with `console.error` and the errors nothing caught, where React's
  hydration error (#418) arrives. The runner gives a test no console of
  the page, so read it this way. Each page is read once it has settled:
  React has taken over its `main` and nothing in it is `aria-busy`, which
  a page that reads its data in the browser reaches only after hydration
  (never `networkidle`, which a page that keeps a connection open never
  reaches). It keeps each page's errors, a page that never settles among
  them, and asserts once at the end, so one run names every page that
  failed. A page added to the app's main ones joins its list. It then
  seeds three channels, one past the free tier's two with no payment method,
  and loads some of the pages again (`overPlanPages`): each must settle
  on the over-plan screen, which its owner reads with the channels and
  members the browser loads, with no error either.
- A new workspace opens on its setup step (`/create/<slug>/channels`):
  `openedWorkspace` waits for it and leaves with **Skip for now**
  (`[data-setup-skip]`), so every journey starts on the workspace's home.
  `tests/setup-card.e2e.ts` reads the step itself: nothing ticked, the
  free accounts said once Mastodon is ticked, a run that stops at a
  Mastodon server which does not exist and comes back to the step with
  its reason, **Start over**, then **Skip for now** to a home with no
  setup card. The chain from one platform's callback to the next sign-in
  needs a platform to answer, which no run reaches: `test/home/` and
  `test/setup/` in the web app cover the run's steps.
- `tests/two-step.e2e.ts` turns two-step verification on from the account
  page, reading the key written beside the QR code and computing the codes
  an authenticator app would (`tests/support/totp.ts`, RFC 6238), signs in
  again with the password then a code, and requires it of its workspace.
- `tests/sessions.e2e.ts` reads the account's sessions, moves their
  sign-in time two days back in the database (`ageSessions`) and clears
  the browser's cookie cache of the session (`peal.session_data`), then
  signs in again from the page and is brought back to the list. Another
  account then signs out from the account menu and back in: a mark set
  on the page (`window.pealSamePage`) is gone at the sign-in page and
  again on the workspace, as each loads anew.
- CI's `e2e` jobs run beside the others when a change can reach the pages
  (`scripts/ci-plan.ts`), each with its own Postgres and Mailpit and
  SeaweedFS from `compose.yaml`: Chromium's suite in three shards
  (`e2e run --shard`, contiguous slices in file order that keep a serial
  journey's tests together). A new file
  joins a shard by its name, so a long journey can unbalance them: check
  the shards' durations when one is added. After a failure, read the report,
  traces and screenshots under `packages/peal-e2e/.e2e/` (CI uploads each
  job's, as `e2e-results-<part>`, for 7 days), and the server's and the web
  app's output in `.e2e/logs/app.log`.
