import { Schema } from "effect";

import type { FieldNotes } from "./field-description.ts";
import type { LookupName } from "./lookup.ts";
import type { OptionConstraint } from "./option-constraint.ts";
import type { OptionProblem } from "./option-problem.ts";

// Slack's `chat.postMessage` (docs.slack.dev/reference/methods/
// chat.postMessage, read 2026-11-16): `unfurl_links` ("Pass true to enable
// unfurling of primarily text-based content") and `unfurl_media` ("Pass
// false to disable unfurling of media content"), both sent as the option
// says, off unless asked. Slack has no silent message: nothing else is
// offered. It applies to every part.

// Slack takes it with anything.
const slackProblems = (
  _options: SlackOptions
): readonly OptionProblem<SlackField>[] => [];

/**
 * How a post goes out on a Slack channel. Nothing is needed: left out, the
 * message shows no preview of the pages or the media its links lead to.
 */
export class SlackOptions extends Schema.Class<SlackOptions>(
  "peal-server/publishing/domain/SlackOptions"
)({
  platform: Schema.tag("slack"),
  // True shows previews of the pages and the media the text links to.
  unfurlLinks: Schema.optionalKey(Schema.Boolean),
}) {
  /**
   * What the fields' schemas do not say, for the description clients read
   * (`optionFieldsOn`): every field has an entry.
   */
  static readonly notes: Readonly<Record<SlackField, FieldNotes<LookupName>>> =
    { unfurlLinks: { ifLeftOut: false } };

  static readonly constraints: readonly OptionConstraint<SlackField>[] = [];

  /** Slack refuses nothing in them. */
  problems(): readonly OptionProblem<SlackField>[] {
    return slackProblems(this);
  }
}

/** An option of Slack's. */
export type SlackField = Exclude<keyof typeof SlackOptions.fields, "platform">;
