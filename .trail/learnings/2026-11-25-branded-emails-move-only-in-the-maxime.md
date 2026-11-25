---
title: "Branded emails move only in the digest, the address confirmation and the invitation, once, as a GIF"
author: Maxime
date: 2026-11-25
branch: feat/email-senders
cost: { minutes: 2, tokens: 2231 }
id: l-e0c9c4c5
scope: repo
status: active
src: agent
touches:
  - packages/peal-infra/ansible/README.md
  - packages/peal-infra/ansible/inventory/group_vars/all/main.yml
  - packages/peal-infra/ansible/inventory/group_vars/production/main.yml
  - packages/peal-infra/ansible/inventory/group_vars/sandbox/main.yml
  - packages/peal-infra/ansible/roles/peal_runtime/vars/main.yml
  - packages/peal-infra/ansible/tests/test_runtime.py
  - packages/peal-docker/compose.production.yaml
  - packages/peal-docker/self-host.env.example
  - packages/peal-docs/docs/fr/self-hosting/email.mdx
  - packages/peal-docs/docs/fr/self-hosting/environment-variables.mdx
---

## Decided
The owner chose (2026-11-25) that the header's pixel glow moves in the weekly digest, the address confirmation and the invitation. Every other existing email carries the same art, still, and the footer is still everywhere. It plays once for 4.8 s, as a reader cannot pause a GIF and WCAG 2.2.2 applies past five seconds. The digest's heading is short, and its subject keeps the dates.

In the code: `accountMotion`, `packages/peal-ui/scripts/email-art.ts`, `GET /api/email-assets/:name`.
The owner chose (2026-11-25) to keep email open and click tracking off for now, and to look at it again after general availability.

In the code: `packages/peal-site/src/content/legal/en/privacy.md` and its French twin, and the check in `packages/peal-infra/ansible/README.md`.

## Tried and ruled out
- Moving every email: records and alerts arrive often, and should be quiet.
- Looping: nobody can stop it. A moving footer that plays once: it has finished before the reader scrolls to it.
- CSS keyframes, SVG, APNG and animated WebP: none moves across Gmail and Outlook.
- An opaque GIF, about five times smaller: a white box wherever a client darkens the card.
- Pictures attached to the message: the mailer port has no attachments, and some clients refuse inline ones.
- A fixed-width table for classic Outlook: it needs raw HTML, which the emails do not allow.
- On everywhere, with consent by a line in the privacy policy: consent must be a separate, active choice someone can refuse. The mail provider switches tracking per domain, never per person, and click tracking would send password-reset and confirmation links through a tracking domain.
- An unticked box at sign-up and in settings, with tracked mail on a subdomain of its own: the way to do it if it comes back, and not needed yet.

## Watch out
- `node:zlib` writes different bytes on arm64 and amd64, so the art script writes deflate itself: a test compares bytes.
- caniemail says classic Outlook ignores `display:none` on an image: hide its wrapper.
- No real mail client has been tried yet.
- The CNIL's recommendation of 2026 asks for prior consent for a pixel that measures opens, in any email, with narrow exemptions.
- Turning tracking on makes the privacy policy's sentence on images false: change both together.
- Whether tracking is off in the mail provider's account has not been checked from here.
