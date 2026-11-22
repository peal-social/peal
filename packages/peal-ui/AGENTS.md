# peal-ui

The design system, shipped as sources that apps compile (the web app, the
site, the blog, and the docs for what they import). DESIGN.md, at the
repository's root, is what it looks like; read it before changing a
component.

## Components and tokens

- Components are shadcn/ui's look on ui-sdk's behaviour, in
  `src/components`, one per file, light only (no `dark:` class).
  `src/styles/tokens.css` carries DESIGN.md's values; `nx run peal-ui:test`
  compares its colour tables and radius with DESIGN.md.
- Tests run under vitest on Node without a DOM: keep logic in pure
  functions and the DOM glue thin.

## The site's consent and measurement

The site, the docs and the blog ask and measure through one module, the
same on all three:

- `src/lib/site/consent` is the consent notice (`<peal-consent>`, a custom
  element in its light DOM, built with `document.createElement`, styled
  by `src/styles/consent.css` in plain CSS on the tokens, since the docs
  do not compile peal-ui's classes), its answer and its pixel cookie
  (`cookie-art.ts`, pure frames on a 2D canvas). `start.ts` is the one
  script each layout loads up front: without a `<peal-consent>` on the
  page it does nothing.
- One answer cookie, `peal.consent` (`1.<a|r>.<day>`, 183 days, on the
  parent domain when configured), is the one source of truth: the
  notice writes it (`cookies.ts`, through `js-cookie`) and dispatches
  `peal:consent` (`ConsentAnswered`); measurement brings PostHog's own
  consent in line with it on every load.
- `src/lib/site/measurement` is the measurement: settings read at build or
  start (`settings.ts`, off unless a key and a host are both set), the
  SDK's options (cookieless before an answer and after a refusal, one
  cookie once allowed), Peal's own events (`events.ts`, enums and counts
  only) and web vitals (`web-vitals.ts`). Only `measurement/sdk.ts`
  imports `posthog-js` (its slim, no-external build), behind a dynamic
  import; a test reads `src/` for it. `posthog-js` moves with the web
  app's and the `@posthog/*` packages the root `overrides` pin.
- Every event goes through `sanitize.ts`'s allowlist of event names and
  property keys: ids, enums, numbers and booleans, the page's address
  without its query, the referrer's domain alone and three campaign
  labels, recomputed from the page; never a text someone typed, a title,
  a person's properties or an address. A test refuses the server's
  `refusedKeyWords`. Event names are persisted for whoever queries
  PostHog: add, never rename.
- Budgets, gzip: the up-front script and what it imports statically
  2 kB, the notice (code, art and styles) 10 kB, the measurement chunk
  70 kB. The end-to-end run measures them on the site's build.
- `package.json`'s `sideEffects` lists `consent/start.ts` and
  `consent/element.ts`, which run for their effect: without them the
  bundlers drop the import.

## The support chat

- `src/lib/support` is the support chat (DESIGN.md, "Support chat"), the
  same on the app, the site, the docs and the blog: `<peal-support>`
  (`launcher.ts`, in its light DOM, styled by `src/styles/support.css`),
  its pixel bubble for the site and the blog (`launcher-art.ts`, pure
  frames on a 2D canvas) or lucide's message-circle for the app and the
  docs (`data-art`), its
  settings (`settings.ts`: a Crisp website's id, off when unset) and the
  glue to Crisp (`crisp.ts`). Crisp's script loads only once the launcher
  is pressed (or `[data-support-open]` is clicked), or for a browser whose
  cookie names a conversation; nothing else on a page reaches Crisp.
  `start.ts` is what the site's, the docs' and the blog's layouts load:
  without a `<peal-support>` it does nothing. The app makes the element
  itself (`SupportLauncher`) and forgets the conversation at sign-out
  (`forgetConversation`).
- Crisp's window takes Peal's colours and Geist through `support.css`,
  over the variables Crisp sets on `.crisp-client` and the attributes its
  markup carries (`[data-chat-status]`, `[data-maximized]`), never its
  hashed class names: check them on a Crisp upgrade, in a browser.
- The launcher's script imports neither Effect nor peal-contract (gzip:
  under 4 kB, its styles included). `conversationCookieSeconds` is the
  registry's `supportCookie`, which a test compares.
- `sideEffects` lists `support/launcher.ts` and `support/start.ts`.
