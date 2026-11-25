import type { ReactElement } from "react";

import { accountContent } from "../../src/emails/account.ts";
import { digestContent } from "../../src/emails/digest-content.ts";
import { MessageEmail } from "../../src/emails/message.tsx";
import { noticeContent } from "../../src/emails/notice.ts";
import { WeeklyDigest } from "../../src/emails/weekly-digest.tsx";
import type { Locale } from "../../src/locale.ts";
import {
  accountSamples,
  digestSample,
  noticeSamples,
  noticeUrl,
  workspaceName,
} from "./samples.ts";

// The language previews are in: English, or French with
// PEAL_EMAILS_PREVIEW_LOCALE=fr.
const locale: Locale =
  process.env["PEAL_EMAILS_PREVIEW_LOCALE"] === "fr" ? "fr" : "en";

type Preview = () => ReactElement;

/** The preview of an account email's sample. */
export const accountPreview = (
  name: keyof ReturnType<typeof accountSamples>
): Preview => {
  const content = accountContent(accountSamples(locale)[name]);

  const AccountPreview: Preview = () => (
    <MessageEmail content={content} locale={locale} />
  );

  return AccountPreview;
};

/** The preview of a notice's sample. */
export const noticePreview = (name: keyof typeof noticeSamples): Preview => {
  const content = noticeContent({
    event: noticeSamples[name],
    locale,
    url: noticeUrl,
    workspaceName,
  });

  const NoticePreview: Preview = () => (
    <MessageEmail content={content} locale={locale} />
  );

  return NoticePreview;
};

/** The preview of the weekly digest's sample. */
export const digestPreview = (): Preview => {
  const content = digestContent(digestSample(locale));

  const DigestPreview: Preview = () => (
    <WeeklyDigest content={content} locale={locale} />
  );

  return DigestPreview;
};
