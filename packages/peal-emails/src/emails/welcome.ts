import { catalogs } from "../catalog/index.ts";
import { fill } from "../format.ts";
import type { Locale } from "../locale.ts";
import { textPart } from "./text-part.ts";

/** The one email a person signs: a new account's welcome. */
export interface WelcomeEmail {
  readonly locale: Locale;
  /** The name that signs it, as the operator writes it. */
  readonly signer: string;
  /** Where its button opens: the web app, in the reader's language. */
  readonly url: string;
}

/** What the welcome says, in its reader's language, as plain text. */
export interface WelcomeContent {
  /** The button. */
  readonly action: string;
  /** Its paragraphs before the button. */
  readonly before: readonly string[];
  /** Its paragraphs after the button, the signer's name last. */
  readonly closing: readonly string[];
  /** Why it came. */
  readonly once: string;
  readonly subject: string;
  readonly url: string;
}

/** The welcome's content, in its reader's language. */
export const welcomeContent = ({
  locale,
  signer,
  url,
}: WelcomeEmail): WelcomeContent => {
  const { welcome: words } = catalogs[locale];

  return {
    action: words.action,
    before: [
      fill(words.greeting, new Map([["signer", signer]])),
      words.firstStep,
    ],
    closing: [words.api, words.reply, signer],
    once: words.once,
    subject: words.subject,
    url,
  };
};

/** The welcome's text, which ends its letter on its signer's name. */
export const welcomeText = (
  content: WelcomeContent,
  locale: Locale,
  identity: string | null
): string =>
  textPart(
    {
      action: content.action,
      blocks: content.before,
      closing: [...content.closing, content.once],
      identity,
      url: content.url,
    },
    locale
  );
