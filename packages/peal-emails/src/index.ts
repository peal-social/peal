export type { AccountEmail } from "./emails/account.ts";

export type {
  NoticeChannel,
  NoticeEmail,
  NoticeEvent,
  NoticeExcess,
  NoticeRates,
} from "./emails/notice.ts";

export type { WeeklyDigestEmail } from "./emails/digest-content.ts";

export type { Locale } from "./locale.ts";

export {
  renderAccountEmail,
  renderNoticeEmail,
  renderWeeklyDigest,
} from "./render.tsx";

export type { RenderedEmail } from "./render.tsx";
