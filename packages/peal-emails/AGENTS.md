# Emails

Every email Peal sends is written here, with React Email: its words in
English and French, its template, and its text part. The server renders them
through its `EmailRenderer` port (`notifications/application/`), and sends
what comes back; the package sends nothing, reads no setting and knows no
transport.

- `src/index.ts` is the only export: `renderAccountEmail`,
  `renderNoticeEmail` and `renderWeeklyDigest`, each the subject, the HTML
  and the text of one email. The sources are consumed as they are, with no
  build, as `peal-contract`'s are.
- `src/catalog/` holds the words. `english.ts` and `french.ts` fill
  `email-catalog.ts`, with `{placeholders}`, and both change together.
  `vocabulary.ts` names the reasons, plans and meters the catalogues give
  words to: the server's own lists, as types.
- `src/emails/` makes an email of what happened. `account.ts` and `notice.ts`
  resolve a catalogue's words into a `MessageContent`, plain text, which the
  one template, `message.tsx`, and the text part are both written from;
  `digest-content.ts` and `weekly-digest.tsx` do the same for the digest.
- Load what rendering needs when the package loads, never with the first
  email: the server imports it as it starts, so an install that lacks a
  part of it stops the server there. React Email's `render` loads
  `react-dom/server` when it is first called, so `src/render.tsx` imports
  it too.
- `src/components/` is where the branded components go. It holds what the
  emails share, with every colour, size and radius in `theme.ts`: an email
  takes none of its own. Set a style React Email's components would
  otherwise choose (`Text` is 14px with 16px margins, `Container` 37.5em,
  `Link` blue without an underline), and pass `lang` to `Body` too, as it
  says `en` otherwise.
- Import components and `render` from `react-email` alone: the
  `@react-email/*` component packages are deprecated. `react-email` and
  `@react-email/ui`, the preview server, move together.

## Adding or changing an email

- An event the server tells needs its member in `NoticeEvent`
  (`emails/notice.ts`), its words in both catalogues, a sample in
  `previews/_support/samples.ts` and a preview file. The input types match
  the server's field for field: `peal-server:typecheck` fails while the
  server names an event or a reason this package has no words for.
- A name someone typed (a member's, a workspace's) goes into an email only
  through `nameForMail` (`src/names.ts`): one that reads as a host or an
  address is replaced by the catalogue's `withheldNames` ("A member", "a
  workspace"), so no email of Peal's carries a link someone typed.
- Let React escape: no `dangerouslySetInnerHTML`, and no HTML in the
  catalogues. Keep each paragraph one string child, as React puts a comment
  between two.
- The text part is composed by hand (`emails/text-part.ts`), never made from
  the HTML: the server's tests and the end-to-end run read the first address
  of an account email's text as its link (`test/samples.test.ts` checks it).
- An email stays under 102 kB of HTML, where Gmail clips it.
- Samples are made up: names that say `synthetic`, and hosts under
  `example.test` or `example.com`.

## Previews

`bun nx run peal-emails:dev` shows every email that goes out at
<http://localhost:4325>, in French with `PEAL_EMAILS_PREVIEW_LOCALE=fr`. That
switch is for development alone: only `previews/` reads it, which no image
ships, so it is the exception to listing every setting in the docs'
environment variables page. The preview lists files, so each email has its own under `previews/`; folders
starting with `_` are left out.
