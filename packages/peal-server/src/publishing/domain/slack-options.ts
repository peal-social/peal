import { Schema } from "effect";

import type { FieldNotes } from "./field-description.ts";
import type { LookupName } from "./lookup.ts";
import type { OptionConstraint } from "./option-constraint.ts";
import type { OptionProblem } from "./option-problem.ts";

// Slack's `chat.postMessage` (docs.slack.dev/reference/methods/
// chat.postMessage, read 2026-11-16): `unfurl_links` ("Pass true to enable
// unfurling of primarily text-based content"), off unless asked. Slack has
// no silent message: nothing else is offered. It applies to every part.

// Slack takes it with anything.
const slackProblems = (
  _options: SlackOptions
): readonly OptionProblem<SlackField>[] => [];

/**
 * How a post goes out on a Slack channel. Nothing is needed: left out, the
 * message unfurls none of its links' pages, as Slack does for an app's
 * message.
 */
export class SlackOptions extends Schema.Class<SlackOptions>(
  "peal-server/publishing/domain/SlackOptions"
)({
  platform: Schema.tag("slack"),
  // True shows a preview of the pages the text links to.
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
