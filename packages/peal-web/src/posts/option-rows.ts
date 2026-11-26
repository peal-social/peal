import type { ContentViolation, Platform } from "peal-contract";

import type { ComposerFailure } from "#posts/composer-failure.ts";
import { fieldsOf, initialValues, isShown } from "#posts/target-options.ts";
import type {
  OptionField,
  OptionValues,
  OptionsText,
  PostMediaKinds,
} from "#posts/target-options.ts";

/**
 * Whether a channel's options may be given to the other channels of its
 * platform: never TikTok's, which each creator's account limits in its own
 * way (who may see it, what they turned off).
 */
export const copiesOptions = (platform: Platform): boolean =>
  platform !== "tiktok" && fieldsOf(platform).length > 0;

/**
 * Another channel's values once given those of `from`, on the same
 * platform: every field but those the account fills (`lookup`, a board or
 * a list it holds) and the library's files (`media`), which it keeps.
 */
export const copiedOptions = (
  platform: Platform,
  from: OptionValues,
  to: OptionValues | undefined
): OptionValues => {
  const own = to ?? initialValues(platform);

  return Object.fromEntries(
    fieldsOf(platform).flatMap(({ kind, name }) => {
      const value =
        kind === "lookup" || kind === "media" ? own[name] : from[name];

      return value === undefined ? [] : [[name, value]];
    })
  );
};

const isEmpty = (value: boolean | string | undefined): boolean =>
  value === undefined || value === "";

/**
 * How many of a channel's fields hold something else than what a new
 * post starts with: what its row says it chose.
 */
export const chosenOptionsCount = (
  platform: Platform,
  values: OptionValues | undefined
): number => {
  if (values === undefined) {
    return 0;
  }

  const initial = initialValues(platform);

  return fieldsOf(platform).filter(({ name }) => {
    const value = values[name];

    return !isEmpty(value) && value !== initial[name];
  }).length;
};

const isRequired = (field: OptionField): boolean =>
  "required" in field && field.required;

const noViolations: readonly ContentViolation[] = [];

/** What the request refused in the post's content, if it refused it. */
export const violationsOf = (
  failure: ComposerFailure | null
): readonly ContentViolation[] =>
  failure?._tag === "PostContentInvalid" ? failure.violations : noViolations;

/**
 * The channels whose options the request refused, each once, in the
 * order the refusal names them: the composer opens their rows.
 */
export const refusedChannelsOf = (
  failure: ComposerFailure | null
): readonly string[] => [
  ...new Set(
    violationsOf(failure).flatMap((violation) =>
      violation._tag === "optionInvalid" ||
      violation._tag === "optionMissing" ||
      violation._tag === "optionTooLong"
        ? [violation.channelId]
        : []
    )
  ),
];

/**
 * The labels of the fields a channel's platform needs before the post is
 * scheduled, shown with its values and media and still empty: its row
 * names them, so they are filled before Schedule is refused for them.
 */
export const missingRequired = (
  platform: Platform,
  values: OptionValues | undefined,
  media: PostMediaKinds
): readonly OptionsText[] => {
  const held = values ?? initialValues(platform);

  return fieldsOf(platform).flatMap((field) =>
    isRequired(field) &&
    isShown(platform, field, held, media) &&
    isEmpty(held[field.name])
      ? [field.label]
      : []
  );
};
