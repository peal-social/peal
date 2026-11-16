import { Schema } from "effect";

import type { FieldNotes } from "./field-description.ts";
import type { LookupName } from "./lookup.ts";
import type { OptionConstraint } from "./option-constraint.ts";
import type { OptionProblem } from "./option-problem.ts";

// Telegram's Bot API 10.4 (core.telegram.org/bots/api, read 2026-11-16):
// `disable_notification` ("Sends the message silently. Users will receive
// a notification with no sound.") on every send method, and
// `link_preview_options` ("Link preview generation options for the
// message") on `sendMessage` only, so a part with media shows no preview
// whatever it says. Both apply to every part.

// Telegram takes any of them, with any other.
const telegramProblems = (
  _options: TelegramOptions
): readonly OptionProblem<TelegramField>[] => [];

/**
 * How a post goes out on a Telegram channel or group. Nothing is needed:
 * left out, the message notifies as usual and a text alone shows its
 * first link's preview, as Telegram does.
 */
export class TelegramOptions extends Schema.Class<TelegramOptions>(
  "peal-server/publishing/domain/TelegramOptions"
)({
  // False sends a text alone without its link's preview.
  linkPreview: Schema.optionalKey(Schema.Boolean),
  platform: Schema.tag("telegram"),
  // Sends with a notification that makes no sound.
  silent: Schema.optionalKey(Schema.Boolean),
}) {
  /**
   * What the fields' schemas do not say, for the description clients read
   * (`optionFieldsOn`): every field has an entry.
   */
  static readonly notes: Readonly<
    Record<TelegramField, FieldNotes<LookupName>>
  > = {
    linkPreview: { ifLeftOut: true },
    silent: { ifLeftOut: false },
  };

  static readonly constraints: readonly OptionConstraint<TelegramField>[] = [];

  /** Telegram refuses nothing in them. */
  problems(): readonly OptionProblem<TelegramField>[] {
    return telegramProblems(this);
  }
}

/** An option of Telegram's. */
export type TelegramField = Exclude<
  keyof typeof TelegramOptions.fields,
  "platform"
>;
