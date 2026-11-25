# Follow-ups

Follow-ups are a module of the publishing context: a `follow-ups/` folder
in each of its layers (`src/publishing/<layer>/follow-ups/`, the paths
below are from `src/publishing/`). The server guide's paragraph on modules
([`../../../../AGENTS.md`](../../../../AGENTS.md)) says how lint keeps it
apart; the rest of publishing's rules are in
[`../../AGENTS.md`](../../AGENTS.md). No file of the rest of publishing
reaches into it but the container. Reposting a failed target
(`application/post-follow-up.ts`) and a post's `followUps` parts are the
posts' own, not this module's. The channels context's gate sends a
follow-up through `application/follow-ups/follow-up-publisher.ts`.

- A follow-up rule (`domain/follow-ups/follow-up-rule.ts`, `FollowUpRules`,
  `publishing.follow_up_rules`) acts on one post, or on every post a
  channel publishes after it started, once it has `likes` likes: its
  `comment` under the post, a repost, or both, once each a target
  (`follow_ups` unique on target and kind but for those `cancelled`,
  whatever rules act on it: a rule stopped leaves the kind to the next,
  and a post rule another rule already follows up in full is refused
  `alreadyFollowedUp`),
  within `followUpWindow` (7 days) of the post going live there,
  `maxFollowUpsPerChannelDay` (10) a channel and UTC day. What each
  platform carries is `followUpSupport` (`domain/follow-ups/follow-up-support.ts`,
  from each platform's pages: LinkedIn's terms forbid both), and a
  channel's own abilities `followUpsOn` (the operator's X threads, the
  Bluesky repost scope from `ChannelGrants`, which sign-in never asks:
  a repost rule on a channel without it says `reconnect`, and the
  reconnect with `reposts=true` asks it, as chat's; analytics' coverage):
  `FollowUpNotPossible` refuses a rule no channel can carry, or whose
  comment is too long for one that could.
  `GET …/automations/follow-ups/platforms` (`FollowUpRules.platforms`,
  `FollowUpChannels.platforms`, `followUpsOnPlatforms` in
  `domain/follow-ups/platform-follow-ups.ts`) answers it for every
  platform, kind by kind, with the server's own reasons (`turnedOff`,
  `notCounted`) and never a channel's (`reconnect`, `textTooLong`), its
  words narrowed to those a platform can be answered (a test keeps the
  contract's equal): the web app offers **Follow up** from it.
  `FollowUps.arm` arms a target
  in the transaction that settles it (`armedOutcomes`, around
  `PublicationOutcomes.settled`), and `armPublished` a post already out
  when its rule starts or a change gives it a kind. The `publishing.follow-ups` cron (every ten
  minutes from 9, `infrastructure/follow-ups/follow-ups-cron.ts`) reads the likes analytics last counted
  (`FollowUpCounts`, analytics' `PostLikes`: never a platform call, so a
  rule never makes a read happen, X's paid ones included; a resumed X
  comment does list the account's recent posts, `client.resume`, Peal's
  own unmetered cost as for posts), expires what
  its window passed with why, and triggers the rest one transaction each
  under the follow-up's lock (`FOR UPDATE SKIP LOCKED`), as the starter
  is now (`RecyclingActors`: gone ends the rule `starterGone`), only when
  the rule is approved or the starter's posts need no approval
  (`mayAct`, `ApprovalGate.holds`: a rule the policy comes to hold waits
  for `approve`, which approves any rule not approved, and expires
  `notApproved`; a change by a member in person who approves posts and
  is not held approves it), on a post still live, the channel still
  able, the channel's day counted under its lock (`claimChannelDay`).
  A channel's rule whose channel was disconnected ends `channelGone`, and a kind a channel carries only once connected again (`reconnect`: a Bluesky repost before the account granted reposts) is kept `waiting`; the run arms it once the channel carries it (`armMissing`, `grantFollowUp`), or expires it `notGranted` with its window, and a post's rule does not complete while one waits. Only that case: a kind added to a channel's rule arms the channel's posts from then on, and a cancelled follow-up is never armed again but by a new rule's arming. A rule on a post with nothing left to publish completes even if it armed nothing (`settledPostRules`). A follow-up a platform put off waits until `notBefore`: what the platform asked (`retryAfter`), and at least `followUpPutOffFirst` (10 minutes) doubled each attempt, `followUpPutOffMost` (6 hours) at most of its own, longer when the platform asks; one put off until its window ends expires `windowEnded`. Members are told through `FollowUpNotices` (`NotifiedFollowUpNotices`): a rule ending `starterGone` or `channelGone` (`FollowUpRuleStopped`, key `follow-up-rule:<id>:stopped`) in the transaction that ends it; a follow-up that ends `failed`, `unconfirmed` or expired `windowEnded`, `notGranted` or `notApproved` (`notSentReasonOf`) is marked `notice_due` as it is written, and the start of each run tells each rule's together (`FollowUpsNotSent`, a count and the reasons, key `follow-ups-not-sent:<rule>:<UTC day>`) under the rule's lock, unless the rule's `not_sent_told_at` is today: those wait for the next day, but the `unconfirmed`, which ask for a check, are told at once (`atOnce`, key `follow-ups-unconfirmed:<rule>:<first id>`). A rule whose notice fails is logged and told at a later run; the run goes on. A `starterGone` end goes to every member who may act, the starter following it (`everyoneWhoMayAct`). A follow-up `SendFollowUp` holds back as its rule may no longer act is armed again `heldBack` (no platform put it off): its window ending says what held it (`expiryOf`), never `windowEnded`.
  Staff acting as a member start and change none. `SendFollowUpV1`
  (payload `followUpId` and `attempt`, keyed by both, so a follow-up
  armed again runs as a new execution; activity `send`, persisted
  contract) checks `mayAct` again just before the call, putting it off
  as a passing refusal when it no longer holds, then sends it as
  engagement sends a reply: the row is the
  journal (`attemptedAt` committed before the call), a resume never sends
  blindly, and the gate (`SendFollowUp`, `ResumeFollowUp`, ids only)
  claims the call first (`claimCall`). `RoutedFollowUpPublisher` hands a
  comment to the platform's `PlatformClient` as the post's next part
  (`replyTo` the last live part and the first, the follow-up's id as the
  idempotency key, with `:<attempt>` after the first, X's claimed on
  `PostMeter`), a repost to
  `PlatformReposts` (`infrastructure/follow-ups/platforms/platform-reposts-live.ts`: Bluesky's
  `app.bsky.feed.repost` record under a key from the attempt, read back
  on a resume; Mastodon's reblog, which Mastodon answers once). A refusal
  that passes (the platform unreachable, a rate limit) arms it again; any
  other fails it with the platform's code. A follow-up still `sending`
  an hour on is handed over by the cron (`settleStranded`). The account
  export holds the rules with their follow-ups, never who started or
  approved one; erasing a member clears `started_by` and the approval's
  `approvedBy`. Erasure deletes the rules with what they armed; a call already under way when
  its workspace is erased may still go out (a gate claims no call for a
  row gone, so the window is the call itself).
