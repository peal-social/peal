import {
  ActivityIcon,
  BlocksIcon,
  BookOpenIcon,
  BotIcon,
  BracesIcon,
  CalendarDaysIcon,
  ChartLineIcon,
  CheckCheckIcon,
  ClockIcon,
  CodeIcon,
  FilmIcon,
  GitPullRequestIcon,
  GlobeIcon,
  HandshakeIcon,
  HistoryIcon,
  InboxIcon,
  LayersIcon,
  MessagesSquareIcon,
  PackageIcon,
  PanelsTopLeftIcon,
  PenLineIcon,
  PlugIcon,
  RocketIcon,
  RulerIcon,
  ScaleIcon,
  ServerIcon,
  ShieldCheckIcon,
  SparklesIcon,
  SquareTerminalIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";

import { cn } from "../lib/utils";

// The icons the site's components may show, by name: the props cross from
// an Astro page to a React island as JSON, which cannot carry a component.
const siteIcons = {
  activity: ActivityIcon,
  blocks: BlocksIcon,
  "book-open": BookOpenIcon,
  bot: BotIcon,
  braces: BracesIcon,
  calendar: CalendarDaysIcon,
  chart: ChartLineIcon,
  "check-check": CheckCheckIcon,
  clock: ClockIcon,
  code: CodeIcon,
  film: FilmIcon,
  globe: GlobeIcon,
  handshake: HandshakeIcon,
  history: HistoryIcon,
  inbox: InboxIcon,
  layers: LayersIcon,
  messages: MessagesSquareIcon,
  package: PackageIcon,
  panels: PanelsTopLeftIcon,
  pen: PenLineIcon,
  plug: PlugIcon,
  "pull-request": GitPullRequestIcon,
  rocket: RocketIcon,
  ruler: RulerIcon,
  scale: ScaleIcon,
  server: ServerIcon,
  shield: ShieldCheckIcon,
  sparkles: SparklesIcon,
  terminal: SquareTerminalIcon,
  users: UsersIcon,
  webhook: WebhookIcon,
} as const;

type SiteIcon = keyof typeof siteIcons;

/**
 * A brand's own mark (DESIGN.md, Icons): a simple-icons path, drawn in
 * currentColor, or the letters of a lettered tile for a brand that has no
 * mark there. The page passes the path, so the components hold no logo.
 */
type SiteMark =
  | { readonly kind: "path"; readonly path: string }
  | { readonly kind: "letters"; readonly letters: string };

const Mark = ({
  className,
  mark,
}: {
  readonly className?: string | undefined;
  readonly mark: SiteMark;
}) =>
  mark.kind === "path" ? (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className={cn("size-4 shrink-0", className)}
    >
      <path d={mark.path} />
    </svg>
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        className,
        "bg-foreground text-background flex size-4 shrink-0 items-center justify-center rounded-sm text-[9px] leading-none font-semibold"
      )}
    >
      {mark.letters}
    </span>
  );

/** A named icon, at 16 px unless the class says otherwise. */
const SiteIconView = ({
  className,
  icon,
}: {
  readonly className?: string | undefined;
  readonly icon: SiteIcon;
}) => {
  const Icon = siteIcons[icon];

  return (
    <Icon
      aria-hidden="true"
      strokeWidth={1.75}
      className={cn("size-4 shrink-0", className)}
    />
  );
};

export { Mark, SiteIconView, siteIcons };

export type { SiteIcon, SiteMark };
