import { Option } from "effect";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { SettingsCard, SettingsCardBody } from "peal-ui/components/settings";

import { currentUser } from "#auth/session.ts";
import {
  InviteForm,
  PendingInvitations,
} from "#components/settings/invitations.tsx";
import { MembersList } from "#components/settings/members-list.tsx";
import { SettingsGroup } from "#components/settings/settings-group.tsx";
import { redirect } from "#i18n/navigation.ts";
import { routing } from "#i18n/routing.ts";
import { assignableRoles } from "#settings/member-rules.ts";
import { workspacePageTitle } from "#shell/page-title.ts";
import { workspaceAt } from "#shell/workspace-path.ts";

// A workspace's people: to members who may invite, the way to invite
// someone first; then the members, whom everyone sees and owners and
// admins manage, as Better Auth's organization routes allow; then the
// invitations still waiting for an answer.
const MembersPage = async ({
  params,
}: PageProps<"/[locale]/[workspaceId]/settings/members">) => {
  const { locale, workspaceId } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/login", locale });
  }

  const workspace = workspaceAt(me.value.workspaces, workspaceId);

  if (workspace === undefined) {
    notFound();
  }

  const invitations = await getTranslations("WorkspaceSettings.invitations");
  const may = new Set(workspace.permissions);
  const mayInvite = may.has("invitation:create");

  return (
    <>
      {mayInvite ? (
        <SettingsGroup
          title={invitations("title")}
          description={invitations("description")}
        >
          <SettingsCard>
            <SettingsCardBody>
              <InviteForm
                workspaceId={workspace.id}
                roles={assignableRoles({ role: workspace.role, userId: "" })}
              />
            </SettingsCardBody>
          </SettingsCard>
        </SettingsGroup>
      ) : null}
      <MembersList
        workspaceId={workspace.id}
        manager={{
          mayRemove: may.has("member:delete"),
          mayUpdate: may.has("member:update"),
          role: workspace.role,
          userId: me.value.user.id,
        }}
      />
      {mayInvite ? (
        <PendingInvitations
          workspaceId={workspace.id}
          mayCancel={may.has("invitation:cancel")}
          mayResend={mayInvite}
        />
      ) : null}
    </>
  );
};

export const generateMetadata = workspacePageTitle("members");

export default MembersPage;
