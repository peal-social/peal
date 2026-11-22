"use client";

import type { LucideIcon } from "lucide-react";
import {
  BellIcon,
  BellRingIcon,
  BotIcon,
  NewspaperIcon,
  CableIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CreditCardIcon,
  FileUpIcon,
  HouseIcon,
  ImageIcon,
  InboxIcon,
  KeyRoundIcon,
  LayersIcon,
  LayoutGridIcon,
  ListOrderedIcon,
  MailIcon,
  MessageSquareReplyIcon,
  MessagesSquareIcon,
  MegaphoneIcon,
  PenLineIcon,
  RecycleIcon,
  ReplyIcon,
  RssIcon,
  SettingsIcon,
  ShieldIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  SquarePenIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
  WebhookIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "peal-ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "peal-ui/components/dropdown-menu";
import { cn } from "peal-ui/lib/utils";
import { useState } from "react";
import type { ComponentProps, ComponentType, ReactNode } from "react";

import { useCloseMenu } from "#components/shell/frame-view.tsx";
import type { Link, Mode, Navigation, Page } from "#shell/navigation.ts";
import { createWorkspacePath, workspacePath } from "#shell/workspace-path.ts";

/** A link of the app, which the container makes from next-intl's. */
export type LinkComponent = ComponentType<{
  readonly "aria-current"?: "page";
  readonly children: ReactNode;
  readonly className?: string;
  readonly href: string;
  readonly onClick?: () => void;
}>;

/** Each page's icon, in the sidebar and the command menu. */
export const pageIcons: Readonly<Record<Page, LucideIcon>> = {
  account: UserIcon,
  ads: MegaphoneIcon,
  agent: BotIcon,
  agentSettings: BotIcon,
  analytics: ChartColumnIcon,
  apiKeys: KeyRoundIcon,
  articles: NewspaperIcon,
  assistant: SparklesIcon,
  billing: CreditCardIcon,
  calendar: CalendarDaysIcon,
  channelSets: LayersIcon,
  channels: CableIcon,
  feeds: RssIcon,
  general: SettingsIcon,
  home: HouseIcon,
  import: FileUpIcon,
  inbox: InboxIcon,
  invitations: MailIcon,
  media: ImageIcon,
  members: UsersIcon,
  partner: UsersIcon,
  platforms: LayoutGridIcon,
  posts: SquarePenIcon,
  queues: ListOrderedIcon,
  recycling: RecycleIcon,
  followUps: ReplyIcon,
  commentRules: MessageSquareReplyIcon,
  messages: MessagesSquareIcon,
  notificationSettings: BellRingIcon,
  notifications: BellIcon,
  security: ShieldIcon,
  signatures: PenLineIcon,
  tags: TagIcon,
  webhooks: WebhookIcon,
};

export const itemClass =
  "flex h-8.5 items-center gap-2.5 rounded-md px-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";

/**
 * The mode switch, in the bottom bar beside the account: the open mode's
 * name, and **Switch**, shown while the row is hovered or focused, whose
 * menu offers both modes with what each is for. A mode the member may
 * open no page of is shown disabled, saying why.
 */
export const ModeSwitch = ({
  link: LinkTo,
  mode,
  modes,
  onNavigate,
}: {
  readonly link: LinkComponent;
  readonly mode: Mode;
  readonly modes: Navigation["modes"];
  readonly onNavigate?: () => void;
}) => {
  const t = useTranslations("WorkspaceShell");

  return (
    <div className="group/mode flex h-8 min-w-0 flex-1 items-center gap-2 pl-1">
      <span className="min-w-0 truncate text-sm font-medium">
        {t(`modes.${mode}`)}
      </span>
      <DropdownMenu>
        <span className="opacity-0 transition-opacity group-hover/mode:opacity-100 has-[:focus-visible]:opacity-100 has-[[aria-expanded=true]]:opacity-100">
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="xs"
                aria-label={t("modes.switchLabel")}
              />
            }
          >
            {t("modes.switch")}
          </DropdownMenuTrigger>
        </span>
        <DropdownMenuContent side="right" align="end" className="w-80">
          <DropdownMenuGroup>
            {(["studio", "api"] as const).map((each) => {
              const href = modes[each];

              const content = (
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{t(`modes.${each}`)}</span>
                  <span className="text-muted-foreground text-xs">
                    {href === null
                      ? t("modes.unavailable")
                      : t(`modes.${each}Description`)}
                  </span>
                </span>
              );

              return href === null ? (
                <DropdownMenuItem key={each} disabled>
                  {content}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  key={each}
                  render={
                    <LinkTo
                      href={href}
                      {...(each === mode
                        ? { "aria-current": "page" as const }
                        : {})}
                      {...(onNavigate === undefined
                        ? {}
                        : { onClick: onNavigate })}
                    >
                      {content}
                    </LinkTo>
                  }
                />
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const NavLink = ({
  label,
  link: LinkTo,
  onNavigate,
  target,
}: {
  readonly label: string;
  readonly link: LinkComponent;
  readonly onNavigate?: () => void;
  readonly target: Link;
}) => {
  const Icon = pageIcons[target.page];

  return (
    <LinkTo
      href={target.href}
      className={itemClass}
      {...(target.current ? { "aria-current": "page" as const } : {})}
      {...(onNavigate === undefined ? {} : { onClick: onNavigate })}
    >
      <Icon aria-hidden />
      <span className="flex-1 truncate">{label}</span>
      {target.opens === null ? null : (
        <ChevronRightIcon aria-hidden className="text-muted-foreground" />
      )}
    </LinkTo>
  );
};

// The workspace switcher's button, which the menu's trigger renders with its
// own props and ref.
const SwitcherButton = ({ className, ...props }: ComponentProps<"button">) => (
  <button
    type="button"
    className={cn(
      "hover:bg-sidebar-accent flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left",
      className
    )}
    {...props}
  />
);

/**
 * The workspace's sidebar (DESIGN.md, "The frame"): its head (the
 * workspace switcher, then `tools`: Search and New post), the mode switch
 * with Peal's mark, the mode's pages in groups, or the open section's
 * pages under a way back, and Settings at its foot.
 */
export const SidebarView = ({
  className,
  link,
  navigation,
  onChooseWorkspace,
  onNavigate,
  tools = null,
  workspaceId,
  workspaces,
}: {
  readonly className?: string;
  readonly link: LinkComponent;
  readonly navigation: Navigation;
  /** Called with the workspace the switcher opens, as it opens. */
  readonly onChooseWorkspace?: (workspaceId: string) => void;
  /** Called when a link is followed, to close the sidebar on a phone. */
  readonly onNavigate?: () => void;
  /** The head's icon buttons, after the workspace switcher. */
  readonly tools?: ReactNode;
  readonly workspaceId: string;
  readonly workspaces: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }[];
}) => {
  const closeMenu = useCloseMenu();
  const navigated = onNavigate ?? closeMenu;
  const t = useTranslations("WorkspaceShell");
  // Back closes the section on the page it was chosen on; following a link
  // that opens a section, or moving to another page, opens it again.
  const [closedOn, setClosedOn] = useState<Page | null>(null);

  const section =
    navigation.section !== null && closedOn !== navigation.current
      ? navigation.section
      : null;

  const followed = (target: Link) => () => {
    if (target.opens !== null) {
      setClosedOn(null);
    }

    navigated();
  };

  const LinkTo = link;
  const current = workspaces.find(({ id }) => id === workspaceId);
  const others = workspaces.filter(({ id }) => id !== workspaceId);

  // One name per page (DESIGN.md, "The frame"): the sidebar's is the
  // header's.
  const labelOf = (target: Link): string => t(`pages.${target.page}`);

  return (
    <div
      className={cn(
        "bg-sidebar text-sidebar-foreground flex h-full w-60 flex-col",
        className
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-1 px-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SwitcherButton aria-label={t("workspaces.label")} />}
          >
            <span className="bg-brand-tint text-brand-text flex size-5 shrink-0 items-center justify-center rounded-sm text-xs font-semibold">
              {(current?.name ?? "?").slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 truncate text-sm font-medium">
              {current?.name ?? ""}
            </span>
            <ChevronDownIcon
              aria-hidden
              className="text-muted-foreground size-3.5 shrink-0"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="bottom" className="w-56">
            {others.length === 0 ? null : (
              <>
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    {t("workspaces.switch")}
                  </DropdownMenuLabel>
                  {others.map(({ id, name, slug }) => (
                    <DropdownMenuItem
                      key={id}
                      render={
                        <LinkTo
                          href={workspacePath(slug)}
                          onClick={() => {
                            onChooseWorkspace?.(id);
                            navigated();
                          }}
                        >
                          {name}
                        </LinkTo>
                      }
                    />
                  ))}
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem
              render={
                <LinkTo href={createWorkspacePath} onClick={navigated}>
                  {t("workspaces.create")}
                </LinkTo>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="flex shrink-0 items-center">{tools}</div>
      </div>

      <nav
        aria-label={t("label")}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-3"
      >
        {section === null ? (
          navigation.groups.map(({ group, links }) => (
            <div key={group ?? "main"} className="flex flex-col gap-px">
              {group === null ? null : (
                <p className="text-muted-foreground px-2.5 pb-1.5 text-xs">
                  {t(`groups.${group}`)}
                </p>
              )}
              {links.map((target) => (
                <NavLink
                  key={target.page}
                  label={labelOf(target)}
                  link={link}
                  target={target}
                  onNavigate={followed(target)}
                />
              ))}
            </div>
          ))
        ) : (
          <div className="flex flex-col gap-px">
            <button
              type="button"
              aria-label={t("back", { section: t(`sections.${section}`) })}
              onClick={() => {
                setClosedOn(navigation.current);
              }}
              className="text-muted-foreground hover:text-foreground mb-1 flex h-7 items-center gap-1.5 px-2 text-sm [&_svg]:size-3.5"
            >
              <ChevronLeftIcon aria-hidden />
              {t(`sections.${section}`)}
            </button>
            {navigation.sectionLinks.map((target) => (
              <NavLink
                key={target.page}
                label={labelOf(target)}
                link={link}
                target={target}
                onNavigate={followed(target)}
              />
            ))}
          </div>
        )}
      </nav>

      <div className="px-2.5 pb-2">
        <LinkTo
          href={navigation.settings.href}
          className={itemClass}
          {...(navigation.settings.current
            ? { "aria-current": "page" as const }
            : {})}
          onClick={followed(navigation.settings)}
        >
          <SlidersHorizontalIcon aria-hidden />
          <span className="flex-1">{t("sections.settings")}</span>
          <ChevronRightIcon aria-hidden className="text-muted-foreground" />
        </LinkTo>
      </div>
    </div>
  );
};
