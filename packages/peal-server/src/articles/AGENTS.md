# Articles

The cluster that runs this context's job, and what of it is persisted
contract, are in the server's guide, [`../../AGENTS.md`](../../AGENTS.md).

- An article (`domain/article.ts`, `Articles`, `publishing.articles`) is
  a sibling of a post, never one: a title, a body, an excerpt, tags,
  categories, a cover, for one website's channel (`SiteChannels`,
  `isSitePlatform`), and how it lands there (`siteStatus`: `publish`,
  `draft`, or `future`, which the site publishes itself at the article's
  time, Peal sending it at once: `sendAt`). Its body is the composer's
  editor document kept to an allow-list (`#shared/domain/rich-text/rich-body.ts`: what
  does not decode is refused, `bodyInvalid` in the contract), and its
  HTML is written by `rich-body-html.ts` alone, every text and
  attribute escaped. It takes the posts' permissions (`post:create`,
  `post:update`, `post:delete`, `post:schedule`, `post:publish` for a
  change on the site, `post:read`) and counts in no month's posts. Articles
  have no approval yet: wherever `ArticleGates.holds` the actor (backed
  by publishing's `ApprovalGate`, `PostingArticleGates`), what
  would put one on its site or change it there (create with a time,
  schedule, retry, edit while scheduled, update on the site) is refused
  (`ArticleRejected` `approvalRequired`); unpublishing is not. A workspace
  over its plan (`ArticleGates.withinPlan`, publishing's `withinPlan`)
  schedules and sends none. Every write
  re-reads the article under its row lock (`ArticleStore.lock`) and
  decides again on what it finds, and `ArticleStore.update` writes only
  over the state, revision and round it was read with, so a member and a
  job never change it at once. `articleViolations` checks it when it is
  scheduled, all at once (`ArticleRejected`), never while a draft, and
  its files are looked up in the library again then. Its title and
  excerpt reach the site escaped: plain text, as a member typed it.
  `media_ids` lists the library's files it shows (`ArticleMedia`, through
  publishing's `AttachableMedia`): a scheduled or publishing article keeps
  one from deletion (`MediaInArticles`, below).
- `PublishArticleV1` (`workflows/publish-article.ts`, persisted contract:
  payload `{ articleId, revision, round, at }`, key
  `<articleId>:<revision>:<round>`, activities `claim`, `send/<n>`,
  `settle`, clocks `send-at`, `retry/<n>`) sleeps until `at`, claims the
  article for its revision and round (`claimed`: missed past an hour),
  decides each attempt with `articleDecide` (`domain/article-policy.ts`,
  the posts' figures for what a site can answer, on articles' own ten
  failure reasons and `articleRefusalCodes`), and settles it, telling
  `ArticleEvents` (the webhooks' `article.published`, `article.failed`)
  in that transaction. Each attempt's row (`publishing.article_calls`) is
  written and committed before the site is called, and marked
  (`committed_at`, `SitePublishRequest.committing`) just before the call
  that makes the post: a row found without it is made again, one with it
  resumed (`SitePublisher.resume`), never sent blindly. A schedule raises
  `revision`, a retry `round`, so a job of an earlier one is superseded.
  It calls the site directly, not through a channel's gate, but in the
  channel's turn (`ArticleSendTurns`, an advisory lock): the attempt and
  the journal's record of the post it made end before another attempt of
  the channel looks for its own. An attempt waits for its turn (one
  taken, or none of the process's two left) by asking again every two to
  five seconds, holding no connection, for 30 minutes, longer than an
  attempt holds one; then it writes nothing and answers a retry a minute
  later, and gives up a day past the article's time. Each attempt, once
  in its turn, first takes up what an earlier attempt of the round left
  unfinished: a call that never reached the site is dropped, and the post
  of one that may have is looked for, never made again. An attempt the
  journal says ended answers what it recorded, outside any turn; one
  whose call may have reached the site is looked for before the plan is
  checked. A call that may have reached the site ends only published or
  unconfirmed (to check): a search that fails, or cannot start, and the
  day's deadline both settle it to check, never failed. Each try of an
  article opens a new round, a failed article scheduled again included,
  and a new round's attempt first looks once more for the post of an
  earlier round's call left to check (`ArticleJournal.toCheckBefore`,
  `SitePublisher.find`), adopting it when found. A turn that cannot be
  asked, the database failing, counts as taken: the attempt keeps
  waiting. `drop` forgets only a call that never left, and `committing`
  fails, so the post's call is not made, when its row is gone. An
  attempt the database keeps from running, past its retries, is made
  again a minute later (`retryingDatabaseOr`), and an attempt, in its
  turn, first answers what an earlier attempt of its round ended with
  when that was published or to check (`ArticleJournal.endedBefore`);
  the round's refusals are read only for an outcome they decide. A
  search for a post looks at the user's posts of its title made or
  changed within a day of the call, page by page; several are to check,
  never sent, and a search the site refuses leaves the article to check
  (`searchRefused`). WordPress
  drops a featured image its library lost and answers `featured_media`
  0: the cover alone is then sent once more, over that post, and one the
  site drops again is not offered any more
  (`article_files.featured_refused`).
- WordPress's adapter (`platforms/wordpress/wordpress-articles.ts`)
  sends each file the article shows to `/wp/v2/media` (the bytes as the
  body, `Content-Disposition` naming the file, streamed), finds tags and
  categories by name whatever their case (WordPress answers names with
  `&`, `<` and `>` encoded, and a name it has answers `term_exists` with
  its id) or makes them, then makes the
  post with one `POST /wp/v2/posts`, the commit. WordPress keeps no
  idempotency key: an answer lost (no answer, or a 5xx) is looked for
  among the user's posts changed since the attempt began a minute early,
  by title, and adopted only when exactly one matches that no other
  article of the channel holds or its call answered
  (`ArticleStore.recordedOn`), else unconfirmed. A request the guard
  refused never left: a name that did not resolve for now is the site
  unavailable, any other refusal a failure. Only a 401 with WordPress's
  own error is a refused
  credential; nothing renews one, so the channel is marked to reconnect.
  Unpublishing is `DELETE` without `force` (the site's trash; gone
  already is done), an update `POST /wp/v2/posts/{id}` without status or
  date, but with an empty excerpt and `featured_media` 0 when Peal has
  none: both run in the request, the article saved after. A file the site
  took for the article (`publishing.article_files`, `ArticleJournal`) is
  never sent again, across attempts and updates. Only an http or https
  `link` is kept as the permalink.
- `SitePublisher` is `routedSitePublisher`: it reads the article and
  the channel's credential once, then calls the `SiteAdapter` of the
  channel's platform with the article as its site gets it
  (`OutgoingArticle`: the content, and `publishAt` for `future` once
  scheduled) and the article's journal as the call needs it
  (`SiteCallJournal`: `committing`, the files sent from
  `ArticleJournal`, and `ArticleStore.recordedOn`; an update gets the
  files and the records alone, `SiteFileJournal`), both in the shared
  kernel. The adapters know no article, store or journal of this
  context, so publishing can call them with its own journal. WordPress's adapter serves `wordpress` and
  `wordpressCom` (`siteRouteUrl`, `withSiteToken`: WordPress.com's
  `/wp/v2/sites/{id}/` with a bearer token). DEV's (`devto/`, Forem's API
  v1) and Hashnode's (`hashnode/`, GraphQL, refusals in `errors` with a 200) take Markdown written by `rich-body-markdown.ts` alone, where
  a member's text stays text: ASCII punctuation escaped, `& < >` as
  entities, `[` escaped (no link or embed). Hashnode reads CommonMark
  (`{ }` as entities too); DEV Forem's dialect (`"forem"`): Redcarpet,
  then a sanitiser that decodes entities, then Liquid over the HTML, so
  each `{` is Liquid's own text `{{ '{' }}`, only what Redcarpet
  un-escapes is escaped (not `$`), a hard break is two spaces, and a word
  joiner follows an `@` Forem would mention (none after a word character, whose `@` is `&#64;`), `:` is escaped (no autolink) and a backtick is `&#96;` (out of Forem's code pass). In both, a mark beside a letter
  is HTML, a paragraph's leading spaces go, and two lists of a kind are
  an HTML comment apart. Titles go as plain text, which both escape. Each
  adapter keeps the journal's rules: files sent once (`article_files`, id
  0 where the site gives none), the commit after `committing`, a lost
  answer looked for, never sent again. DEV's is found by its body (DEV
  rewrites titles, `normalize_title`; a title is compared by its letters
  and digits, and one of the title with another body is `several`),
  among drafts, published articles, or all for one scheduled there; every
  write to DEV in the process goes one at a time, a second apart (DEV
  limits writes by address; an upload holds the turn to its start only),
  a short `Retry-After` waited out holding nothing;
  DEV deletes nothing (unpublishing sets `published` false) and refuses a
  `published_at` past, left out once gone by. Hashnode's is found among
  the latest posts or drafts (a draft's id `draft:<id>`); its reads may
  come from a cache, so `find` waits a minute past the earlier call; a
  commit answered with an undocumented code is looked for; it cannot
  publish at a time (`siteStatusNotTaken`) and refuses all without its
  Pro plan (`articleRefusalCodes.sitePlanRequired`). A search that finds several posts the call may have made ends to check as `severalOnSite`, which tells the member to look and rename or remove the other. What each site takes is
  `#shared/domain/rich-text/site-rules.ts`, checked by `articleViolations` with the
  channel's rules. Tests set the fakes' addresses on
  `testDevToHosts`, `testHashnodeHosts`, `testWordPressComHosts`.
- Erasing a workspace erases its articles (`ArticleRecords`, refused
  while a call to a site is in flight, `ArticlesSending`), the export
  holds them, and a member who leaves is forgotten as their author.

- Articles speak their own language. An article fails for one of ten
  reasons (`ArticleFailureReasonSchema`, `domain/article-failure.ts`:
  `contentRejected`, `channelDisconnected`, `channelDisabled`,
  `mediaRemoved`, `mediaRejected`, `missed`, `rateLimited`,
  `tokenExpired`, `unavailable`, `planLimit`), stored in
  `publishing.articles.state` and the job's history: add members, never
  rename or remove one. `articleDecide` (`domain/article-policy.ts`) is a
  copy of the posts' policy for what a site can answer, on the same
  figures (`articleRetryPolicy`), kept equal by
  `test/articles/domain/article-policy.test.ts` until the owner decides
  articles retry otherwise: then change the copy and drop the equality,
  saying so here. A site's own code is never read as one of Peal's but
  the five of `articleRefusalCodes` (`domain/article-refusals.ts`); any
  other is `contentRejected` (`mediaRejected` for a file) with the code
  as the site gave it. `mediaRemoved` is `mediaUnavailable`, the code
  publishing's `LibraryMediaForPublishing` writes: keep them equal. The
  contract shows the posts' `FailureReason` for an article, of which
  these ten are a subset.
- A stored reason outside the ten that posts know reads as
  `contentRejected`, with its code kept. Articles failed with the posts'
  reasons before they had their own, and the release before still writes
  one when a site answers a code posts read as Peal's own. The list is
  `postReasonsReadAsContentRejected` in `domain/article-failure.ts`, read
  by `ArticleStoredFailureReasonSchema` in an article's state and in a
  stored decision's settlement. `test/articles/domain/article-policy.test.ts`
  keeps it equal to the posts' reasons less the ten, so a reason posts
  gain fails there until someone decides how articles read it. Only the
  ten are written, and any other string still fails to decode.
- `application/unknown-media.ts` is a copy of publishing's `UnknownMedia`
  with the same tag on purpose, as an application layer cannot import
  another context's: the handler maps it by tag to the contract's error,
  so never tell the two classes apart, nor compare them with `Schema.is`.
- What articles ask other contexts, always through their `application`
  layer, never their domain: publishing's `ApprovalGate`, `PostAllowance`
  and `withinPlan` behind `ArticleGates` (`PostingArticleGates`), its
  `AttachableMedia` behind `ArticleMedia` (`LibraryArticleMedia`), and the
  files a site gets through publishing's `MediaForPublishing`, which the
  composition root gives articles from `PostingServicesLive`: the
  server's one limiter of large uploads (`UploadsLive`), shared with
  posts and follow-ups, never one of their own. The credential comes from
  the channels context's `ChannelAccess.withSiteToken`
  (`ChannelAccessSiteCredentials`).
- Articles' tables (`articles`, `article_calls`, `article_files`) stay in
  the Postgres schema `publishing`, where they were made, declared in
  `infrastructure/schema.ts` on the kernel's one schema object
  (`#shared/infrastructure/publishing-schema.ts`): drizzle-kit refuses a
  schema name declared twice.
- A transaction that locks a workspace's posts and its articles locks the
  posts first, then the articles, as erasing a workspace does (posts,
  then `ArticleRecords`); a new code path that locks both follows that
  order, so no two of them deadlock, and the articles' own locks
  (`lockWorkspace`, `lockShowing`) are taken in the order of their ids.
  Deleting a library file does too: media's `HoldersMediaUsage` has
  publishing's `MediaInPosts.hold` lock the drafts that show it, then
  calls `MediaInArticles.hold`, which locks the articles that show it in
  media's transaction, until it ends; only once neither keeps the file do
  the articles that may still be sent let it go (`letGo`). `hold` opens
  no transaction: never call it outside one
  (`test/media/infrastructure/holders-media-usage.test.ts` proves the
  order, and that a file deleted while its workspace is erased waits
  instead of deadlocking).
- Persisted contract: the workflow `PublishArticleV1` (its tag in
  `persistedArticleWorkflowTags`), the JSON of `articles.state` and
  `article_calls.outcome`, the advisory lock namespace
  `peal-server/publishing/article-sends`, the webhook events and their
  keys, and the refusal codes. The fixtures in
  `test/articles/infrastructure/fixtures/persisted` were written by the
  release that made them: they must decode and encode back to the same
  JSON (`test/articles/infrastructure/persisted-contract.test.ts`); never
  write them again to make a test pass. Service keys and class
  identifiers keep the `publishing` they were made with: they are
  in-process identities, and changing one changes nothing a member sees.
