"use client";

import { useTranslations } from "next-intl";
import type { Permission } from "peal-contract";
import type { ReactNode } from "react";

import { chooseWorkspace } from "#auth/choose-workspace.ts";
import { CommandMenu } from "#components/shell/command-menu.tsx";
import { CommandScopeProvider } from "#components/shell/command-scope.tsx";
import { FrameView } from "#components/shell/frame-view.tsx";
import { ModeSwitch, SidebarView } from "#components/shell/sidebar-view.tsx";
import type { LinkComponent } from "#components/shell/sidebar-view.tsx";
import { Link, usePathname } from "#i18n/navigation.ts";
import { navigationOf } from "#shell/navigation.ts";

export const AppLink: LinkComponent = ({ children, ...props }) => (
  <Link {...props}>{children}</Link>
);

/**
 * The frame of a workspace's pages: its sidebar (PealStudio and PealAPI), the
 * panel's header naming the open page, the bottom bar, and the page's foot.
 */
export const WorkspaceShell = ({
  actions,
  children,
  docsUrl,
  footer,
  permissions,
  supportUrl,
  workspaceId,
  workspaceSlug,
  workspaces,
}: {
  readonly actions: ReactNode;
  readonly children: ReactNode;
  readonly docsUrl: string | null;
  /** What every page ends with: the contract functions. */
  readonly footer: ReactNode;
  readonly permissions: readonly Permission[];
  readonly supportUrl: string | null;
  readonly workspaceId: string;
  /** The workspace's slug, which its addresses hold. */
  readonly workspaceSlug: string;
  readonly workspaces: readonly {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  }[];
}) => {
  const t = useTranslations("WorkspaceShell");
  const pathname = usePathname();

  const navigation = navigationOf({
    pathname,
    permissions,
    workspace: workspaceSlug,
  });

  const { page, section } = navigation.breadcrumb;

  return (
    <CommandScopeProvider>
      <FrameView
        actions={
          <>
            {actions}
            <ModeSwitch
              link={AppLink}
              mode={navigation.mode}
              modes={navigation.modes}
            />
          </>
        }
        breadcrumb={{
          page: page === null ? null : t(`pages.${page}`),
          section: section === null ? null : t(`sections.${section}`),
        }}
        docsUrl={docsUrl}
        footer={footer}
        label={t("label")}
        split={navigation.split}
        supportUrl={supportUrl}
        sidebar={
          <SidebarView
            link={AppLink}
            navigation={navigation}
            onChooseWorkspace={chooseWorkspace}
            tools={
              <CommandMenu
                docsUrl={docsUrl}
                permissions={permissions}
                supportUrl={supportUrl}
                workspaceId={workspaceId}
                workspaceSlug={workspaceSlug}
                workspaces={workspaces}
              />
            }
            workspaceId={workspaceId}
            workspaces={workspaces}
          />
        }
      >
        {children}
      </FrameView>
    </CommandScopeProvider>
  );
};
