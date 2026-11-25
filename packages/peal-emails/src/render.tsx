import type { ReactElement } from "react";
// What React Email's render loads when it is first called: loaded here
// instead, so an install without it fails when this module loads.
import "react-dom/server";
import { render } from "react-email";

import type { HeaderMotion } from "./components/email-header.tsx";
import { accountContent, accountMotion } from "./emails/account.ts";
import type { AccountEmail } from "./emails/account.ts";
import { digestContent, digestText } from "./emails/digest-content.ts";
import type { WeeklyDigestEmail } from "./emails/digest-content.ts";
import { messageText } from "./emails/message-content.ts";
import type { MessageContent } from "./emails/message-content.ts";
import { MessageEmail } from "./emails/message.tsx";
import { noticeContent } from "./emails/notice.ts";
import type { NoticeEmail } from "./emails/notice.ts";
import { WeeklyDigest } from "./emails/weekly-digest.tsx";
import type { Letterhead } from "./letterhead.ts";
import type { Locale } from "./locale.ts";

/** An email ready to send: its subject, and the same words as HTML and text. */
export interface RenderedEmail {
  readonly html: string;
  readonly subject: string;
  readonly text: string;
}

// The one caller of React Email's render.
const rendered = async (
  template: ReactElement,
  subject: string,
  text: string
): Promise<RenderedEmail> => ({
  html: await render(template),
  subject,
  text,
});

const renderedMessage = async (
  content: MessageContent,
  locale: Locale,
  letterhead: Letterhead,
  motion: HeaderMotion
): Promise<RenderedEmail> =>
  await rendered(
    <MessageEmail
      content={content}
      letterhead={letterhead}
      locale={locale}
      motion={motion}
    />,
    content.subject,
    messageText(content, locale, letterhead.identity)
  );

/** An account email in its reader's language. */
export const renderAccountEmail = async (
  email: AccountEmail,
  letterhead: Letterhead
): Promise<RenderedEmail> =>
  await renderedMessage(
    accountContent(email),
    email.locale,
    letterhead,
    accountMotion(email)
  );

/** A notice, in its reader's language. */
export const renderNoticeEmail = async (
  email: NoticeEmail,
  letterhead: Letterhead
): Promise<RenderedEmail> =>
  await renderedMessage(
    noticeContent(email),
    email.locale,
    letterhead,
    "still"
  );

/**
 * A person's weekly digest: for each workspace, its posts that went out,
 * failed or must be checked in the week, and those planned in the week
 * after, counted, the first named by the start of their text, with
 * engagement where the reader may read analytics. Days in UTC, as the
 * reader's time zone is not known; how to turn it off at its foot.
 */
export const renderWeeklyDigest = async (
  email: WeeklyDigestEmail,
  letterhead: Letterhead
): Promise<RenderedEmail> => {
  const content = digestContent(email);

  return await rendered(
    <WeeklyDigest
      content={content}
      letterhead={letterhead}
      locale={email.locale}
    />,
    content.subject,
    digestText(content, email.locale, letterhead.identity)
  );
};
