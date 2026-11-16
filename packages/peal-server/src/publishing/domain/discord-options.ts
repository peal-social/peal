import { Schema } from "effect";

import type { FieldNotes } from "./field-description.ts";
import type { LookupName } from "./lookup.ts";
import type { OptionConstraint } from "./option-constraint.ts";
import { invalid } from "./option-problem.ts";
import type { OptionProblem } from "./option-problem.ts";
import { PostTextSchema } from "./post-text.ts";
import { measureText } from "./text-length.ts";

// Discord's Execute Webhook (docs.discord.com/developers/resources/webhook,
// read 2026-11-16): `allowed_mentions` ("In interactions and webhooks, only
// user mentions are parsed" when it is left out, the message resource's
// Allowed Mentions), `flags` ("only SUPPRESS_EMBEDS, SUPPRESS_NOTIFICATIONS
// and IS_COMPONENTS_V2 can be set") and `thread_name` ("name of thread to
// create (requires the webhook channel to be a forum or media channel)").
// A thread's name is a channel's: "1-100 character channel name" (Start
// Thread in Forum or Media Channel, docs.discord.com/developers/resources/
// channel). Mentions, silence and embeds apply to every part; the thread's
// name to the first part, which opens the forum post.

/** The longest name of a forum post, in characters (Discord's 100). */
export const maxDiscordThreadNameLength = 100;

// A thread's name is one line.
const nameForbidden = ["\n", "\r"] as const;

const nameProblems = (
  name: string | undefined
): readonly OptionProblem<DiscordField>[] => {
  if (name === undefined) {
    return [];
  }

  const length = measureText(name, "codePoints");

  return [
    ...(name.trim() === "" ||
    nameForbidden.some((character) => name.includes(character))
      ? [invalid("threadName")]
      : []),
    ...(length > maxDiscordThreadNameLength
      ? [
          {
            _tag: "tooLong" as const,
            field: "threadName" as const,
            length,
            maximum: maxDiscordThreadNameLength,
          },
        ]
      : []),
  ];
};

/**
 * How a post goes out on a Discord channel. Nothing is needed: left out,
 * the message notifies as usual, shows its links' embeds, and notifies
 * nobody it mentions (Peal sends `allowed_mentions` with nothing to parse,
 * so `@everyone`, a role or a person typed in the text is shown, never
 * pinged, unless `mentions` is on). A forum or media channel needs
 * `threadName`, the title of the forum post the first part opens.
 */
export class DiscordOptions extends Schema.Class<DiscordOptions>(
  "peal-server/publishing/domain/DiscordOptions"
)({
  // Notifies whoever the text mentions: people, roles and `@everyone`.
  mentions: Schema.optionalKey(Schema.Boolean),
  platform: Schema.tag("discord"),
  // Sends without a notification (`SUPPRESS_NOTIFICATIONS`).
  silent: Schema.optionalKey(Schema.Boolean),
  // Shows no embed for the text's links (`SUPPRESS_EMBEDS`).
  suppressEmbeds: Schema.optionalKey(Schema.Boolean),
  // The title of the forum post the first part opens, in a forum or media
  // channel; refused by any other channel.
  threadName: Schema.optionalKey(PostTextSchema),
}) {
  /**
   * What the fields' schemas do not say, for the description clients read
   * (`optionFieldsOn`): every field has an entry.
   */
  static readonly notes: Readonly<
    Record<DiscordField, FieldNotes<LookupName>>
  > = {
    mentions: { ifLeftOut: false },
    silent: { ifLeftOut: false },
    suppressEmbeds: { ifLeftOut: false },
    threadName: {
      forbiddenCharacters: nameForbidden,
      maxLength: maxDiscordThreadNameLength,
    },
  };

  static readonly constraints: readonly OptionConstraint<DiscordField>[] = [];

  /** What Discord would refuse in them. */
  problems(): readonly OptionProblem<DiscordField>[] {
    return nameProblems(this.threadName);
  }
}

/** An option of Discord's. */
export type DiscordField = Exclude<
  keyof typeof DiscordOptions.fields,
  "platform"
>;
