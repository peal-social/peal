# Emails

Every email Peal sends is written here, with React Email: its words in
English and French, its template, and its text part. The server renders them
through its `EmailRenderer` port (`notifications/application/`), and sends
what comes back; the package sends nothing, reads no setting and knows no
transport.

- `src/index.ts` is the only export: `renderAccountEmail`,
  `renderNoticeEmail` and `renderWeeklyDigest`, each the subject, the HTML
  and the text of one email, and `emailAssets`, the pictures they show. The
  sources are consumed as they are, with no build, as `peal-contract`'s are.
- Each render takes the server's `Letterhead`: where it serves
  `emailAssets`, and the line that says who sends, if the operator states
  one, which ends the HTML (under the card) and the text.
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
- `src/components/` holds what the emails share, one component a file, with
  DESIGN.md's values (its Email section) in `theme.ts`: an email takes no
  colour, size or radius of its own, and a new one joins DESIGN.md first.
  `EmailFrame` is the card, its head and its foot; a template gives it its
  heading, its body and its fine print. Set a style React Email's
  components would otherwise choose (`Text` is 14px with 16px margins,
  `Container` 37.5em, `Link` blue without an underline), and pass `lang`
  to `Body` too, as it says `en` otherwise.
- Styles are inline, as some mail clients drop the stylesheet.
  `enhancements.ts` is the only `<style>`, for what cannot be inline (the
  phone's gutters, reduced motion). A class that changes a cell's padding
  goes on the cell (`tdClassName` on `Section` and `Container`): on the
  table, it would add to it.
- The header's glow moves in the digest, the address's confirmation and the
  invitation (`accountMotion`), and is still in every other email. A moving
  one carries both pictures, the still hidden.
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
- A message stays under 20 kB of HTML and the digest's sample under 40 kB:
  Gmail clips an email at 102 kB.

## Pictures

- `src/assets/` holds them, drawn by peal-ui's `email-art` script
  ([its guide](../peal-ui/AGENTS.md)), which its tests compare them with:
  never edit one by hand. `src/assets.ts` reads them as the package loads
  and lists their types; the server serves those and no other.
- A name is for ever, as an inbox keeps asking for it: never rename or
  remove a file. Art that changes meaning takes a new name.
- A picture is decoration: `alt=""`, a width and a height, no text in it
  and no ground of its own, since a mail client may hide it or darken the
  card. What it says is said in text too.
- Every reader asks for the same address: no query and no name of a
  reader's or an email's, as the privacy policy says. Never add a picture
  that tells who opened an email.

## Samples

- Samples are made up: names that say `synthetic`, and hosts under
  `example.test` or `example.com`.

## Previews

`bun nx run peal-emails:dev` shows every email that goes out at
<http://localhost:4325>, in French with `PEAL_EMAILS_PREVIEW_LOCALE=fr`. That
switch is for development alone: only `previews/` reads it, which no image
ships, so it is the exception to listing every setting in the docs'
environment variables page. The preview lists files, so each email has its own under `previews/`; folders
starting with `_` are left out. `previews/static` is a link to `src/assets`,
which the preview server serves.
