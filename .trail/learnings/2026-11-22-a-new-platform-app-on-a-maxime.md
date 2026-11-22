---
title: A new platform app on a server needs site.yml and then a release of the running commit
author: Maxime
date: 2026-11-22
branch: infra/sandbox-linkedin
cost: { minutes: 23, tokens: 305203 }
id: l-2255a44a
scope: repo
status: active
src: agent
touches:
  - packages/peal-infra/ansible/inventory/group_vars/sandbox/main.yml
---

## Decided
Turning on a platform app on a server (its id in peal_settings, its secret in the vault) takes two runs: site.yml writes host.env and credentials.env, then release.yml restarts the server so it reads them. Release the commit the server already runs (read it first), so the restart changes nothing else.

## Tried and ruled out
site.yml alone: it reports the two files changed and restarts nothing, and the connect page keeps not offering the platform (GET …/channels/platforms still lacks it).

## Watch out
Never restart containers by hand over SSH: servers change only through the playbooks. On production the owner runs both playbooks.

In the code:
- uv run ansible-playbook playbooks/site.yml --limit sandbox --vault-id sandbox@scripts/vault-pass-client.py (--check --diff first)
- sudo readlink -f /srv/peal/current on the server gives the running release
- uv run ansible-playbook playbooks/release.yml --limit sandbox --vault-id sandbox@scripts/vault-pass-client.py -e peal_version=<that commit>
