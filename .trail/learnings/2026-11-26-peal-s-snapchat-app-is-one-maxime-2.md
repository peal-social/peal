---
title: "Peal's Snapchat app is one OAuth app for both environments, and Snapchat shipped before Snap allowlisted it"
author: Maxime
date: 2026-11-26
branch: feat/snapchat
cost: { minutes: 1, tokens: 7627 }
id: l-04f699e3
scope: repo
status: active
replaces: l-df812e0a
src: agent
touches:
  - packages/peal-docs/docs/fr/guides/channels/index.mdx
  - packages/peal-docs/docs/fr/platforms/snapchat.mdx
  - packages/peal-docs/docs/guides/channels/index.mdx
  - packages/peal-docs/docs/platforms/snapchat.mdx
  - packages/peal-server/src/channels/AGENTS.md
  - packages/peal-server/src/channels/domain/token-policy.ts
  - packages/peal-server/src/channels/infrastructure/platforms/snapchat/snapchat-authorizer.ts
  - packages/peal-server/src/publishing/AGENTS.md
  - packages/peal-server/src/publishing/infrastructure/platforms/snapchat/snapchat-refusal.ts
  - packages/peal-server/test/app/secrets-in-logs.test.ts
---

## Decided
Peal has one Snap OAuth app, named "Peal", for production and the sandbox, with both callbacks on it from the start. Snap's form takes up to ten redirect addresses, and Snap allowlists the Public Profile API per client id, so one app means one allowlist request. This matches the owner's rule for platforms that review apps (Pinterest, TikTok): one app called "Peal", never a separate "Peal Sandbox".
On 2026-11-26 the owner merged the Snapchat code before Snap allowlisted the app. The platform stays off until SNAPCHAT_CLIENT_ID and SNAPCHAT_CLIENT_SECRET are set, so nothing changes on a server without them. The sandbox checks come once Snap allows the app: connect a profile, publish a short video and one above 32 MiB (several parts), and see both play on Snapchat.

## Tried and ruled out
- Two apps, "Peal" and "Peal Sandbox": not needed, since the form takes several redirect addresses, and two apps would need two allowlistings.
- Adding redirect addresses later: Snap fixes an app's name and redirect addresses at creation. A missing address means a new app, a new client id and a new allowlist request. Only the logo can change afterwards.
- Keeping the pull request a draft until the sandbox checks: the owner chose to merge, accepting that the API's `snapchat` value is released for good and the docs list Snapchat while it cannot connect yet.

## Watch out
- Snap support does not allowlist by hand: the request is an email to profile-api-dev-support@snapchat.com with the client id and the intended use, never the secret. An account manager can speed it up; Snap's will write to hello@.
- Until the app is allowlisted, the sign-in works but my_profile answers 403 with an empty body, so a member's Connect fails: keep SNAPCHAT_CLIENT_ID unset on every server until then.
- Nothing has met Snap's upload and Spotlight endpoints yet: the sandbox run is the first real test of the 32 MiB part shape.

In the code:
- Business Manager > Business Details > OAuth Apps > "+ OAuth App"
- Redirects: https://app.peal.social/connect/snapchat/callback and https://sandbox.peal.social/connect/snapchat/callback
- Settings: SNAPCHAT_CLIENT_ID, SNAPCHAT_CLIENT_SECRET (packages/peal-server/src/channels/infrastructure/platforms/channel-platform-settings.ts)
- Pull request #546
