import type { ReactElement } from "react";

import { accountContent, accountMotion } from "../../src/emails/account.ts";
import { digestContent } from "../../src/emails/digest-content.ts";
import { MessageEmail } from "../../src/emails/message.tsx";
import { noticeContent } from "../../src/emails/notice.ts";
import { WeeklyDigest } from "../../src/emails/weekly-digest.tsx";
import { Welcome } from "../../src/emails/welcome-letter.tsx";
import { welcomeContent } from "../../src/emails/welcome.ts";
import type { Letterhead } from "../../src/letterhead.ts";
import type { Locale } from "../../src/locale.ts";
import {
  accountSamples,
  digestSample,
  identity,
  noticeSamples,
  noticeUrl,
  welcomeSample,
  workspaceName,
} from "./samples.ts";

// The language previews are in: English, or French with
// PEAL_EMAILS_PREVIEW_LOCALE=fr.
const locale: Locale =
  process.env["PEAL_EMAILS_PREVIEW_LOCALE"] === "fr" ? "fr" : "en";

// `previews/static` is a link to the assets, which the preview server serves.
const letterhead: Letterhead = { assetsUrl: "/static", identity };

type Preview = () => ReactElement;

/** The preview of an account email's sample. */
export const accountPreview = (
  name: keyof ReturnType<typeof accountSamples>
): Preview => {
  const email = accountSamples(locale)[name];
  const content = accountContent(email);

  const AccountPreview: Preview = () => (
    <MessageEmail
      content={content}
      letterhead={letterhead}
      locale={locale}
      motion={accountMotion(email)}
    />
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
    <MessageEmail content={content} letterhead={letterhead} locale={locale} />
  );

  return NoticePreview;
};

/** The preview of the welcome's sample. */
export const welcomePreview = (): Preview => {
  const content = welcomeContent(welcomeSample(locale));

  const WelcomePreview: Preview = () => (
    <Welcome content={content} letterhead={letterhead} locale={locale} />
  );

  return WelcomePreview;
};

/** The preview of the weekly digest's sample. */
export const digestPreview = (): Preview => {
  const content = digestContent(digestSample(locale));

  const DigestPreview: Preview = () => (
    <WeeklyDigest content={content} letterhead={letterhead} locale={locale} />
  );

  return DigestPreview;
};
