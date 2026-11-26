# Posting to a website

A website (WordPress, WordPress.com, DEV, Hashnode) is a channel: a post goes
to it with `peal post` or `peal drafts save`, as to any channel. Its article
is the channel's text there, and the article's other fields are the
channel's options: `title` (needed to schedule), `excerpt`, `coverMediaId`,
`tags`, WordPress's `categories`, and `siteStatus` (`publish` or `draft`).

## The body, from a Markdown file

Write the article's body as a Markdown file and give it with
`--markdown <channel-id>=<file>`, the title in `--options`:

```sh
peal post "Sow your peas early this year." --channel <channel-id> --at 2026-12-14T08:00:00Z --markdown <channel-id>=./peas.md --options '<channel-id>={"platform":"wordpress","title":"Sow your peas early"}' --dry-run --json
peal drafts save --text "Sow your peas early this year." --channel <channel-id> --markdown <channel-id>=./peas.md --json
```

The file is CommonMark with GitHub's extensions. Peal takes paragraphs,
bold, italic, struck and code text, links (http, https, mailto), headings
from `##` to `####`, lists, quotes, separators, code blocks with their
language, and images. It refuses, and names each with its line and column
(`bodyInvalid` and its `problems`):

- a heading of level 1, 5 or 6: the title is the `title` option, so start
  the body at `##`;
- raw HTML (but a comment or `<br>`), a table, a footnote, front matter
  (`---` at the top: put the title and the tags in `--options`);
- a link on another scheme, or a relative one;
- an image that is no file of the workspace, or one inside a heading or a
  link.

An image the file names by a path (from the file's folder) or an `https://`
address is stored first, as `--media` stores one; one written
`![alt](media:<media-id>)` is the workspace's already. With `--dry-run`,
which stores nothing, the file must name its images by media id: store them
first with `peal media upload` or `peal media import`.

The file is read before anything is sent, 400,000 characters at most. Peal
keeps the body it read, never the Markdown: `peal posts show` answers it as
`body`.

## Editing a live article

`peal posts edit` takes the new body as a file too, which replaces the
article's text for everyone at once (only when the user asked, as
[live-posts.md](live-posts.md) says):

```sh
peal posts edit <post-id> --channel <channel-id> --markdown-file ./peas.md --json
```
