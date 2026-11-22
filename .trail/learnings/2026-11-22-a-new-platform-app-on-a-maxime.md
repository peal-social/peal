---
title: A new platform app on a server needs site.yml and then a release of the running commit
author: Maxime
date: 2026-11-22
branch: infra/sandbox-linkedin
cost: { minutes: 34, tokens: 365359 }
id: l-2255a44a
scope: repo
status: active
src: agent
touches:
  - packages/peal-infra/ansible/inventory/group_vars/sandbox/main.yml
  - packages/peal-server/src/channels/infrastructure/platforms/linkedin/linkedin-authorizer.ts
  - packages/peal-docs/docs/platforms/linkedin.mdx
---

## Decided
Turning on a platform app on a server (its id in peal_settings, its secret in the vault) takes two runs: site.yml writes host.env and credentials.env, then release.yml restarts the server so it reads them. Release the commit the server already runs (read it first), so the restart changes nothing else.
Connecting a LinkedIn profile goes through LinkedIn's sign-in page for apps, which offers only email and password: no Google or Apple button, whether the member is signed in to LinkedIn or not. A member whose account was made with Google has no password, so they must set one on LinkedIn first (forgotten password, then a code by email). The docs' LinkedIn page should tell them.

## Tried and ruled out
site.yml alone: it reports the two files changed and restarts nothing, and the connect page keeps not offering the platform (GET …/channels/platforms still lacks it).
- Changing Peal's request: the authorization URL sends no prompt parameter, so nothing on Peal's side forces the password; LinkedIn shows the page by its own choice, the first time a member meets a new app.
- Signing in to linkedin.com with Google first, then connecting: LinkedIn still asks for the password.
- LinkedIn's settings page to change the password: it needs the current one.

## Watch out
Never restart containers by hand over SSH: servers change only through the playbooks. On production the owner runs both playbooks.

In the code:
- uv run ansible-playbook playbooks/site.yml --limit sandbox --vault-id sandbox@scripts/vault-pass-client.py (--check --diff first)
- sudo readlink -f /srv/peal/current on the server gives the running release
- uv run ansible-playbook playbooks/release.yml --limit sandbox --vault-id sandbox@scripts/vault-pass-client.py -e peal_version=<that commit>
Once the password is set, LinkedIn goes straight to the consent page. The reset form ticks "sign out all devices" by default.

- packages/peal-server/src/channels/infrastructure/platforms/linkedin/linkedin-authorizer.ts (begin: client_id, redirect_uri, response_type, scope, state only)
- docs: packages/peal-docs/docs/platforms/linkedin.mdx and fr/platforms/linkedin.mdx
