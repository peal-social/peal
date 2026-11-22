"use client";

import { useTranslations } from "next-intl";
import type { Permission } from "peal-contract";
import type { ReactNode } from "react";

import { chooseWorkspace } from "#auth/choose-workspace.ts";
import { AgentDock } from "#components/agent/agent-dock.tsx";
import { AgentPanelProvider } from "#components/agent/agent-panel-context.tsx";
import { AppLink } from "#components/shell/app-link.tsx";
import { CommandMenu } from "#components/shell/command-menu.tsx";
import { CommandScopeProvider } from "#components/shell/command-scope.tsx";
import { crumbLinkClass, FrameView } from "#components/shell/frame-view.tsx";
import { ModeSwitch, SidebarView } from "#components/shell/sidebar-view.tsx";
import { usePathname } from "#i18n/navigation.ts";
import { crumbHrefOf, navigationOf } from "#shell/navigation.ts";
import type { Crumb } from "#shell/navigation.ts";

/**
 * The frame of a workspace's pages: its sidebar (PealCreative and PealAPI), the
 * panel's header naming the open page, the bottom bar with the agent's
 * place and its panel, and the page's foot.
 */
export const WorkspaceShell = ({
  actions,
  children,
  docsUrl,
  footer,
  permissions,
  supportChat = null,
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
  /** The support chat's launcher, where the server names a Crisp website. */
  readonly supportChat?: ReactNode;
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

  const { page, trail } = navigation.breadcrumb;

  // A section is named as the sidebar's foot and its back link name it;
  // any other step by its page's name.
  const crumbName = (crumb: Crumb) =>
    crumb === "posts" || crumb === "settings"
      ? t(`sections.${crumb}`)
      : t(`pages.${crumb}`);

  return (
    <CommandScopeProvider>
      <AgentPanelProvider
        allowed={permissions.includes("assistant:use")}
        workspaceId={workspaceId}
      >
        <FrameView
          agent={<AgentDock permissions={permissions} />}
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
            trail: trail.map((crumb) => ({
              key: crumb,
              link: (
                <AppLink
                  href={crumbHrefOf(workspaceSlug, crumb)}
                  className={crumbLinkClass}
                >
                  {crumbName(crumb)}
                </AppLink>
              ),
            })),
          }}
          docsUrl={docsUrl}
          footer={footer}
          label={t("label")}
          split={navigation.split}
          supportChat={supportChat}
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
      </AgentPanelProvider>
    </CommandScopeProvider>
  );
};
