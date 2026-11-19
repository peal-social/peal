"use client";

import type { LucideIcon } from "lucide-react";
import {
  BellIcon,
  CalendarRangeIcon,
  ChartNoAxesColumnIcon,
  PlusIcon,
  UserIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "peal-ui/lib/utils";
import type { ReactNode } from "react";

import { chooseWorkspace } from "#auth/choose-workspace.ts";
import { FrameView, useCloseMenu } from "#components/shell/frame-view.tsx";
import { PealMark } from "#components/shell/peal-mark.tsx";
import { itemClass } from "#components/shell/sidebar-view.tsx";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";
import { AppLink } from "#components/shell/workspace-shell.tsx";
import { usePathname } from "#i18n/navigation.ts";
import {
  personalHrefOf,
  personalPageAt,
  personalPages,
} from "#shell/personal.ts";
import type { PersonalPage } from "#shell/personal.ts";
import { workspacePath } from "#shell/workspace-path.ts";

const icons: Readonly<Record<PersonalPage, LucideIcon>> = {
  account: UserIcon,
  agenda: CalendarRangeIcon,
  newWorkspace: PlusIcon,
  notices: BellIcon,
  report: ChartNoAxesColumnIcon,
};

/**
 * The sidebar of the person's own pages: Peal's mark, their pages across
 * workspaces, then each workspace.
 */
export const PersonalSidebarView = ({
  className,
  current,
  link: LinkTo,
  onChooseWorkspace,
  onNavigate,
  workspaces,
}: {
  readonly className?: string;
  readonly current: PersonalPage | null;
  readonly link: LinkComponent;
  /** Called with the workspace a link opens, as it opens. */
  readonly onChooseWorkspace?: (workspaceId: string) => void;
  readonly onNavigate?: () => void;
  readonly workspaces: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }[];
}) => {
  const t = useTranslations("PersonalShell");
  const shell = useTranslations("WorkspaceShell");
  const closeMenu = useCloseMenu();
  const followed = { onClick: onNavigate ?? closeMenu };

  return (
    <div
      className={cn(
        "bg-sidebar text-sidebar-foreground flex h-full w-60 flex-col",
        className
      )}
    >
      <div className="flex h-12 shrink-0 items-center gap-2.5 px-4">
        <span className="bg-card ring-border flex size-7 items-center justify-center rounded-md shadow-xs ring-1">
          <PealMark className="size-4.5" />
        </span>
        <span className="font-semibold tracking-tight">
          {shell("productName")}
        </span>
      </div>
      <nav
        aria-label={t("label")}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-2.5 py-3"
      >
        <div className="flex flex-col gap-px">
          {personalPages.map((page) => {
            const Icon = icons[page];

            return (
              <LinkTo
                key={page}
                href={personalHrefOf(page)}
                className={itemClass}
                {...(page === current
                  ? { "aria-current": "page" as const }
                  : {})}
                {...followed}
              >
                <Icon aria-hidden />
                <span className="flex-1 truncate">{t(`pages.${page}`)}</span>
              </LinkTo>
            );
          })}
        </div>
        <div className="flex flex-col gap-px">
          {workspaces.length === 0 ? null : (
            <p className="text-muted-foreground px-2.5 pb-1.5 text-xs">
              {t("workspaces")}
            </p>
          )}
          {workspaces.map(({ id, name, slug }) => (
            <LinkTo
              key={id}
              href={workspacePath(slug)}
              className={itemClass}
              onClick={() => {
                onChooseWorkspace?.(id);
                followed.onClick();
              }}
            >
              <span
                aria-hidden
                className="bg-brand-tint text-brand-text flex size-5 shrink-0 items-center justify-center rounded-sm text-xs font-semibold"
              >
                {name.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex-1 truncate">{name}</span>
            </LinkTo>
          ))}
          <LinkTo
            href={personalHrefOf("newWorkspace")}
            className={itemClass}
            {...(current === "newWorkspace"
              ? { "aria-current": "page" as const }
              : {})}
            {...followed}
          >
            <PlusIcon aria-hidden />
            <span className="flex-1 truncate">{t("pages.newWorkspace")}</span>
          </LinkTo>
        </div>
      </nav>
    </div>
  );
};

/**
 * The frame of the person's own pages (the agenda, the report, the
 * notices, the account, a new workspace): their sidebar, the panel's header,
 * the bottom bar, and the page's foot.
 */
export const PersonalShell = ({
  actions,
  children,
  docsUrl,
  footer,
  supportUrl,
  workspaces,
}: {
  readonly actions: ReactNode;
  readonly children: ReactNode;
  readonly docsUrl: string | null;
  readonly footer: ReactNode;
  readonly supportUrl: string | null;
  readonly workspaces: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }[];
}) => {
  const t = useTranslations("PersonalShell");
  const current = personalPageAt(usePathname());

  return (
    <FrameView
      actions={actions}
      breadcrumb={{
        page: current === null ? null : t(`pages.${current}`),
        section: null,
      }}
      docsUrl={docsUrl}
      footer={footer}
      label={t("label")}
      supportUrl={supportUrl}
      sidebar={
        <PersonalSidebarView
          current={current}
          link={AppLink}
          onChooseWorkspace={chooseWorkspace}
          workspaces={workspaces}
        />
      }
    >
      {children}
    </FrameView>
  );
};
