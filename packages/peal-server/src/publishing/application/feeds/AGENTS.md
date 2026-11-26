# Feeds

Feeds are a module of the publishing context: a `feeds/` folder in each of
its layers (`src/publishing/<layer>/feeds/`, the paths below are from
`src/publishing/`). The server guide's paragraph on modules
([`../../../../AGENTS.md`](../../../../AGENTS.md)) says how lint keeps it
apart; the rest of publishing's rules are in
[`../../AGENTS.md`](../../AGENTS.md). Two files of the rest of publishing
reach into it, as `test/lint-modules.ts` names them: `application/channel-sets.ts`
(deleting a channel set clears the feeds that name it, in its transaction,
through `FeedStore`) and `infrastructure/crons.ts` (the idempotency
retention's run calls `Feeds.prune`).

- A feed never posts to a website: its items have no title to give an
  article, so saving a feed with a website's channel is refused
  (`UnknownChannels`, `checkedTargets`), and the websites of the channel
  set it names are left out of its posts (`PresetAsk.withoutSites`).
- A feed (`domain/feeds/feed.ts`, `Feeds`, `publishing.feeds`) is a web feed a
  workspace follows: RSS 2.0, Atom 1.0 or JSON Feed 1.1, told from the
  body (never the content type), read through `FeedSource`
  (`infrastructure/feeds/http-feed-source.ts`: `publicHttpClientWith`, a
  byte past `maxFeedBytes` read so a longer answer is `tooLarge`, three
  redirects followed here, each through the guard, 20 seconds for the
  whole read, no credentials, its spans off and logs by host only, the
  validators of the last read sent back, a 304 `notModified`). XML is
  parsed by sax in strict mode (`infrastructure/feeds/xml-tree.ts`): it never expands an
  entity a DOCTYPE declares nor fetches an external one, an unknown entity
  fails the parse, and depth and element bounds stop a hostile document;
  each format's mapping is a pure function tested on fixtures. What an
  item says is made storable (`storableLine`, `textOfHtml` then
  `storableText`), its addresses absolute and HTTP(S) only, and its
  identity kept as its SHA-256 (`feed_items`, unique per feed), never the
  text: no log, trace, notice, webhook or cluster table holds what a feed
  says. Adding a feed, moving it or resuming it reads it at once and
  records what it holds as `skipped` `existing`, and `since` keeps an
  item dated before from being made. Each read of an address a member
  gives takes one of `feedReadsPerHour` (`FeedReads`, `feed_reads`).
- `Feeds.poll` (cron `publishing.feeds`, every ten minutes from 6,
  `infrastructure/feeds/feeds-cron.ts`) pages
  the due feeds by `(next_check_at, id)`, four at once, starts no read
  past `runBudget` (eight minutes) and says what it left; it takes each
  feed with a lease (`leaseFeed`: `next_check_at` moved `readLease` on
  under `FOR UPDATE SKIP LOCKED`), so no transaction is held over a read.
  The starter is resolved as a recycling rule's is (`RecyclingActors`,
  `mayChangeStarted` in `application/started-by.ts`): gone stops the feed
  `starterGone`, locked out keeps the last validators so the items come
  back. New items (`newItems`: unseen, oldest first, `maxItemsPerRun` a
  run, `maxItemsPerDay` a UTC day, the rest `tooMany`) become, in draft
  mode, a draft (`PostDrafts.create`, in one transaction with the item's
  record; a channel gone makes a draft for none), in queue mode a post
  sent by `PostScheduling.send` after its item is recorded `claimed` in a
  statement of its own, keyed `feed:<feed id>:<digest>` (key and
  fingerprint), so a run that finds a claim younger than `claimLifetime`
  (23 hours) sends it again and is answered the first post; an older claim
  is `abandoned`. What `send` refuses becomes a draft (`heldBack` with the
  reason); a queue gone does too, and stops the feed `queueGone`. A failed
  read postpones the feed (the host's `Retry-After`, else as long as it
  has failed, an hour to a day); a 410 stops it `gone`, seven days of
  failing `unreachable` or `notAFeed`. Stopping tells `FeedStopped`
  (`FeedNotices`, keyed by the feed and when it stopped) in the
  transaction that stops it; the cron sets `peal.publishing.feeds.overdue`,
  which an alert watches. A feed keeps its 500 newest items: the
  idempotency retention's run prunes the rest and read counts a day old.
  Erasure deletes feeds before posts; `forgetAuthor` clears `started_by`.
- Feeds and the guard: a name that resolves to a public address when the
  guard checks it and to another when fetch connects is not caught (the
  guard says so). Pinning the connection to the checked address while
  keeping the Host and SNI is not done: Bun's fetch and Node's (where the
  tests run) take no common option for it, and Peal reaches every host
  through the one fetch client. HTTPS on port 443 with certificate
  validation narrows it to a host holding a valid certificate for the
  outside name.
- With `attachPicture`, an item's picture is imported through
  `FeedPictures` (`LibraryFeedPictures`, the media context's
  `MediaLibrary.importMedia`, as the starter, who needs media:upload)
  before the item's transaction, and attached, described by the item's
  title, only when it is a ready image; anything else leaves the post
  without it and writes `feed_items.picture_skipped`. The import takes
  `kinds: ["image"]`, so a video or a document is refused from its first
  bytes and never stored. A crash after the import leaves an asset
  unattached in the library: accepted. A claim sent again imports again.
