export { emailAssets } from "./assets.ts";

export type { EmailAsset } from "./assets.ts";

export type { AccountEmail } from "./emails/account.ts";

export type {
  NoticeChannel,
  NoticeEmail,
  NoticeEvent,
  NoticeExcess,
  NoticeRates,
} from "./emails/notice.ts";

export type { WeeklyDigestEmail } from "./emails/digest-content.ts";

export type { WelcomeEmail } from "./emails/welcome.ts";

export type { Letterhead } from "./letterhead.ts";

export type { Locale } from "./locale.ts";

export {
  renderAccountEmail,
  renderNoticeEmail,
  renderWeeklyDigest,
  renderWelcomeEmail,
} from "./render.tsx";

export type { RenderedEmail } from "./render.tsx";
