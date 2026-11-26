# Recycling

Recycling is a module of the publishing context: a `recycling/` folder in
each of its layers (`src/publishing/<layer>/recycling/`, the paths below
are from `src/publishing/`). The server guide's paragraph on modules
([`../../../../AGENTS.md`](../../../../AGENTS.md)) says how lint keeps it
apart; the rest of publishing's rules are in
[`../../AGENTS.md`](../../AGENTS.md). No file of the rest of publishing
reaches into it but the container. A post's `recyclingId`
(`domain/recycling-rule-id.ts`), who started a rule and who they are now
(`application/started-by.ts`, `application/recycling-actors.ts`, which
feeds and follow-ups use as much) and `PostScheduling.sendOccurrence` are
the posts' own, not this module's.

- A recycling rule (`domain/recycling/recycling-rule.ts`, `Recycling`,
  `publishing.recycling_rules`) makes a source post (scheduled, publishing
  or finished, unpublished since or not) repeat. Its due instants count
  from the source's time (`anchorAt`) in its zone (`domain/recycling/recycling-interval.ts`:
  `dueAt`, a month shorter than the day on its last day), never from the
  step before; a missed one is skipped (`plannedAt`). The next post is
  made once the latest one's time (`lastDueAt`) passed: one ahead. Each
  occurrence is a new post (`posts.recycling_id` and `occurrence`, unique
  together), copied with `copyOf` (`application/post-copies.ts`, which `duplicate`
  shares) without the source's websites (`recycled`: a copy on a blog is
  a duplicate article; a source on websites alone is `PostNotRecyclable`
  `websitesOnly`) and sent by `PostScheduling.sendOccurrence`: no preset, signature
  or default option filled in, `remember` instead of the duplicate refusal,
  a queue's slot at or after the due instant (from a millisecond before),
  the rule's lock (`claimed`) first in the transaction and the rule written
  after the insert (`made`), so a send that rolls back leaves the rule as
  it was. It acts as the starter now (`RecyclingActors`, backed by the
  workspace context's `ActorsNow`): gone, or no longer able to ask, ends
  the rule `starterGone`; `lockedOut` waits. Any other refusal ends it with
  its reason and `RecyclingNotices` (`RecyclingEnded`, keyed by the rule
  and its `resumptions`), in one transaction under the rule's lock.
  `makeDue` (cron `publishing.recycling`, every ten minutes from 4,
  `infrastructure/recycling/recycling-cron.ts`) pages
  by `(last_due_at, id)`, makes one occurrence a rule a run, skips a rule
  another run holds (`FOR UPDATE SKIP LOCKED`), and the cron sets
  `peal.publishing.recycling.overdue` (active rules whose latest time, a
  queue's slot included, passed over 30 minutes ago, less those the run
  left to wait: a starter locked out, a source awaiting approval), which
  an alert watches. Lock order: the rule's row, then the queue, the
  post's row, the gate, the month and the duplicate guard's advisory lock;
  nothing locks a rule after those. Deleting a queue leaves its rules
  alone: the next run ends them `queueGone`. Erasure deletes rules before
  posts; `forgetAuthor` clears `started_by`, and the next run ends the
  rule.
