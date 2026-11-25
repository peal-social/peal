import type { EmailMessages } from "../catalog/email-catalog.ts";
import { fill } from "../format.ts";
import type { Locale } from "../locale.ts";
import { textPart } from "./text-part.ts";

/** An amount of money, in the currency's smallest unit (cents). */
export interface Money {
  readonly amount: number;
  readonly currency: string;
}

/**
 * What an email says, in its reader's language, as plain text: the same for
 * its HTML, which React escapes, and for its text.
 */
export interface MessageContent {
  /** The button. */
  readonly action: string;
  readonly body: string;
  /** What the email sets apart in a box under its body, if anything. */
  readonly highlight?: string;
  /** Why the reader may ignore the email. */
  readonly ignore: string;
  readonly subject: string;
  /** Where the button goes. */
  readonly url: string;
}

/** A catalogue's messages, with their values. */
export const resolved = (
  messages: EmailMessages,
  values: ReadonlyMap<string, string>,
  url: string
): MessageContent => ({
  action: fill(messages.action, values),
  body: fill(messages.body, values),
  ignore: fill(messages.ignore, values),
  subject: fill(messages.subject, values),
  url,
});

/** A message's text. */
export const messageText = (
  content: MessageContent,
  locale: Locale,
  identity: string | null
): string =>
  textPart(
    {
      action: content.action,
      blocks: [
        content.body,
        ...(content.highlight === undefined ? [] : [content.highlight]),
      ],
      identity,
      ignore: content.ignore,
      url: content.url,
    },
    locale
  );
