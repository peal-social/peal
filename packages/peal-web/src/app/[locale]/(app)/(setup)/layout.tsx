import { Effect, Option } from "effect";
import { headers } from "next/headers";

import { activeWorkspaceOf } from "#auth/active-workspace.ts";
import { currentUserOrNone } from "#auth/session.ts";
import { PlainFrame } from "#components/app-shell.tsx";
import { SetupFrame } from "#components/setup/setup-frame.tsx";
import { homeWorkspaceOf, workspacePath } from "#shell/workspace-path.ts";

// Around the setup page, at `/` and `/create`: its own frame, without the
// app's sidebar or bottom bar, with the way back to the workspace `/`
// would open, when the person has one. Someone signed out gets the app's
// plain frame, and the page sends them to sign in.
const SetupLayout = async ({ children }: LayoutProps<"/[locale]">) => {
  const me = await currentUserOrNone();

  if (Option.isNone(me)) {
    return <PlainFrame>{children}</PlainFrame>;
  }

  const { user, workspaces } = me.value;
  const incoming = await headers();

  const active =
    workspaces.length > 1
      ? Option.getOrNull(
          await Effect.runPromise(
            activeWorkspaceOf(incoming.get("cookie") ?? "")
          )
        )
      : null;

  const home = homeWorkspaceOf(workspaces, active);

  return (
    <SetupFrame
      back={home === undefined ? null : workspacePath(home.slug)}
      email={user.email}
    >
      {children}
    </SetupFrame>
  );
};

export default SetupLayout;
