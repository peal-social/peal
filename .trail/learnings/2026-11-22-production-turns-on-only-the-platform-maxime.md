---
title: Production turns on only the platform apps that work without a review; TikTok waits for its audit
author: Maxime
date: 2026-11-22
branch: infra/production-linkedin-meta
cost: { minutes: 13, tokens: 373563 }
id: l-fb38adb4
scope: repo
status: active
src: agent
touches:
  - packages/peal-infra/ansible/inventory/group_vars/production/main.yml
  - packages/peal-infra/ansible/inventory/group_vars/sandbox/main.yml
  - ".betterleaks.toml"
  - DESIGN.md
  - packages/peal-cli/test/studio.ts
  - packages/peal-contract/package.json
  - packages/peal-contract/src/account.ts
  - packages/peal-contract/src/agent-api.ts
  - packages/peal-contract/src/agent-approval-not-pending.ts
  - packages/peal-contract/src/agent-busy.ts
---

## Decided
Production gets an app's id and secret as soon as the platform lets the app's own people connect: LinkedIn's profiles (granted at once), and Meta's app and its Threads app in development mode, where only the app's roles connect until App Review. TikTok stays off: its production configuration is a draft, and TikTok issues no production credentials before its audit, so only the sandbox's client key exists. Pinterest waits for Trial access.

## Tried and ruled out
Using the sandbox's TikTok client key in production: that key belongs to TikTok's sandbox and works only for its target users.

## Watch out
A Slack client secret is shared by both environments (one app): rotating it means the vaults, site.yml and a release on both, within the 24 hours Slack keeps the old one valid. Plain ssh to production may have no route from a laptop; read it through Ansible's ad hoc command, which goes through the same proxy as the playbooks.

In the code:
- packages/peal-infra/ansible/inventory/group_vars/production/main.yml (peal_settings: LINKEDIN_CLIENT_ID, META_APP_ID, THREADS_APP_ID)
- uv run ansible peal-production --vault-id production@scripts/vault-pass-client.py -b -m ansible.builtin.shell -a 'readlink -f /srv/peal/current'
