<p align="center">
  <a href="https://peal.social">
    <img src=".github/logo/peal-cube.svg" alt="Peal" width="160" height="160" />
  </a>
</p>

<h1 align="center">Peal</h1>

<p align="center">
  Schedule social posts with your team.<br />
  Peal is fair source, so you can also run it yourself.
</p>

<p align="center">
  <a href="https://peal.social"><strong>Website</strong></a> ·
  <a href="https://docs.peal.social"><strong>Docs</strong></a> ·
  <a href="https://docs.peal.social/reference"><strong>API reference</strong></a> ·
  <a href="https://docs.peal.social/self-hosting"><strong>Self-hosting</strong></a> ·
  <a href="https://status.peal.social"><strong>Status</strong></a> ·
  <a href="https://github.com/orgs/peal-social/projects/1"><strong>Roadmap</strong></a> ·
  <a href="https://discord.gg/VBZ5pPT9ss"><strong>Discord</strong></a> ·
  <a href="https://github.com/peal-social/peal/issues/new/choose"><strong>Report an issue</strong></a>
</p>

<p align="center">
  <a href="https://github.com/peal-social/peal/actions/workflows/ci.yml"><img src="https://github.com/peal-social/peal/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/badge/license-FSL--1.1--ALv2-blue" alt="Licence: FSL-1.1-ALv2" /></a>
  <a href="packages/peal-sdk"><img src="https://img.shields.io/badge/SDKs-Apache--2.0-green" alt="SDKs: Apache-2.0" /></a>
  <a href="https://www.npmjs.com/package/peal-sdk"><img src="https://img.shields.io/npm/v/peal-sdk?label=peal-sdk" alt="peal-sdk on npm" /></a>
</p>

> [!WARNING]
> Peal is being built in the open and hasn't been released yet. The hosted
> service at [app.peal.social](https://app.peal.social) is an early preview.
> There are no published images yet, so a server of your own builds them from
> source.

## What's Peal?

You write a post once, and Peal sends it to the channels you pick at the time
you set, in your time zone. Each platform's counts come back to Peal, so you
can see what worked without opening every app. You can work in it with your
team, or through the API, the command line or an AI agent.

Here's what it does today:

- **One post, many channels.** You write the text once and change it on the
  channels that need something different. The composer counts each
  platform's limit as you type. A post can be a thread, and carry images,
  videos, PDF documents and alt text.
- **No duplicate posts.** When a platform doesn't answer, Peal tries again
  after 1, 5, 15, 60 and 60 minutes, then marks the post failed there. When a
  platform takes a post and its answer is lost, Peal marks it to check and
  asks you to look, because a second attempt could post it twice.
- **A team in each workspace.** Members have one of 5 roles, and posts can
  wait for an approval before they go out. People outside the workspace
  review a post through a link.
- **Results in one place.** Peal reads each post's counts every hour for its
  first 48 hours, then every day until it's 30 days old. You can compare
  channels day by day and export the figures.
- **Rules that act for you.** A comment rule answers the comments that hold
  one of your keywords, 25 times a day at most. A follow-up comments under
  your own post, or reposts it, once it has the likes you set.
- **Built to build on.** There's a typed HTTP API with SDKs in 8 languages, a
  command line, an MCP endpoint, an agent skill and signed webhooks.
- **Yours to run.** A server of your own needs Postgres and an S3-compatible
  store. Billing, captcha, AI and telemetry stay off until you set them up.
- **Or ours.** Peal Cloud charges per connected account, by the day, and your
  first accounts are free. Members, workspaces and posts aren't limited. The
  [pricing page](https://peal.social/pricing/) has the figures.

## Platforms

Peal posts to 12 social networks and 3 chats, publishes articles to 4 kinds
of website, and reads ad accounts on 2 ad networks. Each platform's limits
and media rules are in the docs' [Platforms](https://docs.peal.social/platforms)
page.

### Social networks

Every network takes posts, and most give their counts back. The Inbox column
says what Peal reads there and what you can answer:

| Network                 | Publish |      Analytics      | Inbox                                               |
| ----------------------- | :-----: | :-----------------: | --------------------------------------------------- |
| Mastodon                |    ✓    |          ✓          | Comments, direct messages                           |
| Bluesky                 |    ✓    |          ✓          | Comments, direct messages                           |
| LinkedIn profiles       |    ✓    |                     |                                                     |
| LinkedIn pages          |    ✓    |          ✓          | Comments (awaiting LinkedIn)                        |
| X                       |    ✓    | ✓ (operator opt-in) |                                                     |
| Threads                 |    ✓    |          ✓          |                                                     |
| Instagram               |    ✓    |          ✓          | Comments, messages, private replies (awaiting Meta) |
| Facebook Pages          |    ✓    |          ✓          | Comments, messages, private replies (awaiting Meta) |
| TikTok                  |    ✓    |          ✓          |                                                     |
| YouTube                 |    ✓    |          ✓          | Comments (awaiting Google)                          |
| Pinterest               |    ✓    |          ✓          |                                                     |
| Snapchat                |    ✓    |                     |                                                     |
| Google Business Profile |    ✓    |                     | Reviews (awaiting Google)                           |

"Awaiting" means the feature is built but stays off until the platform has
reviewed the server's app. For Facebook and Instagram that's Meta's App
Review. YouTube needs Google's verification, Google Business Profile needs
Google's API access, and LinkedIn pages need LinkedIn's comment scopes. X
bills every read, so its counts stay off unless whoever runs the server
turns them on.

Direct messages are private, so Peal reads none until whoever runs the server
turns them on. An owner or an admin then turns them on one channel at a time,
and Peal keeps each message for 30 days. The
[Inbox](https://docs.peal.social/guides/engage/inbox) page has the details,
and [Analytics](https://docs.peal.social/guides/engage/analytics) lists the
counts each network gives.

### Chats

A chat takes posts, but Peal reads nothing back from it, so there are no
counts and no inbox. Here's how each one takes a post:

| Chat     | Connects with                         | A thread's parts                        | Media                                   | Edit and delete                                      |
| -------- | ------------------------------------- | --------------------------------------- | --------------------------------------- | ---------------------------------------------------- |
| Discord  | A channel's webhook                   | Messages in a row, or one forum post    | Images and videos                       | Both                                                 |
| Telegram | Your own bot, in a channel or a group | Replies, each to the part before        | Photos and MP4 videos, or one GIF alone | Edit, and delete within 48 hours of sending          |
| Slack    | Signing in to Slack, one channel each | Replies in the thread of the first part | Images, no video                        | Both, unless the workspace stops edits after a while |

### Websites

A website takes articles rather than posts. An article has a title, a
formatted body, an excerpt, tags, categories and a featured image. Here's
what each kind of site takes:

| Website                      | Connects with                           | Tags, at most | Categories, at most | On the site                      | Unpublish                    |
| ---------------------------- | --------------------------------------- | :-----------: | :-----------------: | -------------------------------- | ---------------------------- |
| A WordPress site of your own | Its address, a user and an app password |      20       |         20          | Published, a draft, or scheduled | Moves it to the site's trash |
| WordPress.com                | Signing in to WordPress.com             |      20       |         20          | Published, a draft, or scheduled | Moves it to the site's trash |
| DEV                          | An API key                              |       4       |          –          | Published, a draft, or scheduled | Turns it back into a draft   |
| Hashnode, on its Pro plan    | A personal access token                 |      15       |          –          | Published or a draft             | Removes it from the site     |

Peal never sends an article twice. When a site's answer is lost and Peal
can't find the article there by its title, it marks the article to check,
and you look on the site before sending it again
([Websites and articles](https://docs.peal.social/guides/channels/websites)).

### Ads

Ad accounts connect next to your channels. They stay off until whoever runs
the server turns ads on, and nothing spends until an owner lets an account
spend and sets its monthly ceiling. Here's what Peal does on each network:

| Network              | What Peal reads                                             | How often     | Next to your posts                       | Boost a post                                                          |
| -------------------- | ----------------------------------------------------------- | ------------- | ---------------------------------------- | --------------------------------------------------------------------- |
| Meta (awaiting Meta) | Campaigns, ad sets, ads and each ad's numbers by day        | Every hour    | Yes, on the page of the post it promotes | On a Facebook Page or Instagram, within the account's monthly ceiling |
| Google Ads           | Campaigns and each one's daily cost, impressions and clicks | Every 6 hours | No, its numbers stand on their own       | No, Peal changes nothing at Google                                    |

Meta has to grant the server's app its App Review before Peal can read or
spend on anyone else's ad account. The
[Ads](https://docs.peal.social/guides/engage/ads) page has the rest.

## Features

Here's the rest of what you can do, grouped by the job it helps with:

<table>
<tr>
<td width="50%" valign="top">

**Compose and schedule**

- Drafts, a calendar you drag posts on, and a media library you can search
- Text, media and options of its own on each channel, threads and alt text
- A writing assistant, on Anthropic's models or any OpenAI-compatible one
- Every attempt on every channel, with **Post again** where one failed

</td>
<td width="50%" valign="top">

**Collaborate**

- Workspaces with members, 5 roles and invitations
- Review links, where people outside the workspace comment and approve
- Notifications in the app and by email, and a weekly digest
- Sign-in with a password or Google, and your own [OpenID Connect provider](https://docs.peal.social/self-hosting/single-sign-on) on a server you run
- A staff console with an audit log, for whoever runs the server

</td>
</tr>
<tr>
<td width="50%" valign="top">

**Measure and engage**

- Each post's and account's counts by channel and day, against the days before
- The best posts, each post's counts over time, and CSV exports
- An [inbox](https://docs.peal.social/guides/engage/inbox) for comments, reviews and direct messages, answered as the connected account
- Meta [ads](https://docs.peal.social/guides/engage/ads) next to the posts they promote, boosts within a monthly ceiling, and Google Ads campaigns

</td>
<td width="50%" valign="top">

**Automate and integrate**

- [Comment rules](https://docs.peal.social/guides/engage/inbox#comment-rules) that answer keywords, and [follow-ups](https://docs.peal.social/guides/posts/queues#follow-ups) that act once a post has enough likes
- An [HTTP API](https://docs.peal.social/developers) with workspace API keys and OAuth
- [Webhooks](https://docs.peal.social/developers/webhooks) signed as Standard Webhooks says, with 8 attempts over about a day
- The [`peal` command line](https://docs.peal.social/developers/cli) and an [MCP endpoint](https://docs.peal.social/developers/mcp)
- [Embedding](https://docs.peal.social/developers/embedding) with partner accounts and connect links

</td>
</tr>
</table>

## Official Peal SDKs

The SDKs are generated from the API contract and published to each
language's registry. They're under Apache-2.0, unlike the rest of the
repository. Pick yours:

<p align="center">
  <a href="packages/peal-sdk/node"><img src="https://img.shields.io/badge/TypeScript-peal--sdk-3178C6?style=for-the-badge&logo=typescript&logoColor=white" height="32" alt="TypeScript / JavaScript" /></a>
  <a href="packages/peal-sdk/python"><img src="https://img.shields.io/badge/Python-peal--sdk-3776AB?style=for-the-badge&logo=python&logoColor=white" height="32" alt="Python" /></a>
  <a href="packages/peal-sdk/go"><img src="https://img.shields.io/badge/Go-peal--sdk-00ADD8?style=for-the-badge&logo=go&logoColor=white" height="32" alt="Go" /></a>
  <a href="packages/peal-sdk/ruby"><img src="https://img.shields.io/badge/Ruby-peal-CC342D?style=for-the-badge&logo=ruby&logoColor=white" height="32" alt="Ruby" /></a>
  <a href="packages/peal-sdk/java"><img src="https://img.shields.io/badge/Java-social.peal-ED8B00?style=for-the-badge&logo=openjdk&logoColor=white" height="32" alt="Java" /></a>
  <a href="packages/peal-sdk/php"><img src="https://img.shields.io/badge/PHP-peal--social%2Fpeal-777BB4?style=for-the-badge&logo=php&logoColor=white" height="32" alt="PHP" /></a>
  <a href="packages/peal-sdk/dotnet"><img src="https://img.shields.io/badge/.NET-Peal-512BD4?style=for-the-badge&logo=dotnet&logoColor=white" height="32" alt=".NET" /></a>
  <a href="packages/peal-sdk/rust"><img src="https://img.shields.io/badge/Rust-peal--sdk-000000?style=for-the-badge&logo=rust&logoColor=white" height="32" alt="Rust" /></a>
</p>

Here's the Node.js client asking the API who your key belongs to:

```ts
import { PealClient } from "peal-sdk";

const peal = new PealClient({ token: process.env.PEAL_API_KEY });
const credential = await peal.credential.get();
```

AI agents can work in a workspace through the
[MCP endpoint](https://docs.peal.social/developers/mcp), the
[`peal` command line](https://docs.peal.social/developers/cli) or the
[agent skill](packages/peal-skills/skills/peal/SKILL.md). The workspace
decides whether an agent only drafts posts for a person to review, or
publishes them.

## Self-hosting

Peal runs anywhere Docker does. You'll need:

- a server with Docker Engine 28 and Compose 2.35 or later, and a domain
  pointing at it;
- Postgres (included in the stack) and an S3-compatible store;
- a way to send email: SMTP or Resend.

Billing, captcha, the writing assistant, ads and telemetry stay off until you
set them up. Until then nothing is limited, and nothing is sent to those
services.

Clone the repository, copy the settings file outside it and fill it in, then
start the stack:

```sh
git clone https://github.com/peal-social/peal.git && cd peal/packages/peal-docker
mkdir -p /srv/peal && cp self-host.env.example /srv/peal/peal.env   # then fill it in
docker compose --project-name peal --file compose.production.yaml \
  --file compose.self-host.yaml --env-file /srv/peal/peal.env up --build --detach --wait
```

Caddy then serves Peal on your domain, with a Let's Encrypt certificate. The
[self-hosting guide](https://docs.peal.social/self-hosting) explains each
service and how to connect each platform.
[Environment variables](https://docs.peal.social/self-hosting/environment-variables)
lists every setting.

## Resources

Here's where to read more, ask for help or report a problem:

- [Documentation](https://docs.peal.social)
- [Roadmap](https://github.com/orgs/peal-social/projects/1)
- [API reference](https://docs.peal.social/reference)
- [Self-hosting guide](https://docs.peal.social/self-hosting)
- [Discord](https://discord.gg/VBZ5pPT9ss) (chat with the team and other
  users)
- [Discussions](https://github.com/peal-social/peal/discussions) (ideas and
  questions)
- [Bug tracker](https://github.com/peal-social/peal/issues) (bugs and
  platform quirks)
- [Contributing](.github/CONTRIBUTING.md) (developing Peal, running it from
  source)
- [Security policy](SECURITY.md) (report a vulnerability privately)
- [Status](https://status.peal.social)
- [Code](https://github.com/peal-social/peal)

## Licensing

Peal is the licensor. The repository has two licences, and this table says
which part is under which:

| Part                                                         | Licence                                                                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Everything, unless a folder below has a `LICENSE` of its own | [FSL-1.1-ALv2](LICENSE.md): any use but a competing service, and Apache-2.0 two years after each release |
| [`peal-contract`](packages/peal-contract), the API contract  | [Apache-2.0](packages/peal-contract/LICENSE)                                                             |
| [`peal-sdk`](packages/peal-sdk), the SDKs                    | [Apache-2.0](packages/peal-sdk/LICENSE)                                                                  |
| [`peal-skills`](packages/peal-skills), the agent skill       | [Apache-2.0](packages/peal-skills/LICENSE)                                                               |

Peal is fair source, not open source. You can use, change and self-host it
for anything except offering it to others as a competing service. Each
release becomes Apache-2.0 two years after it ships.

The web app's video editor runs on Shotstack's Studio SDK
(`@shotstack/shotstack-studio`), which is not Peal's and comes under its
own licence, the
[PolyForm Shield License 1.0.0](https://polyformproject.org/licenses/shield/1.0.0).
Required Notice: Copyright Shotstack Pty Ltd (https://shotstack.io). Peal
changes it through `patches/` so it fetches its fonts and WebAssembly from
the page's own origin. Its terms allow any use but providing a product that
competes with Shotstack's, and a self-hoster who runs the editor takes them
on too. The editor renders every video through the workspace's own Shotstack
account, never in the browser.

The SDKs are generated from the contract's OpenAPI document, so the contract
is Apache-2.0 too. What an SDK user installs, and the API description it
comes from, carry no FSL terms. Each `package.json` names its licence, and
each Apache-2.0 package has a `NOTICE` naming Peal as its copyright holder.
