# Take a live post down, or correct it

Unpublishing deletes a post from its platforms **for everyone**, every
part of a thread, the last first. It cannot be undone, from Peal or on the
platform. Do it only when the user asked for this very post to be taken
down, and say first which post and which channels it removes.

It needs `post:publish` (owner, admin, editor, or a key given it), and a
sign-in that holds `workspace:publish`.

```sh
peal posts show <post-id> --json
peal posts unpublish <post-id> --channel <channel-id> --yes --wait 30 --json
peal posts unpublish <post-id> --yes --json
peal posts changes <post-id> --json
peal posts list --removed --json
```

Without `--channel`, every channel where it can be removed is. `--json`
needs `--yes`: it never asks. A removal runs in the background: a change is
`pending`, then `done` (the target keeps `status: published` and gets
`removedAt`), or `failed` with its `code`; run `unpublish` again to delete
the parts left. The post stays published in Peal: it did go out.

Where it is refused, `live_post_not_changeable` says why in `reason`:

| `reason`               | What to do                                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `notPublished`         | It is not live on that channel.                                                                               |
| `alreadyRemoved`       | Nothing left to do.                                                                                           |
| `noPlatformId`         | Confirmed by hand: the user deletes it on the platform.                                                       |
| `notSupported`         | The platform does not let Peal: the user deletes it there.                                                    |
| `changeInProgress`     | Read `peal posts changes`, then wait.                                                                         |
| `channelUnavailable`   | The channel must be reconnected or turned back on first.                                                      |
| `boostRunning`         | A boost shows it: the user stops the boost first.                                                             |
| `deletionWindowPassed` | The platform deletes only for a time after the post went out (Telegram: 48 hours): the user deletes it there. |
| `approvalRequired`     | Posts need approval: an approver makes the edit.                                                              |

Which platforms let Peal delete: `peal channels capabilities <channel>
--json`, `livePost.unpublish` (and `unpublishBlockedBy` where not).

## Correct a live post's text

Editing replaces the text of one part of a post on one channel, **for
everyone, at once**. On a social network or a chat, only the text changes,
never media, options or the time. Peal edits on Mastodon, Google Business
Profile, Discord, Telegram, Slack and the websites (WordPress,
WordPress.com, DEV, Hashnode): `livePost.edit` in the capabilities,
`editBlockedBy` where not. Do it only when the user asked for that edit,
and say which post and channel it changes.

```sh
peal posts edit <post-id> --channel <channel-id> --text "The corrected text." --wait 30 --json
peal posts edit <post-id> --channel <channel-id> --part 1 --text "The second part, corrected." --json
```

On a website the edit replaces the article: its text, or its body from a
Markdown file (`--markdown-file`, as [websites.md](websites.md) writes one)
or as the web editor's JSON document (`--body`), and its options (`--options`,
the website's, whole, as JSON tagged by its platform: an option left out is
removed on the site, but a `siteStatus` left out stays the target's). What
is left out of the command stays as it is, and the site keeps its status
and its date. A `--text` replaces a rich text with plain paragraphs: when
the article has formatting, send `--markdown-file` instead, or ask the user first.

```sh
peal posts edit <post-id> --channel <channel-id> --options '{"platform":"wordpress","title":"Doors open at 7 pm"}' --json
peal posts edit <post-id> --channel <channel-id> --body '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Doors open at 7 pm."}]}]}' --json
```

The edit is checked as scheduling checks the post (the title is still
needed; `optionInvalid` for another site status), and its files the site
does not have yet must be the workspace's and ready (`unknown_media`). On a
social network a body is `bodyNotTaken` and options `optionsNotTaken`.

`--part` counts from 0, the post itself. The text is checked as the
channel's is at scheduling (`post_content_invalid` lists what to fix). The
change is `kind: edit`; once `done`, Peal's text for that part on that
channel is the new one and the target has `editedAt`; `failed` has a `code`
(`postGone`: the post is gone from the platform; `pollNotEditable`: a
Mastodon post with a poll, which an edit would remove; `permissionDenied`:
the Mastodon channel must be reconnected). Peal keeps no earlier text.

Over HTTP:

```sh
curl -sS -X POST -H "Authorization: Bearer $PEAL_API_KEY" \
  "$PEAL_API_URL/api/v1/posts/<post-id>/targets/<target-id>/unpublish?wait=30"
curl -sS -X POST -H "Authorization: Bearer $PEAL_API_KEY" \
  "$PEAL_API_URL/api/v1/posts/<post-id>/unpublish"
curl -sS -X POST -H "Authorization: Bearer $PEAL_API_KEY" \
  -H "Content-Type: application/json" -d '{"text": "The corrected text.", "part": 0}' \
  "$PEAL_API_URL/api/v1/posts/<post-id>/targets/<target-id>/edit?wait=30"
curl -sS -H "Authorization: Bearer $PEAL_API_KEY" \
  "$PEAL_API_URL/api/v1/posts/<post-id>/changes"
```
