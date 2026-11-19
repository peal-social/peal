import { Effect, Option } from "effect";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "peal-ui/components/button";
import { Suspense } from "react";

import { currentUserOrNone } from "#auth/session.ts";
import { standingOfWorkspace } from "#billing/standing.ts";
import { contactUrlConfig, termsUrlConfig } from "#billing/terms.ts";
import { AccountMenu } from "#components/account-menu.tsx";
import { PlainFrame } from "#components/app-shell.tsx";
import { PlanGate } from "#components/billing/plan-gate.tsx";
import { UpgradePrompts } from "#components/billing/upgrade-prompts.tsx";
import { ContractLinks } from "#components/contract/contract-links.tsx";
import { WorkspaceShell } from "#components/shell/workspace-shell.tsx";
import { TwoStepRefusalWatch } from "#components/two-step/refusal-watch.tsx";
import { TwoStepRequiredNotice } from "#components/two-step/required-notice.tsx";
import { Link } from "#i18n/navigation.ts";
import { docsUrlConfig } from "#shell/docs-url.ts";
import { workspaceAt } from "#shell/workspace-path.ts";

// Around every page of a workspace: its frame (the sidebar, the panel's
// header, the bottom bar and the contract functions at the foot), the notice a member whose account lacks
// the two-step verification the workspace requires sees instead of any of
// it, the upgrade dialog, which opens where the plan refuses something, and
// the gate that shows the over-plan screen instead of the page while the
// workspace holds more than its plan allows.
// Each page still reads the user and decides what it shows; someone who is
// not a member gets the page's own answer, in the app's plain frame.
// `workspaceId` is the address's segment: the workspace's slug, or its id
// in an older link (`workspaceAt`).
// Each page's title is followed by the workspace's name: "Analytics ·
// Client A", so tabs of several workspaces tell apart.
export const generateMetadata = async ({
  params,
}: LayoutProps<"/[locale]/[workspaceId]">): Promise<Metadata> => {
  const { workspaceId: segment } = await params;
  const me = await currentUserOrNone();

  return me.pipe(
    Option.flatMapNullishOr(({ workspaces }) =>
      workspaceAt(workspaces, segment)
    ),
    Option.match({
      onNone: () => ({}),
      onSome: ({ name }) => ({
        title: { default: name, template: `%s · ${name}` },
      }),
    })
  );
};

const WorkspaceLayout = async ({
  children,
  params,
}: LayoutProps<"/[locale]/[workspaceId]">) => {
  const { workspaceId: segment } = await params;
  const me = await currentUserOrNone();

  const workspace = me.pipe(
    Option.flatMapNullishOr(({ workspaces }) =>
      workspaceAt(workspaces, segment)
    )
  );

  if (Option.isNone(me) || Option.isNone(workspace)) {
    return <PlainFrame>{await children}</PlainFrame>;
  }

  if (workspace.value.twoStepRequired && !me.value.user.twoStepEnabled) {
    const t = await getTranslations("TwoStep");

    return (
      <PlainFrame>
        <TwoStepRequiredNotice
          action={
            <Link href="/account" className={buttonVariants()}>
              {t("goToAccount")}
            </Link>
          }
        />
      </PlainFrame>
    );
  }

  const { id: workspaceId, slug } = workspace.value;

  const [standing, termsUrl, contactUrl, docsUrl] = await Promise.all([
    standingOfWorkspace(workspaceId),
    Effect.runPromise(termsUrlConfig),
    Effect.runPromise(contactUrlConfig),
    Effect.runPromise(docsUrlConfig),
  ]);

  return (
    <WorkspaceShell
      actions={
        <Suspense fallback={null}>
          <AccountMenu />
        </Suspense>
      }
      docsUrl={docsUrl}
      footer={
        <Suspense fallback={null}>
          <ContractLinks />
        </Suspense>
      }
      permissions={workspace.value.permissions}
      supportUrl={contactUrl}
      workspaceId={workspaceId}
      workspaceSlug={slug}
      workspaces={me.value.workspaces.map(({ id, name, slug: other }) => ({
        id,
        name,
        slug: other,
      }))}
    >
      <UpgradePrompts current={workspaceId}>
        <TwoStepRefusalWatch />
        <PlanGate
          contactUrl={contactUrl}
          self={me.value.user.id}
          standing={Option.getOrNull(standing)}
          termsUrl={termsUrl}
          workspace={{
            canManage: workspace.value.permissions.includes("billing:manage"),
            id: workspace.value.id,
            name: workspace.value.name,
          }}
        >
          {children}
        </PlanGate>
      </UpgradePrompts>
    </WorkspaceShell>
  );
};

export default WorkspaceLayout;
