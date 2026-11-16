// The lucide icons the site's menus and blocks may show, by name: props
// cross from an Astro page to a React island as JSON, which cannot carry a
// component.
import {
  ActivityIcon,
  BlocksIcon,
  BookOpenIcon,
  BotIcon,
  BracesIcon,
  CalendarDaysIcon,
  ChartLineIcon,
  CheckCheckIcon,
  GlobeIcon,
  HistoryIcon,
  InboxIcon,
  MessagesSquareIcon,
  PackageIcon,
  PanelsTopLeftIcon,
  PenLineIcon,
  ServerIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquareTerminalIcon,
  WebhookIcon,
} from "lucide-react";

export const siteIcons = {
  activity: ActivityIcon,
  blocks: BlocksIcon,
  "book-open": BookOpenIcon,
  bot: BotIcon,
  braces: BracesIcon,
  calendar: CalendarDaysIcon,
  chart: ChartLineIcon,
  "check-check": CheckCheckIcon,
  globe: GlobeIcon,
  history: HistoryIcon,
  inbox: InboxIcon,
  messages: MessagesSquareIcon,
  package: PackageIcon,
  panels: PanelsTopLeftIcon,
  pen: PenLineIcon,
  server: ServerIcon,
  shield: ShieldCheckIcon,
  sparkles: SparklesIcon,
  terminal: SquareTerminalIcon,
  webhook: WebhookIcon,
} as const;

export type SiteIcon = keyof typeof siteIcons;
