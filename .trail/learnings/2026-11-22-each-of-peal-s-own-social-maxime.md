---
title: "Each of Peal's own social accounts signs up with its own forwarded peal.social address, not a plus address"
author: Maxime
date: 2026-11-22
branch: chore/infra-developers-mail
cost: { minutes: 7, tokens: 37194 }
id: l-58696272
scope: repo
status: active
src: agent
touches:
  - packages/peal-infra/pulumi/src/account.ts
  - packages/peal-infra/pulumi/test/account.test.ts
---

## Decided
A new brand account on a platform that allows one account per email (X does) gets its own address on peal.social, added to the addresses Cloudflare Email Routing forwards to the owner. The developer X account, @PealSocialDevs ("Peal Developers"), uses developers@peal.social. The owner chose this over reusing an existing address so each account has an address named after it.

## Tried and ruled out
- hello+devs@peal.social: X accepted it and said it had sent a code, but the code never arrived. Each forwarding rule matches one exact address, so plus addresses are dropped.
- maxime@peal.social: already forwarded, but it is the founder's own address.
- A Gmail plus address on the owner's personal inbox: would tie a brand account to a personal mailbox.

## Watch out
Adding an address means changing the Cloudflare account stack (`pulumi up`). In auto mode the agent is refused permission to run it, so the owner runs it or approves it explicitly.

In the code:
- packages/peal-infra/pulumi/src/account.ts `forwardedLocals` (literal `to` matchers), test in test/account.test.ts
- Apply: cd packages/peal-infra/pulumi && bun scripts/pulumi.ts account preview --stack peal --diff, then account up --stack peal
