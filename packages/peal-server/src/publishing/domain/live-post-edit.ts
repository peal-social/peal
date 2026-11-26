import { Option, Result, Schema } from "effect";

import type { ChannelId } from "#shared/domain/ids.ts";
import { isSitePlatform } from "#shared/domain/platform.ts";
import type { ArticleBody } from "#shared/domain/rich-text/rich-body.ts";

import { ChannelOptions } from "./channel-options.ts";
import { checkPublishable, violationsOn } from "./content-rules.ts";
import type { ChannelOnPlatform } from "./content-rules.ts";
import type { ContentViolation } from "./content-violation.ts";
import type { MediaFile } from "./media-file.ts";
import {
  partAlone,
  partsOn,
  PostContent,
  textOn,
  withTextOn,
} from "./post-content.ts";
import { richOverride } from "./rich-override.ts";
import type { SiteStatusOption } from "./site-options.ts";
import { TargetOptionsSchema } from "./target-options.ts";
import type { TargetOptions } from "./target-options.ts";
import { TextOverride } from "./text-override.ts";

/**
 * What the channel's platform would refuse in the post once `text` is the
 * text of its part at `part` there, checked as scheduling checks that
 * part (`violationsOn`, with the target's options: a Mastodon content
 * warning counts): the part alone, its media as they are, a violation of
 * a later part naming it by `part`. An edit never leaves a part without
 * text, media or not (`empty`).
 */
export const editViolationsOn = (edit: {
  readonly channel: ChannelOnPlatform;
  readonly content: PostContent;
  readonly options: Option.Option<TargetOptions>;
  readonly part: number;
  readonly text: string;
}): readonly ContentViolation[] => {
  const { channel, part, text } = edit;
  const named = { channelId: channel.channelId, platform: channel.platform };

  const violations: readonly ContentViolation[] =
    text.trim() === ""
      ? [{ _tag: "empty", ...named }]
      : violationsOn(
          partAlone(
            withTextOn(edit.content, part, channel.channelId, text),
            part
          ),
          channel,
          edit.options
        );

  return part === 0
    ? violations
    : violations.map((violation) =>
        "platform" in violation ? { ...violation, part } : violation
      );
};

// The post's first part with `override` as the channel's, in the place
// its override had, or after the others.
const withOverride = (
  content: PostContent,
  override: TextOverride
): PostContent =>
  new PostContent({
    followUps: content.followUps,
    media: content.media,
    overrides: content.overrides.some(
      ({ channelId }) => channelId === override.channelId
    )
      ? content.overrides.map((kept) =>
          kept.channelId === override.channelId ? override : kept
        )
      : [...content.overrides, override],
    poll: content.poll,
    text: content.text,
  });

/**
 * What an edit asks of a part's text on a channel: `text`, or, on a
 * website, a rich text (`body`), whose plain text `text` is.
 */
export interface LiveTextEdit {
  readonly body: Option.Option<ArticleBody>;
  readonly text: string;
}

// The first part once edited: with a body, the channel's override is the
// body's (`richOverride`); without, a text other than the channel's makes
// the override that text, a plain one, with the media it gave (a body it
// had goes); the same text changes nothing, as a website's edit of its
// options alone asks.
const withFirstEdited = (
  content: PostContent,
  channelId: ChannelId,
  edit: LiveTextEdit
): PostContent => {
  if (Option.isSome(edit.body)) {
    return withOverride(content, richOverride(channelId, edit.body.value));
  }

  if (edit.text === textOn(content, channelId)) {
    return content;
  }

  const media = content.overrides.find(
    (kept) => kept.channelId === channelId
  )?.media;

  return withOverride(
    content,
    new TextOverride(
      media === undefined
        ? { channelId, text: edit.text }
        : { channelId, media, text: edit.text }
    )
  );
};

/**
 * The post once an edit of its part at `index` on a channel is done: the
 * first part as `withFirstEdited` leaves it (a rich text, or a plain
 * text, the media its override gave kept), a later one with the text as
 * its own there (`withTextOn`). The use case's check, the job's call and
 * the settling all read it, so the platform and Peal never disagree.
 */
export const withEditOn = (
  content: PostContent,
  index: number,
  channelId: ChannelId,
  edit: LiveTextEdit
): PostContent =>
  index === 0
    ? withFirstEdited(content, channelId, edit)
    : withTextOn(content, index, channelId, edit.text);

/**
 * The post's first part as the website's channel shows it, alone: its
 * text and its media there, and its override's text and body, so the
 * files checked are those the site gets, never another channel's.
 */
export const siteContentOn = (
  content: PostContent,
  channelId: ChannelId
): PostContent => {
  const [first] = partsOn(content, channelId);

  const override = content.overrides.find(
    (kept) => kept.channelId === channelId
  );

  return new PostContent({
    media: first?.media ?? content.media,
    overrides:
      override === undefined
        ? []
        : [
            new TextOverride(
              override.body === undefined
                ? { channelId, text: override.text }
                : { body: override.body, channelId, text: override.text }
            ),
          ],
    text: content.text,
  });
};

// What the site makes of the post, as its options say: `publish` when
// they say nothing.
const siteStatusOf = (
  options: Option.Option<TargetOptions>
): SiteStatusOption =>
  options.pipe(
    Option.flatMap((chosen) =>
      Option.fromUndefinedOr(
        "siteStatus" in chosen ? chosen.siteStatus : undefined
      )
    ),
    Option.getOrElse((): SiteStatusOption => "publish")
  );

const encodeOptions = Schema.encodeSync(TargetOptionsSchema);

const decodeOptions = Schema.decodeUnknownSync(TargetOptionsSchema);

/**
 * A website's new options with the target's own `siteStatus` where they
 * leave it out: the site keeps its status, so options sent again without
 * it mean the one the target has.
 */
export const withSiteStatusKept = (
  options: TargetOptions,
  was: Option.Option<TargetOptions>
): TargetOptions => {
  const kept = was.pipe(
    Option.flatMap((before) =>
      Option.fromUndefinedOr(
        "siteStatus" in before ? before.siteStatus : undefined
      )
    )
  );

  // An option left out is no key of the class at all.
  if (
    !isSitePlatform(options.platform) ||
    ("siteStatus" in options && options.siteStatus !== undefined) ||
    Option.isNone(kept)
  ) {
    return options;
  }

  return decodeOptions({ ...encodeOptions(options), siteStatus: kept.value });
};

/**
 * What a website would refuse in its post once edited, checked as
 * scheduling checks it (`checkPublishable`: its title, its excerpt, its
 * cover and its images, among `files`), on `content`, the post as the
 * edit leaves it on the channel (`siteContentOn` of `withEditOn`), and
 * `options`, the target's new options. The site keeps its status: a
 * `siteStatus` other than the target's (`was`) is `optionInvalid`.
 */
export const siteEditViolationsOn = (edit: {
  readonly channel: ChannelOnPlatform;
  readonly content: PostContent;
  readonly files: readonly MediaFile[];
  readonly options: Option.Option<TargetOptions>;
  readonly was: Option.Option<TargetOptions>;
}): readonly ContentViolation[] => {
  const { channel, content, files, options } = edit;
  const named = { channelId: channel.channelId, platform: channel.platform };

  const status: readonly ContentViolation[] =
    siteStatusOf(options) === siteStatusOf(edit.was)
      ? []
      : [{ _tag: "optionInvalid", ...named, field: "siteStatus" }];

  const checked = checkPublishable(
    content,
    [channel],
    files,
    Option.match(options, {
      onNone: () => [],
      onSome: (chosen) => [
        new ChannelOptions({ channelId: channel.channelId, options: chosen }),
      ],
    })
  );

  return [
    ...status,
    ...Result.match(checked, {
      onFailure: ({ violations }) => violations,
      onSuccess: () => [],
    }),
  ];
};
