# Notifications

- Emails go through the `Mailer` port: Resend when `RESEND_API_KEY` is set,
  otherwise SMTP at `SMTP_URL`, from `MAIL_FROM`. Requests never wait for
  them.
- Emails are written in `peal-emails`
  ([its guide](../../../peal-emails/AGENTS.md)): their words in English and
  French, their templates and their text. Use cases reach it through the
  `EmailRenderer` port, whose adapter (`ReactEmailRenderer`) takes an email
  it cannot write as a defect. Keep its import of the package static, so a
  package that does not load stops the server as it starts, where a
  release's health check sees it: failing later, it would lose account
  emails, and `DeliverNoticeV1` keeps a defect as its result, so its
  notices' emails would stay lost once fixed. It reads the letterhead every
  email carries as the server starts: where the server serves their
  pictures, `/api/email-assets` at `PUBLIC_URL` (`src/app/email-assets/`),
  and who sends, `PEAL_MAIL_IDENTITY` (one line, optional). Account emails
  go through `SendAuthEmail`. A test that moves `TestClock` while an email is being
  written provides a renderer that answers at once
  (`send-auth-email.test.ts`), as rendering waits on promises.
- A new notice, or a new reason of one, needs its member in
  `NoticeEventSchema`, then its type, its words in both catalogues, its
  sample and its preview in `peal-emails`: `ReactEmailRenderer` does not
  compile before.
- Notices are events, not sentences: the context stores what happened as
  typed data (`NoticeEventSchema`: a post published, failed with its reason,
  or unconfirmed; a channel to reconnect now or soon), the web app writes it
  from its catalogues, and emails are rendered when they go out. Add members
  and fields to an event; never rename or remove one, since notices are
  stored with it.
- `PostFailed.notSent` (`firstComment`, `laterParts`) says the post itself
  is live and only what followed it did not go out: its notice and email
  say so (`firstCommentFailed`, `laterPartsFailed`), never that the post
  did not go out. Publishing sets it from the target's live parts.
- Other contexts tell people through `Notify`, with a key that names the
  event, such as `post-target:<id>:<round>`: a key seen before
  (`notifications.sent_notices`) notifies nobody. Keys hold ids and instants,
  never content. Notify runs in a TransactionRunner transaction that joins
  the caller's, so the key, the notices and the start of `DeliverNoticeV1`,
  which emails them after the commit, go together. Publishing calls it
  through `PublicationOutcomes`, the channels context through
  `ChannelNotices`.
- Who hears about an event is `recipientsOf`: for a channel, the members who
  can act on it (`audienceOf`: `channel:connect`); for a post, its author
  (`NoticeRequest.author`), whatever their role, and the members with
  `post:schedule` who chose `everyPost`, off by default; for a post without
  an author, or whose author left the workspace, every member with
  `post:schedule`; for billing, every member with `billing:manage`. A
  request with `everyoneWhoMayAct` tells every member who may act beside
  its followers: a rule whose starter can no longer act
  (`FollowUpRuleStopped`, `CommentRuleStopped` for `starterGone`) goes to
  those who can start it again, the starter following it. Every
  notice reaches the app; `NotificationPreferences` say which are also
  emailed (failed and unconfirmed posts, channels to reconnect and
  deliveries failing on a webhook endpoint, `webhookFailing`, and a
  recycling rule that ended, `recyclingEnded`, a feed that stopped,
  `feedStopped`, and a rule acting by itself that did not, `automations`:
  `FollowUpsNotSent`, `FollowUpRuleStopped` and `CommentRuleStopped`
  (`engagement:read` for the last), by default,
  not published posts; billing's and a webhook endpoint turned off always,
  as no preference covers them). A preferences change writes only what it names.
  A video the assistant was asked for (`VideoGenerationEnded`) reaches the
  member who asked (`author`) alone, while they may upload media, in the
  app only (`inAppOnly`: never emailed, whatever the preferences).
  A post failed `tokenExpired` (`awaitsReconnect`) is not emailed to a
  reader who may connect channels and keeps the `channelReconnect` email
  (`emailedTo`): the channel's `ChannelReconnectRequired`, once per break,
  tells them, and a broken channel would otherwise send an email for every
  post it held. The notice still reaches the app.
- `Notify.resolve(key)` says an event was dealt with: its notices are marked
  read for everyone and its pending emails skipped. Publishing resolves a
  round once a member confirms or reposts it.
- `DeliverNoticeV1` is persisted contract: its tag, its payload (`key`), its
  activities `send/<n>` and `abandon`, its clocks `retry/<n>`. It retries a
  transport that refuses for now over about five hours, and skips readers who
  left the workspace (or, for a channel, may no longer connect channels:
  `readerPermissionOf`) or turned the email off meanwhile.
- The inbox belongs to a user, and `authorizeInbox` decides who acts on it:
  the user, or an OAuth client not bound to a workspace, with
  `workspace:read` to read and `workspace:write` to change; staff
  impersonating the user only read.
- The weekly digest (`SendWeeklyDigests`, `notifications.weekly-digest`,
  every hour of Monday from 06:19 to 23:19 UTC) is an email, never a notice:
  notices hold no content, and the digest names posts by the start of
  their text. It goes to those who turned `email.weeklyDigest` on (off by
  default) and still lack the week's, paged by user id on the partial
  index `notification_preferences_weekly_digest`, so a server where
  nobody did reads one page of nobody. `DigestSources`
  (`ContextDigestSources`) reads each one's workspaces through the
  workspace context's `ActorsNow` (as a request of theirs would be
  decided now), publishing's `PostAttention.week` where they hold
  post:read, analytics' totals where they hold analytics:read: the
  workspace's own posts, counted and the first five of each week
  (`digestListed`), never a comment or its author. Weeks and days are
  UTC (`digestWeekOf`), as readers' zones are not known. Its links are
  the web app's workspace pages, named by the workspace's id as the
  server's other links are (the web app sends them on to the slug): each
  workspace's calendar, and, for its button and its footer's preferences,
  the calendar and `settings/notifications` of the first workspace with
  news.
- A reader is taken before being read (`claimDigest`: a lease in
  `weekly_digest_lease`, stale after `DigestPaceRef.lease`, refused once
  they no longer want it), and the week is marked
  (`weekly_digest_week`, never a notice key, as `sent_notices` keeps keys
  forever and the preferences row goes with the account) only once the
  email was accepted, or refused for good. One refused for now, after a
  few seconds of retries and a timeout per send, is given back
  (`releaseDigest`) for the next hour's run, and this one goes on; three
  in a row stop it, as the transport is down. Each reader is isolated:
  any failure or defect is logged, counted in
  `peal.notifications.weekly_digest.failures` by `reason` and skipped; a
  page read is retried. `peal-weekly-digest-deferred` alerts on two
  deferrals in three hours, `peal-weekly-digest-failing` on ten other
  failures in two (both run in promtool).
- Delivery is at least once in one window: a server that dies after the
  transport accepted an email and before `digestSent` leaves the lease,
  and a later run sends the digest again. Resend drops the second by its
  idempotency key (`weekly-digest:<user>:<week>`, kept a day); SMTP
  delivers both.
- Each digest carries `List-Unsubscribe` and `List-Unsubscribe-Post`
  (RFC 8058) to `/api/notifications/weekly-digest/unsubscribe/<token>`
  (`src/app/weekly-digest/`, outside the contract): a POST turns that
  digest off and nothing else, a GET only redirects to the web app's `/`
  (which opens the reader's workspace), as the token names none.
  Tokens (`DigestLinks`, `HmacDigestLinks`) are the HMAC of the user and
  `weekly_digest_links` with a key derived from BETTER_AUTH_SECRET (a
  fixed label), have no lifetime, and are revoked when the digest goes
  from off to on, which moves the generation (said on while on, it does
  not). The path is never traced (`src/app/untraced-paths.ts`), as
  `url.full` would keep the token, and the request log writes it with
  `<redacted>` in the token's place (`SecretPathsLive`).
- A name someone typed (a member's, a workspace's) goes into an email only
  through `peal-emails`' `nameForMail`: one that reads as a host or an
  address is replaced by the catalog's `withheldNames` ("A member", "a
  workspace"), so no email of Peal's carries a link someone typed (the
  invitation, the deletion of a workspace, notices' `{workspaceName}`, the
  weekly digest). The server hands names over as they were typed, and a new
  email that shows such a name does the same.
