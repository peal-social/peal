import {
  ActivityIcon,
  BlocksIcon,
  BookOpenIcon,
  BotIcon,
  BotMessageSquareIcon,
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
  HouseIcon,
  ImageIcon,
  InboxIcon,
  KeyRoundIcon,
  LayersIcon,
  MegaphoneIcon,
  NewspaperIcon,
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
  WandSparklesIcon,
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
  "bot-message": BotMessageSquareIcon,
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
  home: HouseIcon,
  image: ImageIcon,
  inbox: InboxIcon,
  key: KeyRoundIcon,
  layers: LayersIcon,
  megaphone: MegaphoneIcon,
  newspaper: NewspaperIcon,
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
  wand: WandSparklesIcon,
  webhook: WebhookIcon,
} as const;

type SiteIcon = keyof typeof siteIcons;

/**
 * A brand's own mark (DESIGN.md, Icons): a path drawn in currentColor
 * (simple-icons', on its 24-unit box, or one of `lib/brand-marks.ts` with
 * its own box), or the letters of a lettered tile for a brand that has no
 * mark. The page passes the mark, so the components hold no logo.
 */
type SiteMark =
  | {
      /**
       * The brand's own colour, where a mark is shown in it (the hero's
       * Connect menu); otherwise the text's colour.
       */
      readonly colour?: string | undefined;
      readonly kind: "path";
      /** `evenodd` where a shape inside another is a hole, such as a letter. */
      readonly fillRule?: "evenodd" | undefined;
      readonly path: string;
      /** The box the path fills, when it is not simple-icons' 24 units. */
      readonly viewBox?: string | undefined;
    }
  | { readonly kind: "letters"; readonly letters: string };

/** What tells one mark from another, such as a list's key. */
const markKey = (mark: SiteMark) =>
  mark.kind === "path" ? mark.path : mark.letters;

const Mark = ({
  className,
  mark,
}: {
  readonly className?: string | undefined;
  readonly mark: SiteMark;
}) =>
  mark.kind === "path" ? (
    <svg
      viewBox={mark.viewBox ?? "0 0 24 24"}
      aria-hidden="true"
      fill={mark.colour ?? "currentColor"}
      className={cn("size-4 shrink-0", className)}
    >
      <path d={mark.path} fillRule={mark.fillRule} />
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

export { Mark, markKey, SiteIconView, siteIcons };

export type { SiteIcon, SiteMark };
