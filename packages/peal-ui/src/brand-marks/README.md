# Brand marks outside simple-icons

Every brand's mark comes from simple-icons, but for the brands it does
not hold: LinkedIn and Slack asked to be removed from it, and Google
Business Profile never was in it. Their files are here, taken from each
brand's own source on 2026-11-17 and kept as they were published.
`src/lib/brand-marks.ts` reads the marks the site, the web app and the
docs draw, and its test checks that each still matches its file here.

| File                          | Source                                                                                                                                                                                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `linkedin.svg`                | The `app-linkedin-bug-black-icon` symbol of the icon sprite on LinkedIn's brand downloads page, <https://brand.linkedin.com/downloads>, in an `<svg>` of its own: the [in] mark in one colour. In colour it takes LinkedIn's blue, `#0A66C2`.           |
| `slack.svg`                   | `SLA-Slack-icon-black-RGB.svg`, the Slack media kit's logos, <https://slack.com/media-kit> (View all, <https://salesforce.widencollective.com/c/yn6bxnam>).                                                                                             |
| `slack-color.svg`             | `SLA-Slack-icon-RGB.svg`, from the same collection.                                                                                                                                                                                                     |
| `google-business-profile.svg` | `google_my_business/v7/192px.svg`, the logo Google's own Business Profile page loads, <https://www.google.com/business/>, from <https://www.gstatic.com/images/branding/productlogos/google_my_business/v7/192px.svg>. It has no version in one colour. |

The AI clients the site's Connect menu names, taken on 2026-11-26:

| File                 | Source                                                                                                                                                                                                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `openai-blossom.svg` | `OpenAI-logos/SVGs/OAI_OpenAI-Blossom_Black.svg` in <https://cdn.openai.com/brand/openai-logos.zip>, "Download logos" on <https://openai.com/brand/>: OpenAI's Blossom in black, for ChatGPT. OpenAI asks that no colour be added to it and that it be used only where it relates to OpenAI's services. |
| `grok-bot.svg`       | A bot's drawing on <https://x.ai/bot> (`svg.grok-bot-mark`), as the page serves it: the round head most of its bots wear, with its two eyes up and to the right. The site's mark is the head with the eyes cut out.                                                                                     |
| `muse.svg`           | <https://muse.ai/images/landing/brand/muse-logo.svg>, the logo of Muse, Meta's agent, on <https://muse.ai/>. Its one path is filled with a blue gradient; the site draws the same path in one colour, as every mark.                                                                                    |

OpenAI Dots, Claude Duet, OpenClaw and Hermes Agent have logos that exist
in colour only (a fluffy dot, an app tile, a red mascot, a portrait), so
the menu shows each one's own file in its colours, from the
site's `public/clients/`, with its source beside the list in the site's
`src/home.ts`.

Google publishes no one-colour version of its logo, so the site's
one-colour mark is Peal's own, made from Google's file and nothing else:
the logo's outline (its clip path `c`) with its "G" (the `#EEE` path) cut
out. The web app and the docs show Google's file in its colours.

To update one, replace its file with the brand's new one, then the mark
in `src/lib/brand-marks.ts`, which the test compares with the file.
