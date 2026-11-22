---
title: "Crisp's chat is themed and opened by Peal's own launcher, and Crisp's quirks shape the glue"
author: Maxime
date: 2026-11-22
branch: feat/support-chat
cost: { minutes: 76, tokens: 208609 }
id: l-75af7ee5
scope: repo
status: active
src: agent
touches:
  - packages/peal-ui/src/lib/support/events.ts
  - packages/peal-ui/src/lib/support/element.ts
  - packages/peal-ui/src/lib/support/settings.ts
  - packages/peal-ui/src/styles/support.css
  - packages/peal-web/src/components/shell/support-launcher.tsx
  - DESIGN.md
  - packages/peal-web/AGENTS.md
  - packages/peal-contract/src/data-processing.ts
  - packages/peal-e2e/tests/site-measurement.e2e.ts
  - packages/peal-ui/AGENTS.md
---

## Decided
- Peal opens Crisp itself (peal-ui `<peal-support>`, `packages/peal-ui/src/lib/support/element.ts`): a pixel speech bubble on the marketing site and the blog, a lucide message-circle in the docs, and in the web app the account menu's Support (`openSupportChat`), no launcher (the owner's choices). Crisp's round button is hidden by CSS; its script loads only on a press or when its conversation cookie exists, so no consent is asked. Escape or a press outside closes the window, as Crisp's has no close on a computer.
- Crisp offers only preset colours and no position offset: Peal's blue, Geist and the window's place come from `packages/peal-ui/src/styles/support.css` over the variables Crisp sets inline on `.crisp-client` (`--crisp-color-theme-*`, overridden with !important) and its data attributes, never its hashed `cc-…` classes.
- Support conversations are kept 3 years after their last message (CNIL's period for customer and prospect contacts, `supportConversations` in `packages/peal-contract/src/data-processing.ts`); Crisp cannot delete by itself, so staff do. MagicType is off in Crisp's settings, as the privacy policy covers sent messages only.
- When one branch carries a value the secrets scan flags, that branch's own work rewrites its history (the value moved where secrets go, then a force-push); other pull requests wait rather than work around it.
- site.yml and the release for production run from main's newest commit, re-fetched right before, and the release names that sha; when main moves while preparing, ask again for the new sha.

## Tried and ruled out
- Calling `chat:show` + `chat:open` alone: Crisp brings back a chat left open on an earlier page, and `chat:opened` never fires for it. `crisp.ts` closes any chat the launcher did not ask for (`closeUnasked`) and tells "opened" itself when it was already open.
- Creating Crisp accounts from Lilo's isolated tab: Crisp answered "forbidden from creating a Crisp account" after the CAPTCHA; an operator accepts the invite from their own browser.
- A fix commit on top of the flagged one: the scan reads every commit of every branch, so the old commit still fails it.
- Rerunning a blocked pull request's failed job before the rewrite lands: it fetches the same history and fails again.
- Releasing an unmerged branch to production to get around the block: a later release of main would take the change out again.
- Applying site.yml from the commit approved a few minutes earlier: another session had merged and applied production app ids since, and the dry run from the older commit would have removed LINKEDIN_CLIENT_ID, META_APP_ID and THREADS_APP_ID from host.env, switching those apps off.

## Watch out
- `$crisp.push(["on", event, cb])` keeps one callback per event: registering another (even in a debug console) replaces the launcher's.
- Crisp rejects an email on a non-public domain (`peal.test`), showing "You mistyped your email".
- The failing job names no file or commit (`--redact`): run the same scan locally after a fetch, with a report path, and ask git which branches contain the commit it names.
- Merging the flagged commit into main would fail the check on main forever.

In the code: `.github/workflows/ci.yml`'s `secrets` job checks out with `fetch-depth: 0` and runs `betterleaks git .`; Betterleaks' `linkedin-client-id` rule flagged `LINKEDIN_CLIENT_ID` in `packages/peal-infra/ansible/inventory/group_vars/sandbox/main.yml` (commit 47eb6c3, PR #426) and blocked PR #431.
- site.yml writes host.env from the inventory alone: any line not in the checkout you run from is deleted. Read every `-` line of the `--check --diff` before applying.
- Other sessions apply site.yml and release too: re-read `/srv/peal/current` and the dry run just before acting.

In the code: `uv run ansible-playbook playbooks/site.yml --limit production --vault-id production@scripts/vault-pass-client.py --check --diff`, then without `--check`; `release.yml ... -e peal_version=<main's sha>`.
