# Roll back a release

To roll back, release the previous commit (`release.yml`, as the
[README](../README.md#releases) says). Migrations do not run backwards: the
previous release runs against the database this one migrated. Some
releases store what the one before ignores or cannot read; before rolling
back past one of them, run its checks below, and roll back only once they
find nothing.

Run every command on the server, as `ops`, through the tunnel
(`ssh ops@ssh.peal.social`, or `ssh ops@sandbox-ssh.peal.social` for the
sandbox). The checks only read.

A roll-back that also restores the database (`restore-database.md`) turns
the media sweeps off first, as that runbook's step 7 says: the restored
database does not know the files uploaded after its restore point. A
roll-back of the release alone leaves them on; a release older than the
media sweeps has none, and ignores `PEAL_MEDIA_SWEEPS`.

## Past API namespaces

The release that gave the API its namespaces writes new operation names
(`posts.tags.create` for `tags.create`, `posts.create` for `posts.send`)
in the workspaces' activity log, staff's audit log and product
analytics' `api_operation` events, and answers the API at new paths. The
release before reads the new names as plain text and shows them as
written, and writes the old ones again. Nothing fails to decode: there is
nothing to check before rolling back. Clients written against the new
paths get 404 from the release before; the web app and the command line
of that release are its own. An `operation` filter of the activity log
finds one set of names at a time, and a query over product analytics
across the release needs both.

## Past per-channel posts

The release that gives a channel media of its own on a post and takes one
channel off a scheduled post (`post_targets.dropped`, migration
`post-targets-dropped`) stores two things the release before it misreads:

- an override's `media` (in `text_overrides` and the parts' `overrides`):
  the release before ignores the key, so that channel would get the post's
  own media, never checked for it and not what was approved, and a write of
  the post, a copy or a recycled occurrence would drop the key for good; a
  file only that channel shows could be deleted from the library
  meanwhile;
- a target taken off its post (`dropped`): the release before counts it in
  the post's outcome (`partiallyPublished` for a post that went out
  everywhere else), fails the claim of a missed post that has one, and
  keeps it on a draft.

1. **Posts still to go out that give a channel media of its own:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id FROM publishing.posts WHERE status IN ('scheduled', 'awaitingApproval', 'publishing') AND (text_overrides @? '\$[*].media' OR follow_ups @? '\$[*].overrides[*].media')"
   ```

2. **Posts still to go out with a channel taken off:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT DISTINCT p.id FROM publishing.posts p JOIN publishing.post_targets t ON t.post_id = p.id WHERE t.dropped AND p.status IN ('scheduled', 'awaitingApproval', 'publishing')"
   ```

3. **Drafts, and the sources of recycling rules, that give a channel media
   of its own:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT p.id, p.workspace_id, p.status, r.id AS rule FROM publishing.posts p LEFT JOIN publishing.recycling_rules r ON r.source_post_id = p.id AND r.status IN ('active', 'paused') WHERE (p.text_overrides @? '\$[*].media' OR p.follow_ups @? '\$[*].overrides[*].media') AND (p.status = 'draft' OR r.id IS NOT NULL)"
   ```

4. **Checks 1 or 2 list a post:** do not roll back yet. Wait until those
   posts have gone out, or have their workspace take them back to draft
   (the web app's **Back to draft**, or `POST …/posts/{postId}/unschedule`),
   then run the checks again. A post taken back to draft moves to check 3.
   Never change the rows by hand.

5. **Check 3 lists a post:** checks 1 and 2 only cover posts already on
   their way. While the release before runs, anything scheduled, duplicated
   or recycled from content with a channel's own media sends the post's
   own media to that channel, and a copy loses that channel's media for
   good; an active rule does so on its next occurrence with nobody acting.
   Before rolling back, have the workspaces of the active rules listed
   pause them (`PATCH …/recycling/{ruleId}` with `"paused": true`, or
   **Pause** in the web app) and keep the paused ones paused, and tell the
   workspaces of the drafts listed not to schedule or duplicate them until
   this release is back. Keep the roll-back short, and run the checks
   again before releasing this one once more.

## Past first comments and polls

The release that sends a post's first comment on Facebook Pages,
Instagram, LinkedIn pages and YouTube, and a post's poll on X, Mastodon
and Threads (`posts.poll`, migration `post-polls`), stores two things the
release before it misreads:

- a poll (`publishing.posts.poll`): the release before ignores the
  column, so the post goes out without it, its question alone, and a
  copy or a recycled occurrence it makes has none; the approval subject
  it writes leaves the poll out, so a post that waits for an approval is
  asked for one again rather than released;
- a first comment (the one part in `follow_ups` on those four
  platforms): the release before takes those platforms for ones that
  take a post alone, so the router refuses the comment
  (`partsNotSupported`) once the post is live, and the channel ends
  **Failed**, the post partly published, never sent again from Peal.
  Scheduling a draft with one refuses it (`tooManyParts`), which the
  member sees, and a recycling rule whose source has one ends at its
  next occurrence (`contentRejected`), for good;
- the flags of first comments (`post_targets.first_comment`,
  `parts_left_out`) and the listing index (`post_targets_listed`, on
  `listed_at`): the release before lists only published targets, so a
  post whose first comment failed is no longer followed by analytics or
  the inbox while it runs, and one a member published without its
  comment reads as published, which it is.

1. **Posts still to go out that ask a poll:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id FROM publishing.posts WHERE status IN ('scheduled', 'awaitingApproval', 'publishing') AND poll IS NOT NULL"
   ```

2. **Posts still to go out with a first comment:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT DISTINCT p.id FROM publishing.posts p JOIN publishing.post_targets t ON t.post_id = p.id JOIN channels.channels c ON c.id = t.channel_id WHERE p.status IN ('scheduled', 'awaitingApproval', 'publishing') AND NOT t.dropped AND jsonb_array_length(p.follow_ups) > 0 AND c.platform IN ('facebook', 'instagram', 'linkedin', 'youtube')"
   ```

3. **Drafts, and the sources of recycling rules, that ask a poll:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT p.id, p.workspace_id, p.status, r.id AS rule FROM publishing.posts p LEFT JOIN publishing.recycling_rules r ON r.source_post_id = p.id AND r.status IN ('active', 'paused') WHERE p.poll IS NOT NULL AND (p.status = 'draft' OR r.id IS NOT NULL)"
   ```

4. **Recycling rules whose source has a first comment:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT DISTINCT r.id AS rule, r.workspace_id, r.status FROM publishing.recycling_rules r JOIN publishing.posts p ON p.id = r.source_post_id JOIN publishing.post_targets t ON t.post_id = p.id JOIN channels.channels c ON c.id = t.channel_id WHERE r.status IN ('active', 'paused') AND jsonb_array_length(p.follow_ups) > 0 AND c.platform IN ('facebook', 'instagram', 'linkedin', 'youtube')"
   ```

5. **Checks 1 or 2 list a post:** do not roll back yet. Wait until those
   posts have gone out, or have their workspace take them back to draft,
   then run the checks again. Never change the rows by hand.

6. **Checks 3 or 4 list a post or a rule:** while the release before
   runs, a draft scheduled with a poll goes out without it, an active
   rule's next occurrence too, and a rule whose source has a first
   comment ends. Have the workspaces of the active rules listed pause
   them (`PATCH …/recycling/{ruleId}` with `"paused": true`, or **Pause**
   in the web app) and keep the paused ones paused, and tell those of the
   drafts listed not to schedule them until this release is back, as for
   per-channel posts above.

## Past X's pass-through

The release that bills X at X's rates (migration `x-usage-settings`)
writes, on a server that bills only, states the release before cannot
read: a post target failed as `paymentMethodRequired`, `paymentFailed`,
`perAccountPricingRequired`, `xCeilingReached` or `xThreadCut` (in the
target and its attempts), a `PostFailed` notice holding one of those
reasons (a notice outlives its post), and a notice `XSpendCeiling`. The
release before fails to decode each of them on every read: the
workspace's posts and the user's notices answer 500 until the release is
rolled forward. A server that does not bill (production today) writes
none of them, and the new table is ignored.

1. **Targets that failed for X's meter:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT t.post_id, t.id FROM publishing.post_targets t WHERE t.failure_reason IN ('paymentMethodRequired', 'xCeilingReached', 'paymentFailed', 'perAccountPricingRequired', 'xThreadCut') OR EXISTS (SELECT 1 FROM publishing.publication_attempts a WHERE a.target_id = t.id AND a.detail::text ~ 'paymentMethodRequired|xCeilingReached|paymentFailed|perAccountPricingRequired|xThreadCut')"
   ```

2. **Notices of X's ceiling, and failure notices holding those reasons:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id FROM notifications.notices WHERE kind = 'XSpendCeiling' OR event->>'_tag' = 'XSpendCeiling' OR (event->>'_tag' = 'PostFailed' AND event->>'reason' IN ('paymentMethodRequired', 'xCeilingReached', 'paymentFailed', 'perAccountPricingRequired', 'xThreadCut'))"
   ```

3. **Either lists a row:** do not roll back past this release; release a
   fix forward instead. Never change the rows by hand.

## Past websites and articles

The release that connects WordPress sites and sends articles to them
(migration `articles`) stores what the release before cannot read:

- a channel of a website (`channels.channels.platform = 'wordpress'`):
  the release before reads every channel as a social network's, so the
  workspace's channels, and the jobs that walk every channel (analytics'
  collection, the inbox's, the warnings that a channel must be
  reconnected soon), fail on that row for every workspace;
- the events and notices that name one: a webhook event of a website's
  channel (`channel.connected`…, `article.published`, `article.failed`)
  and a notice that it must be reconnected, which the release before
  fails to decode where it reads them;
- articles (`publishing.articles`, `publishing.article_calls`,
  `publishing.article_files`) and their
  jobs (`PublishArticleV1`), which the release before ignores: an article
  waiting to go out is not sent while it runs.

1. **Channels of websites:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id FROM channels.channels WHERE platform = 'wordpress'"
   ```

2. **Events and notices that name a website, or an article:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT 'event' AS kind, id FROM webhooks.events WHERE type LIKE 'article.%' OR data->>'platform' = 'wordpress' UNION ALL SELECT 'notice', id FROM notifications.notices WHERE event->'channel'->>'platform' = 'wordpress'"
   ```

3. **Articles waiting to go out:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id, status FROM publishing.articles WHERE status IN ('scheduled', 'publishing')"
   ```

4. **Checks 1 or 2 list a row:** do not roll back past this release;
   release a fix forward instead. Never change the rows by hand.

5. **Check 3 lists an article, and nothing else does:** rolling back
   leaves it unsent until this release is back, when its job runs, late
   or missed past an hour (`missed`). Tell its workspace, or wait until it
   has gone out.

## Past more article sites

The release that adds DEV, Hashnode and sites on WordPress.com stores
what the release before cannot read:

- a channel of one of them (`channels.channels.platform` `devto`,
  `hashnode` or `wordpressCom`), and the events and notices that name
  one: the release before fails on them as the release before websites
  fails on `wordpress` (above);
- an article to check because its site holds another of its title
  (`publishing.articles.state` with the reason `severalOnSite`, and its
  calls' outcome in `publishing.article_calls`), which the release
  before fails to decode where it reads the article.

1. **Channels, events and notices of the new sites:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT 'channel' AS kind, id FROM channels.channels WHERE platform IN ('devto', 'hashnode', 'wordpressCom') UNION ALL SELECT 'event', id FROM webhooks.events WHERE data->>'platform' IN ('devto', 'hashnode', 'wordpressCom') UNION ALL SELECT 'notice', id FROM notifications.notices WHERE event->'channel'->>'platform' IN ('devto', 'hashnode', 'wordpressCom')"
   ```

2. **Articles or calls with the new reason:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT 'article' AS kind, id::text FROM publishing.articles WHERE state::text LIKE '%severalOnSite%' UNION ALL SELECT 'call', article_id::text FROM publishing.article_calls WHERE outcome::text LIKE '%severalOnSite%'"
   ```

3. **Either lists a row:** do not roll back past this release; release
   a fix forward instead. Never change the rows by hand.

## Past follow-up rules

The release that follows posts up at a likes threshold (migration
`follow-up-and-comment-rules`) adds two tables the release before ignores
(`publishing.follow_up_rules`, `publishing.follow_ups`), so rules stop
acting and keep what they armed, and one job, `SendFollowUpV1`, which the
release before does not register: a follow-up on its way when the
release goes back stays `sending` in the cluster's tables, its comment or
repost neither sent nor settled. Rolled forward again, the follow-ups'
run hands it over (armed again when its call never set out,
`unconfirmed` when it may have), so nothing goes out twice.

1. **Follow-ups on their way:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, rule_id, status FROM publishing.follow_ups WHERE status = 'sending'"
   ```

2. **It lists a row:** wait a few minutes for its job to settle it, and
   check again; roll back once it lists none. Rules that are active then
   act again after rolling forward, within their windows.

## Past comment rules

The same release's comment rules (the same migration) add two
tables the release before ignores: rules stop answering, and the replies
they made stay ordinary replies of the inbox, which the release before
reads as any other. Nothing to check before rolling back.

## Past automation notices

The release that tells members what rules acting by themselves did not
do (migrations `automation-notice-preference` and `follow-up-notices`)
adds columns the release before ignores (`email_automations`,
`follow_ups.notice_due`, `follow_up_rules.not_sent_told_at`: nothing is
told there, and what is marked is told after rolling forward) and a key in
an armed follow-up's state, `heldBack`, which it ignores too (such a
follow-up whose window ends there expires `windowEnded`). It writes three
notices the release before cannot read: `FollowUpsNotSent`,
`FollowUpRuleStopped` and `CommentRuleStopped`. The release before fails
to decode each on every read: those users' notices answer 500 until the
release is rolled forward.

1. **Notices of rules acting by themselves:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id FROM notifications.notices WHERE event->>'_tag' IN ('FollowUpsNotSent', 'FollowUpRuleStopped', 'CommentRuleStopped')"
   ```

2. **It lists a row:** do not roll back past this release; release a fix
   forward instead. Never change the rows by hand.

## Past connect links of several platforms

The release that gives a connect link several platforms (migration
`embedding-kit-3`) keeps them in `channels.connect_links.platforms`,
what a link connected so far in `connected_platforms` and `channel_ids`,
and the platform a sign-in started at in `started_platform`. The release
before ignores the three, and reads `platform`, the first: nothing fails
to decode, but a link of several platforms still waiting works there for
its first platform alone, and completes at its next connection, its
`channelIds` then naming that one channel only (those it connected before
stay connected). A sign-in started at another platform then completes
nothing (`invalidState`). The partner accent colour
(`workspace.partners.accent_color`) is ignored, and the hosted pages show
none. A channel move's idempotency key keeps the channel it made in
`workspace.partner_idempotency_keys.channel_id`, which the release before,
which has no move, ignores.

1. **Links of several platforms still waiting:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id, platforms, connected_platforms FROM channels.connect_links WHERE status = 'pending' AND cardinality(platforms) > 1 AND expires_at > now()"
   ```

2. **It lists a row:** roll back only once the partners those workspaces
   belong to know their links offer the first platform alone until the
   release comes back, or once the links have expired. Never change the
   rows by hand.

## Past chats

The release that posts to Discord and Telegram (no migration: platforms,
options and failure reasons are text and JSON) stores what the release
before cannot read:

- a channel of a chat (`channels.channels.platform` `discord` or
  `telegram`): the release before knows neither platform, so the
  workspace's channels, and the jobs that walk every channel (analytics'
  collection, the inbox's, the warnings that a channel must be
  reconnected soon), fail on that row for every workspace;
- a post's target with a chat's options (`publishing.post_targets.options`
  of `platform` `discord` or `telegram`), or failed for a chat's reason
  (`failure_reason` `forumThreadNameRequired` or `chatMigrated`, also in
  the attempts' results), which the release before fails to decode where
  it reads the post, a disconnected chat's posts included;
- the events and notices that name one, at their top (`data.platform`)
  or among a post's targets (`data.targets[].platform`: a post
  scheduled, cancelled or finished), which it fails to decode where it
  reads them.

1. **Channels of chats:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id FROM channels.channels WHERE platform IN ('discord', 'telegram')"
   ```

2. **Posts, events and notices that name a chat:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT 'target' AS kind, id FROM publishing.post_targets WHERE options->>'platform' IN ('discord', 'telegram') OR failure_reason IN ('forumThreadNameRequired', 'chatMigrated') UNION ALL SELECT 'event', id FROM webhooks.events WHERE data->>'platform' IN ('discord', 'telegram') OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(data->'targets') = 'array' THEN data->'targets' ELSE '[]' END) t WHERE t->>'platform' IN ('discord', 'telegram')) UNION ALL SELECT 'notice', id FROM notifications.notices WHERE event->'channel'->>'platform' IN ('discord', 'telegram') OR event->'channel'->'value'->>'platform' IN ('discord', 'telegram') OR event->>'reason' IN ('forumThreadNameRequired', 'chatMigrated')"
   ```

3. **Either lists a row:** do not roll back past this release; release a
   fix forward instead. Never change the rows by hand.

## Past Google Ads

The release that reads Google Ads adds `ads.campaign_days`, and the
columns `ads.accounts.reached_through` and `ads.campaigns.kind`, which the
release before ignores. It also stores what the release before cannot
read: a sign-in or an ad account of the network `google`
(`ads.grants.network`, `ads.accounts.network`). The release before knows
`meta` alone, and fails to decode such a row wherever it reads it: the
hourly sync, which reads every account that is due, the ads page and
API of its workspace, and a workspace's erasure.

1. **Google Ads sign-ins and accounts:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT 'grant' AS kind, id, workspace_id FROM ads.grants WHERE network = 'google' UNION ALL SELECT 'account', id, workspace_id FROM ads.accounts WHERE network = 'google'"
   ```

2. **It lists a row:** do not roll back past this release. The way out,
   when a roll-back cannot wait: the members who connected them remove
   those sign-ins from the workspace's Ads page, which disconnects their
   accounts with them (removing works with `google` no longer in
   `PEAL_ADS_NETWORKS` too), so that the query lists nothing, then roll
   back. Never change the rows by
   hand.

## Past sign-in providers

The release that signs people in with Google or an OpenID Connect provider
stores `auth.account` rows of `google` and `oidc`, which the release before
ignores: a person whose account has only such a row cannot sign in there
until they reset a password through "Forgot password". Nothing else needs
checking.

## Past named AI providers

The release that names a workspace's text provider (migration
`text-provider-names`) adds `assistant.text_providers.provider`, which the
release before ignores: it still writes and reads `kind`, so it reads every
row, a named provider as `openai-compatible` at its address. It then asks
DeepSeek for a strict JSON schema, which DeepSeek refuses, and OpenRouter
without keeping to hosts that take it: such a workspace's suggestions,
tests and agent answer `AssistantFailed` until the release is rolled
forward, or a member saves the provider again. The server's own
`PEAL_AI_PROVIDER` must be one the release before knows (`anthropic` or
`openai-compatible`), or it stops at startup: set it back before rolling
back. Nothing to clean.

The release that names a workspace's image provider (migration
`image-provider-names`) adds `assistant.image_providers.provider`, which
the release before ignores too: it reads every row as the OpenAI images
API at its address (`POST {address}/images/generations`). A row named
`openai` still makes images there. One named `google`, `xai` or
`togetherai` gets a request shaped for another API at that provider's
address: its images answer `ImageProviderRefused` or `AssistantFailed`
until the release is rolled forward, or a member saves the provider as
another provider again. The server's own `PEAL_AI_IMAGE_PROVIDER` must be
`openai-compatible` for the release before, with
`PEAL_AI_IMAGE_BASE_URL` set, or it stops at startup: set them back
before rolling back. Nothing to clean.

## Past connected AI providers

The release that connects a workspace's providers and chooses a model for
each use (migration `provider-connections`) keeps them in
`assistant.provider_connections` and `assistant.capability_models`, which
the release before ignores: it still reads `assistant.text_providers` and
`assistant.image_providers`. When it first starts, this release copies
those rows to connections (their keys sealed again for the connection)
and leaves them in place, read-only. From then on, any change a workspace
makes to its providers or models deletes that workspace's two earlier
rows, so a roll-back never brings back a key a member replaced or
removed. So after a roll-back:

- a workspace that changed nothing since the upgrade keeps its text and
  image providers as they were;
- a workspace that changed anything has no provider of its own: its text
  and images come from the server's models, if any, within its allowance,
  until a member sets them again or the release is rolled forward;
- what a workspace changes on the release before is not seen when rolling
  forward again, for a use it had chosen before (the choice stays as it
  was); a use without a choice is moved again at the next start.

See how many workspaces would lose their own providers (read only):

```sh
sudo peal-compose exec postgres psql --username peal --dbname peal --command \
  "SELECT count(DISTINCT workspace_id) FROM assistant.capability_models m
   WHERE NOT EXISTS (SELECT 1 FROM assistant.text_providers t WHERE t.workspace_id = m.workspace_id)
     AND NOT EXISTS (SELECT 1 FROM assistant.image_providers i WHERE i.workspace_id = m.workspace_id);"
```

Nothing to clean: the new tables stay, and the next release reads them
again. A later release drops the earlier tables.

## Past videos

The release that makes videos with a workspace's own provider (migration
`video-generations`) keeps its jobs in `assistant.video_generations`,
which the release before ignores, a `video` row in
`assistant.capability_models`, which it leaves out as a use it does not
know, and `GenerateVideoV1` jobs in the cluster's tables, which it has no
workflow for: a job queued or running when rolling back stays so (no
video is made and nothing is asked of the provider), and after rolling
forward again it fails `interrupted` once the workspace asks for another
video (half an hour after it was asked) or when its job runs again.
It writes one notice the release before cannot read,
`VideoGenerationEnded`: the release before fails to decode it on every
read, and that member's notices answer 500 until the release is rolled
forward.

1. **Notices of videos:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id FROM notifications.notices WHERE event->>'_tag' = 'VideoGenerationEnded'"
   ```

2. **Jobs on their way** (they will end `interrupted`, and their
   providers may bill them):

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT count(*) FROM assistant.video_generations WHERE status IN ('queued', 'running')"
   ```

3. **The first lists a row:** do not roll back past this release; release
   a fix forward instead. Never change the rows by hand.

## Past audio

The release that makes voice-overs and transcripts with a workspace's own
provider (migration `own-audio-days`) counts them in
`assistant.own_audio_days`, which the release before ignores, keeps
`speech` and `transcription` rows in `assistant.capability_models` and
connections of `elevenlabs` and `fal` in `assistant.provider_connections`,
which it leaves out as uses and providers it does not know (a `fal`
image use with them: that workspace's images go back to the server's
model, or off). It also stores audio files (`audio/mpeg`, `audio/mp4`,
`audio/wav`, kind `audio`) in `media.media_assets`, whose content type
the release before cannot decode: that workspace's media library, and
any post or agent chat that names such a file, fail to read until the
release is rolled forward.

1. **Audio files:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT workspace_id, count(*) FROM media.media_assets WHERE content_type LIKE 'audio/%' GROUP BY workspace_id"
   ```

2. **It lists a row:** do not roll back past this release; release a fix
   forward instead. Never change the rows by hand. With none, rolling back
   is safe: the counts and the audio choices wait for the release to come
   back.

## Past slide videos

The release that composes slide videos with a workspace's own Shotstack
account (migration `slideshows`) keeps its jobs in `assistant.slideshows`,
which the release before ignores, a `composition` row in
`assistant.capability_models` and `shotstack` connections in
`assistant.provider_connections`, which it leaves out as a use and a
provider it does not know, and `ComposeSlideshowV1` jobs in the cluster's
tables, which it has no workflow for: a job queued or running when rolling
back stays so (nothing is sent to Shotstack), and after rolling forward
again it fails `interrupted` once the workspace asks for another slide
video (40 minutes after it was asked) or when its job runs again. A video
already composed is a plain MP4 of the media library, which the release
before reads. It writes one notice the release before cannot read,
`SlideshowEnded`: the release before fails to decode it on every read, and
that member's notices answer 500 until the release is rolled forward.

1. **Notices of slide videos:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id FROM notifications.notices WHERE event->>'_tag' = 'SlideshowEnded'"
   ```

2. **Jobs on their way** (they will end `interrupted`, and Shotstack may
   bill them):

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT count(*) FROM assistant.slideshows WHERE status IN ('queued', 'running')"
   ```

3. **The first lists a row:** do not roll back past this release; release
   a fix forward instead. Never change the rows by hand.

## Past edits rendered whole

The release that renders a whole Shotstack Edit (`POST
…/media/slideshows/edits`, no migration) keeps such a job in
`assistant.slideshows` like a slide video, its `plan` an object with one
key, `edit`, which the release before does not decode. Its run claims the
job (it becomes `running`), fails to read the plan and stops there,
sending nothing to Shotstack: the job stays `running` until the workspace
asks for another slide video 40 minutes after it was asked, when it fails
`interrupted`, and holds the workspace's turn until then. A job that
ended has no plan any more, and a video already rendered is a plain MP4
of the media library, which the release before reads.

1. **Edit jobs on their way:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT count(*) FROM assistant.slideshows WHERE status IN ('queued', 'running') AND plan ? 'edit'"
   ```

2. **It counts more than 0:** wait for them to end (20 minutes at most
   once running), then check again; roll back once it counts 0. Never
   change the rows by hand.

## Past Slack

The release that posts to Slack (no migration: platforms, options and
failure reasons are text and JSON) stores what the release before cannot
read:

- a channel of Slack (`channels.channels.platform` `slack`): the release
  before does not know the platform, so the workspace's channels, and the
  jobs that walk every channel (analytics' collection, the inbox's, the
  warnings that a channel must be reconnected soon), fail on that row for
  every workspace;
- a post's target with Slack's options (`publishing.post_targets.options`
  of `platform` `slack`), or failed as `cannotPost` (`failure_reason`,
  also in the attempts' results), which the release before fails to
  decode where it reads the post;
- the events and notices that name Slack, at their top (`data.platform`)
  or among a post's targets (`data.targets[].platform`), or the reason
  `cannotPost`, which it fails to decode where it reads them.

1. **Channels of Slack:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id FROM channels.channels WHERE platform = 'slack'"
   ```

2. **Posts, events and notices that name Slack or `cannotPost`:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT 'target' AS kind, id FROM publishing.post_targets WHERE options->>'platform' = 'slack' OR failure_reason = 'cannotPost' UNION ALL SELECT 'event', id FROM webhooks.events WHERE data->>'platform' = 'slack' OR data->>'failureReason' = 'cannotPost' OR EXISTS (SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(data->'targets') = 'array' THEN data->'targets' ELSE '[]' END) t WHERE t->>'platform' = 'slack' OR t->>'failureReason' = 'cannotPost') UNION ALL SELECT 'notice', id FROM notifications.notices WHERE event->'channel'->>'platform' = 'slack' OR event->'channel'->'value'->>'platform' = 'slack' OR event->>'reason' = 'cannotPost'"
   ```

3. **Either lists a row:** do not roll back past this release; release a
   fix forward instead. Never change the rows by hand.

## Past Messenger's and Instagram's direct messages

The release that reads Facebook Pages' and Instagram's direct messages
(`PEAL_INBOX_MESSAGES` with `facebook` or `instagram`) stores one value the
release before cannot decode: an outgoing message failed because Meta's
answer window had shut (`engagement.outgoing_messages.reason`
`windowClosed`), which it fails on where it reads the conversation. It
adds no column. The boxes and conversations of Meta channels are harmless
there: the release before reads none of their messages (`unsupported`),
and its retention deletes them in their time. Set `PEAL_INBOX_MESSAGES`
back to the names the release before takes before rolling back, or it
does not start.

1. **Outgoing messages with the new reason:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id FROM engagement.outgoing_messages WHERE reason = 'windowClosed'"
   ```

2. **It lists a row:** do not roll back past this release until those rows
   are gone (30 days after they settled, `PurgeMessages`); release a fix
   forward instead. Never change the rows by hand.

## Past private replies

The release that sends a comment's author one private reply on Instagram
and Facebook Pages (migration `private-replies`) adds a table the release
before ignores (`engagement.private_replies`): it never sends one, lists
comments without theirs, and deletes them with their comments and threads
in their time (the foreign keys cascade); its export and erasure leave the
table out, which rolling forward catches up (an erasure's threads take
their private replies with them). It adds one job, `SendPrivateReplyV1`,
which the release before does not register: a private reply on its way
when the release goes back stays `sending` in the cluster's tables,
neither sent nor settled, its outbound message still claimed. Rolled
forward again, the messages' collection hands it to a person
(`unconfirmed`), so nothing goes out twice.

1. **Private replies on their way:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id FROM engagement.private_replies WHERE status = 'sending'"
   ```

2. **It lists a row:** wait a few minutes for its job to settle it, and
   check again; roll back once it lists none.

## Past a person's answer within Meta's 7 days

The release that lets a member answer a Messenger or Instagram
conversation by hand for 7 days with Meta's Human Agent tag (migration
`person-replies`, `PEAL_META_HUMAN_AGENT`) adds one column the release
before ignores (`engagement.outgoing_messages.by_person`, not null, false
by default): it journals its own messages with the default and never
tags one. A message a member wrote past the 24 hours that is still on
its way when the release goes back is sent untagged, which Meta refuses
as outside its window: it fails `windowClosed` and gives its outbound
message back, so nothing goes out that Meta did not take. It also stores
two reasons the release before cannot decode
(`engagement.outgoing_messages.reason` `humanAgentNotGranted` and
`tagRestricted`), where it reads the conversation. Remove
`PEAL_META_HUMAN_AGENT` before rolling back: the release before does not
read it.

1. **Messages by a person on their way:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id FROM engagement.outgoing_messages WHERE by_person AND status = 'sending'"
   ```

   And the reasons it cannot decode, which hold it until they are gone (30
   days after they settled, `PurgeMessages`; release a fix forward
   instead, and never change the rows by hand):

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT id, workspace_id FROM engagement.outgoing_messages WHERE reason IN ('humanAgentNotGranted', 'tagRestricted')"
   ```

2. **It lists a row:** wait a few minutes for its job to settle it, and
   check again; roll back once it lists none.

## Past rules' private replies

The release that lets a comment rule send a private reply after its
public one (migration `rule-private-replies`) adds a column the release
before ignores (`engagement.comment_rules.private_reply`) and two
(`engagement.comment_rule_matches.private_reply_id`, `private_code`) and
an index on the second: the release before never sends a rule's private
reply, and lists rules and their matches without them. A rule's private
reply is a private reply as above, `SendPrivateReplyV1` included: roll
back only once none is on its way, as [Past private
replies](#past-private-replies) says. Those still waiting for their public
reply (`private_code` `waiting`) are not sent while the release before
runs; rolled forward again, those still within their 7 days go.

1. **Rules' private replies on their way, or waiting:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT p.id, p.workspace_id, p.rule_id FROM engagement.private_replies p WHERE p.status = 'sending' AND p.rule_id IS NOT NULL"
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT rule_id, count(*) FROM engagement.comment_rule_matches WHERE private_code = 'waiting' GROUP BY rule_id"
   ```

2. **The first lists a row:** wait a few minutes for its job to settle
   it, and check again; roll back once it lists none. The second needs no
   wait.

## Past Unified login

The release that connects Instagram through Meta's Unified login
(`META_INSTAGRAM_CONFIG_ID`; no migration: the way in is text) stores a
way in the release before cannot read: `unifiedLogin` in the `connection`
of a channel, a sign-in in progress, an account choice or a connect link.
The release before fails to decode such a channel wherever it reads
channels (the workspace's channels, and the jobs that walk every channel:
analytics' collection, the inbox's, the token sweep and the reconnect
warnings), for every workspace, and such an attempt, choice or link where
it completes, chooses or opens it.

Unsetting `META_INSTAGRAM_CONFIG_ID` stops new ones and leaves the
channels as they are: they keep posting until their token stops working,
and can no longer be reconnected (`notConfigured`) until it is set again.
It makes no roll-back safe.

1. **Rows that name Unified login:**

   ```sh
   sudo peal-compose exec postgres psql --username peal --dbname peal --command \
     "SELECT 'channel' AS kind, count(*) FROM channels.channels WHERE connection = 'unifiedLogin' UNION ALL SELECT 'attempt', count(*) FROM channels.connect_attempts WHERE connection = 'unifiedLogin' UNION ALL SELECT 'choice', count(*) FROM channels.connect_choices WHERE connection = 'unifiedLogin' UNION ALL SELECT 'link', count(*) FROM channels.connect_links WHERE connection = 'unifiedLogin'"
   ```

2. **A count is above zero:** an attempt or a choice is gone within 15
   minutes; wait and check again. While a channel or a connect link names
   it, do not roll back past this release; release a fix forward instead.
   Never change the rows by hand.

## Past API keys that follow their makers

The release that records who made each API key keeps it in the key's
`metadata` (`{"createdBy": "<user id>"}`), which the release before
ignores: its keys keep working there, their list names no maker, and a
member who leaves, is removed, closes their account or is given a lower
role keeps the keys they made until someone revokes them. No migration;
nothing to check before rolling back. Once this release is back, a key
made while the release before ran has no maker, and stays as keys made
before it do.
