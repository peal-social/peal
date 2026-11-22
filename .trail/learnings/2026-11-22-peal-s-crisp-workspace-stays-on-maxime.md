---
title: "Peal's Crisp workspace stays on the Free plan, and the chat shows the founder as its one operator"
author: Maxime
date: 2026-11-22
branch: docs/trail-production-site-yml
cost: { minutes: 1, tokens: 0 }
id: l-390d891e
scope: repo
status: active
src: agent
touches:
  - packages/peal-infra/ansible/inventory/group_vars/production/main.yml
  - packages/peal-ui/src/lib/support/crisp.ts
---

## Decided
- The Crisp workspace "Peal" stays on Crisp's Free plan (the owner's choice): no card on file, so the Essentials trial falls back to Free by itself. Free allows 2 operators.
- Visitors see one person: the hello@peal.social operator carries the founder's photo and first name "Maxime" (Crisp shows first names only), the workspace icon is the same photo, and the chat header shows the workspace logo alone, so a single face appears.
- New-message alerts go by email to hello@peal.social and by push in Crisp's mobile apps, both free.

## Tried and ruled out
- WhatsApp: Crisp's plugin needs the Essentials plan, and it is a channel for customers to write in, not an alert to the team.
- Slack: Crisp's plugin needs the Mini plan.
- "Selected operators" or "Last active operators" in the header: Crisp adds the workspace logo beside them, so the face showed twice.
- A separate Crisp account for maxime@peal.social: Crisp refused it ("forbidden from creating a Crisp account") from the owner's own browser too, after CAPTCHA, its anti-abuse block; Crisp has no resend, only cancel and invite again.

## Watch out
- Crisp's data processing agreement is signed by downloading their PDF and uploading it signed (Settings, Data, Limits & Legal); nothing signs it online.

In the code: the website id 4d7aa8f1-6f97-4c6a-bcd8-79850beab6dc is `PEAL_CRISP_WEBSITE_ID` and `SITE_`/`DOCS_CRISP_WEBSITE_ID` in `packages/peal-infra/ansible/inventory/group_vars/production/main.yml`; the chat's glue is `packages/peal-ui/src/lib/support/crisp.ts`. DPA PDF: https://storage.crisp.chat/public/documents/gdpr_dpa_contract.pdf
