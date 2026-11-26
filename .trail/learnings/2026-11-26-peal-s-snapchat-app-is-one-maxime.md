---
title: "Peal's Snapchat app is one OAuth app for production and the sandbox, made with both redirect addresses at once"
author: Maxime
date: 2026-11-26
branch: feat/snapchat
cost: { minutes: 28, tokens: 77556 }
id: l-df812e0a
scope: repo
status: active
src: agent
touches:
  - packages/peal-server/test/app/secrets-in-logs.test.ts
  - packages/peal-server/test/publishing/infrastructure/target-options-storage.test.ts
  - packages/peal-sdk/dotnet/src/Peal/Types/ChannelPlatform.cs
  - packages/peal-sdk/dotnet/src/Peal/Types/Platform.cs
  - packages/peal-sdk/dotnet/src/Peal/Types/SnapchatOptions.cs
  - packages/peal-sdk/dotnet/src/Peal/Types/TargetOptions.cs
  - packages/peal-sdk/go/types.go
  - packages/peal-sdk/go/types_test.go
  - packages/peal-sdk/java/src/main/java/social/peal/types/ChannelPlatform.java
  - packages/peal-sdk/java/src/main/java/social/peal/types/Platform.java
---

## Decided
Peal has one Snap OAuth app, named "Peal", for both environments, with the production and the sandbox callbacks on it from the start. Snap's form takes up to ten redirect addresses, one per line, and Snap allowlists the Public Profile API per client id, so one app means one allowlist request and one review. This matches the owner's rule for platforms that review apps (Pinterest, TikTok): one app called "Peal", never a separate "Peal Sandbox".
The Snapchat pull request stays a draft, pushed but unmerged, until Snap allowlists Peal's client id and a Spotlight published from the sandbox (one short video, one above 32 MiB in several parts) plays on Snapchat. The owner chose this on 2026-11-26.

## Tried and ruled out
- Two apps, "Peal" and "Peal Sandbox", which the plan expected because Snap's docs speak of a single redirect address: not needed, since the form takes several, and two apps would need two allowlistings.
- Adding the redirect addresses later: Snap fixes an app's name and redirect addresses when it is created ("Once created, App Name and Redirect URI cannot be updated"). A missing address means a new app, a new client id and a new allowlist request. Only the logo can change afterwards.
- Merging at once: it would list Snapchat on the site, in the docs and in the eight SDKs while no one can connect it, and the API's `snapchat` value can never be withdrawn once released.
- Keeping the branch unpushed: the work would sit where no one sees it while Snap takes its time.

## Watch out
- Only an Organization Admin of the Business Manager organization sees OAuth Apps, and the first app asks to accept the Snap Developer Terms and Snap Business Tools Terms on the organization's behalf.
- The client secret (20 characters) is shown once, right after creation.
- Nothing works until Snap allowlists the client id; until then the server must keep SNAPCHAT_CLIENT_ID unset.

In the code:
- Business Manager > Business Details > OAuth Apps > "+ OAuth App"
- Redirects: https://app.peal.social/connect/snapchat/callback and https://sandbox.peal.social/connect/snapchat/callback
- Settings: SNAPCHAT_CLIENT_ID, SNAPCHAT_CLIENT_SECRET (packages/peal-server/src/channels/infrastructure/platforms/channel-platform-settings.ts)
- Allowlist requests go to profile-api-dev-support@snapchat.com
Nothing on the branch has met Snap's real API: its fakes follow Snap's pages, so the sandbox run is the first real test of the upload's part shape.

- Pull request #546, branch feat/snapchat
