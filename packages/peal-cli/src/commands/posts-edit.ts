import { Console, Effect, Option, Schema } from "effect";
import type { Types } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  LivePostChangeSchema,
  maxOutcomeWaitSeconds,
  RichTextSchema,
  TargetOptionsSchema,
} from "peal-contract";
import type { Channel, LivePostEdit } from "peal-contract";

import { changeLine, targetsOn } from "#commands/posts-unpublish.ts";
import { explain, explainingPublishing } from "#explain.ts";
import { jsonFlag, printJson } from "#json.ts";
import { readMarkdownFile, withImagesStored } from "#markdown-files.ts";
import type { MarkdownFile } from "#markdown-files.ts";
import { channelName } from "#print.ts";
import { Refused } from "#refused.ts";
import { inWorkspace, named, workspaceFlag } from "#workspace.ts";

const decodeOptions = Schema.decodeUnknownEffect(
  Schema.fromJsonString(TargetOptionsSchema)
);

const decodeBody = Schema.decodeUnknownEffect(
  Schema.fromJsonString(RichTextSchema)
);

/**
 * What the flags ask of the edit: its part, and its text, its rich text
 * (as JSON, or a Markdown file) or its options, one at least, the JSON and
 * the file read here, before any request.
 */
const editOf = Effect.fn("posts.edit.payload")(function* editOf(input: {
  readonly body: Option.Option<string>;
  readonly markdownFile: Option.Option<string>;
  readonly options: Option.Option<string>;
  readonly part: number;
  readonly text: Option.Option<string>;
}) {
  if (
    Option.isNone(input.body) &&
    Option.isNone(input.markdownFile) &&
    Option.isNone(input.options) &&
    Option.isNone(input.text)
  ) {
    return yield* new Refused({
      reason:
        "Give --text, --body, --markdown-file or --options, one at least: nothing was edited.",
    });
  }

  if (Option.isSome(input.body) && Option.isSome(input.markdownFile)) {
    return yield* new Refused({
      reason:
        "Give --body or --markdown-file, not both: each is the whole rich text. Nothing was edited.",
    });
  }

  const payload: Types.Mutable<LivePostEdit> = { part: input.part };

  if (Option.isSome(input.text)) {
    payload.text = input.text.value;
  }

  if (Option.isSome(input.body)) {
    payload.body = yield* decodeBody(input.body.value).pipe(
      Effect.mapError(
        (failure) =>
          new Refused({
            reason: `--body is not a rich text's JSON document: ${failure.message}`,
          })
      )
    );
  }

  if (Option.isSome(input.options)) {
    payload.options = yield* decodeOptions(input.options.value).pipe(
      Effect.mapError(
        (failure) =>
          new Refused({
            reason: `--options are not a platform's options: ${failure.message}`,
          })
      )
    );
  }

  const asked: LivePostEdit = payload;

  const markdown: Option.Option<MarkdownFile> = Option.isSome(
    input.markdownFile
  )
    ? Option.some(yield* readMarkdownFile(input.markdownFile.value))
    : Option.none();

  return { asked, markdown };
});

// Arguments are read in the order of their keys.
export const edit = Command.make(
  "edit",
  {
    channel: Flag.String("channel").pipe(
      Flag.withMetavar("<id-or-handle>"),
      Flag.withDescription(
        'The channel of the post to edit: its id, its exact handle, or its platform and handle ("mastodon peal@social.example"); a handle two of its channels share is refused.'
      )
    ),
    json: jsonFlag,
    markdownFile: Flag.String("markdown-file").pipe(
      Flag.withMetavar("<file>"),
      Flag.withDescription(
        "On a website only: the post's new rich text there, from a Markdown file, as peal post --markdown takes one: headings from ## to ####, images by a path (from the file's folder) or an https address, stored first, or as ![alt](media:<media-id>). It replaces its text. The file is read before anything is sent, and never printed."
      ),
      Flag.optional
    ),
    part: Flag.Int("part").pipe(
      Flag.withMetavar("<n>"),
      Flag.withDescription(
        "The part of a thread to edit, from 0 (the post itself, the default)."
      ),
      Flag.withDefault(0)
    ),
    postId: Argument.String("post-id").pipe(
      Argument.withDescription(
        "The post, as the web app or peal posts list shows its id."
      )
    ),
    body: Flag.String("body").pipe(
      Flag.withMetavar("<json>"),
      Flag.withDescription(
        'On a website only: the post\'s new rich text there, as the web editor\'s JSON document ({"type":"doc","content":[…]}), which replaces its text.'
      ),
      Flag.optional
    ),
    options: Flag.String("options").pipe(
      Flag.withMetavar("<json>"),
      Flag.withDescription(
        'On a website only: its options from now on, whole, as JSON tagged by its platform, such as \'{"platform":"wordpress","title":"Doors open at 7 pm"}\'. An option left out is left out on the site; the site status stays as it was.'
      ),
      Flag.optional
    ),
    text: Flag.String("text").pipe(
      Flag.withMetavar("<text>"),
      Flag.withDescription(
        "The new text of that part on that channel. On a website it replaces a rich text with plain paragraphs: give --body or --markdown-file to keep its formatting. It is checked as the channel's text is when a post is scheduled. One of --text, --body, --markdown-file and --options is needed."
      ),
      Flag.optional
    ),
    wait: Flag.Int("wait").pipe(
      Flag.withMetavar("<seconds>"),
      Flag.withDescription(
        `Wait up to that many seconds, ${String(maxOutcomeWaitSeconds)} at most, for the edit to end, then say how it went. It goes on either way: peal posts changes says how.`
      ),
      Flag.optional
    ),
    workspace: workspaceFlag,
  },
  Effect.fn("posts.edit")(function* editPost(input) {
    if (input.part < 0) {
      return yield* new Refused({
        reason: "--part counts from 0, the post itself.",
      });
    }

    const { asked, markdown } = yield* editOf(input);

    const { client, url } = yield* inWorkspace(input.workspace);

    const post = yield* client.posts
      .get({ headers: {}, params: { postId: input.postId } })
      .pipe(Effect.mapError(explain(url)));

    const channels = yield* client.channels
      .list({ headers: {} })
      .pipe(Effect.orElseSucceed((): readonly Channel[] => []));

    const names: ReadonlyMap<string, string> = new Map(
      channels.map((channel) => [channel.id, channelName(channel)])
    );

    // One target, or a refusal: never the first of several that match.
    const [target, ...others] = targetsOn(post, channels, input.channel);

    if (target === undefined) {
      return yield* new Refused({
        reason: `Post ${post.id} is not on ${input.channel}: give a channel's id, its handle, or its platform and handle, as peal posts show ${post.id} lists them.`,
      });
    }

    if (others.length > 0) {
      return yield* new Refused({
        reason: `${input.channel} names more than one of the post's channels: ${[
          target,
          ...others,
        ]
          .map(({ channelId }) => named(names, channelId))
          .join(
            ", "
          )}. Give the channel's id, or its platform and handle. Nothing was done.`,
      });
    }

    // The file's images, stored once the target is known.
    const payload: LivePostEdit = Option.isSome(markdown)
      ? {
          ...asked,
          bodyMarkdown: yield* withImagesStored(
            { client, url },
            markdown.value
          ),
        }
      : asked;

    const change = yield* client.posts
      .editTarget({
        headers: {},
        params: {
          postId: post.id,
          targetId: target.id,
        },
        payload,
        query: Option.match(input.wait, {
          onNone: () => ({}),
          onSome: (seconds) => ({
            wait: Math.min(Math.max(seconds, 0), maxOutcomeWaitSeconds),
          }),
        }),
      })
      .pipe(explainingPublishing(url));

    if (input.json) {
      return yield* printJson(LivePostChangeSchema, change);
    }

    return yield* Console.log(changeLine(change, names, post));
  })
).pipe(
  Command.withDescription(
    "Edit a published post on one channel, where peal channels capabilities says Peal edits: on a social network or a chat only its text changes; on a website its text (or a rich text, --body or --markdown-file) and its options (--options) replace what the site shows, and the site keeps its status and its date. The change is public at once. Once done, it is that part's text on that channel in Peal too."
  )
);
