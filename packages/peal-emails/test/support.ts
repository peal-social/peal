import {
  renderAccountEmail,
  renderNoticeEmail,
  renderWeeklyDigest,
} from "../src/index.ts";
import type {
  AccountEmail,
  Letterhead,
  NoticeEmail,
  RenderedEmail,
  WeeklyDigestEmail,
} from "../src/index.ts";

/** A server's letterhead, which states nobody. */
export const letterhead: Letterhead = {
  assetsUrl: "https://app.example.test/api/email-assets",
  identity: null,
};

/** An account email, on that letterhead. */
export const accountEmail = async (
  email: AccountEmail
): Promise<RenderedEmail> => await renderAccountEmail(email, letterhead);

/** A notice, on that letterhead. */
export const noticeEmail = async (email: NoticeEmail): Promise<RenderedEmail> =>
  await renderNoticeEmail(email, letterhead);

/** A weekly digest, on that letterhead. */
export const weeklyDigest = async (
  email: WeeklyDigestEmail
): Promise<RenderedEmail> => await renderWeeklyDigest(email, letterhead);

/** The subject of an email once it is rendered. */
export const subjectOf = async (
  email: Promise<RenderedEmail>
): Promise<string> => {
  const { subject } = await email;

  return subject;
};

/** The text of an email once it is rendered. */
export const textOf = async (
  email: Promise<RenderedEmail>
): Promise<string> => {
  const { text } = await email;

  return text;
};
