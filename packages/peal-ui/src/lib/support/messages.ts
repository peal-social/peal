import type { Locale } from "../site/locales";

// The launcher's strings. French takes U+202F before ? and U+00A0 before :.

export interface SupportMessages {
  /** The launcher's name. */
  readonly open: string;
  /** While Crisp loads, after the launcher was pressed. */
  readonly opening: string;
  /** The launcher's name with `{count}` messages waiting unread. */
  readonly unread: string;
}

export const supportMessages: Record<Locale, SupportMessages> = {
  en: {
    open: "Chat with Peal",
    opening: "Opening the chat",
    unread: "Chat with Peal, {count} unread",
  },
  fr: {
    open: "Écrire à Peal",
    opening: "Ouverture de la discussion",
    unread: "Écrire à Peal, {count} non lus",
  },
};

/** The launcher's name, with the count of messages waiting where any do. */
export const launcherLabel = (
  messages: SupportMessages,
  unread: number
): string =>
  unread > 0
    ? messages.unread.replace("{count}", String(unread))
    : messages.open;
