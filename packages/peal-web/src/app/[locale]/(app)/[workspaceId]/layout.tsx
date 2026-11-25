import { Effect, Option } from "effect";
import type { Metadata } from "next";
import { Suspense } from "react";

import { currentUserOrNone } from "#auth/session.ts";
import { standingOfWorkspace } from "#billing/standing.ts";
import { contactUrlConfig, termsUrlConfig } from "#billing/terms.ts";
import { AccountMenu } from "#components/account-menu.tsx";
import { PlainFrame } from "#components/app-shell.tsx";
import { PlanGate } from "#components/billing/plan-gate.tsx";
import { UpgradePrompts } from "#components/billing/upgrade-prompts.tsx";
import { ContractLinks } from "#components/contract/contract-links.tsx";
import { SupportLauncher } from "#components/shell/support-launcher.tsx";
import { WorkspaceShell } from "#components/shell/workspace-shell.tsx";
import { TwoStepRefusalWatch } from "#components/two-step/refusal-watch.tsx";
import { TwoStepRequiredNotice } from "#components/two-step/required-notice.tsx";
import { TwoStepTurnOnHere } from "#components/two-step/turn-on-here.tsx";
import { accountLanguageOf } from "#i18n/account-language.ts";
import { docsUrlConfig } from "#shell/docs-url.ts";
import { supportChatConfig } from "#shell/support-chat.ts";
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
  const { locale, workspaceId: segment } = await params;
  const me = await currentUserOrNone();

  const workspace = me.pipe(
    Option.flatMapNullishOr(({ workspaces }) =>
      workspaceAt(workspaces, segment)
    )
  );

  // No language switcher for someone whose account's language decides the
  // page (the `(app)` layout).
  const languageSwitcher = Option.isNone(
    me.pipe(Option.flatMap(accountLanguageOf))
  );

  if (Option.isNone(me) || Option.isNone(workspace)) {
    return (
      <PlainFrame languageSwitcher={languageSwitcher}>
        {await children}
      </PlainFrame>
    );
  }

  if (workspace.value.twoStepRequired && !me.value.user.twoStepEnabled) {
    return (
      <PlainFrame languageSwitcher={languageSwitcher}>
        <TwoStepRequiredNotice action={<TwoStepTurnOnHere />} />
      </PlainFrame>
    );
  }

  const { id: workspaceId, slug } = workspace.value;

  const [standing, termsUrl, contactUrl, docsUrl, supportWebsite] =
    await Promise.all([
      standingOfWorkspace(workspaceId),
      Effect.runPromise(termsUrlConfig),
      Effect.runPromise(contactUrlConfig),
      Effect.runPromise(docsUrlConfig),
      Effect.runPromise(supportChatConfig),
    ]);

  const { user } = me.value;

  // The support chat, never while staff act as someone: it would name
  // them as the person they act for.
  const supportChat =
    supportWebsite === null || me.value.impersonatedBy !== null ? null : (
      <SupportLauncher
        locale={locale}
        person={{
          email: user.email,
          // Its signature from the server, which the chat provider
          // verifies; none where the server holds no identity secret.
          emailSignature: me.value.supportChat?.emailSignature,
          name: user.name,
          userId: user.id,
          workspaceId,
        }}
        websiteId={supportWebsite}
      />
    );

  // The upgrade dialog goes around the frame too: the agent's panel, in
  // the bottom bar, offers it as the pages do.
  return (
    <UpgradePrompts current={workspaceId}>
      <WorkspaceShell
        actions={
          <Suspense fallback={null}>
            <AccountMenu
              supportChat={supportChat !== null}
              workspaceSlug={slug}
            />
          </Suspense>
        }
        docsUrl={docsUrl}
        footer={
          <Suspense fallback={null}>
            <ContractLinks />
          </Suspense>
        }
        permissions={workspace.value.permissions}
        supportChat={supportChat}
        supportUrl={contactUrl}
        workspaceId={workspaceId}
        workspaceSlug={slug}
        workspaces={me.value.workspaces.map(({ id, name, slug: other }) => ({
          id,
          name,
          slug: other,
        }))}
      >
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
      </WorkspaceShell>
    </UpgradePrompts>
  );
};

export default WorkspaceLayout;
