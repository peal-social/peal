import { Option } from "effect";
import type { Locale } from "next-intl";
import { notFound } from "next/navigation";
import type { Membership } from "peal-contract";

import { currentUser } from "#auth/session.ts";
import { redirect } from "#i18n/navigation.ts";
import { workspaceAt } from "#shell/workspace-path.ts";

/** A signed-in user in one of their workspaces. */
export interface Viewer {
  readonly membership: Membership;
  readonly userId: string;
}

/**
 * For the workspace's pages: the signed-in user, and their membership of
 * the workspace the address names (`workspace`: its slug, or its id in an
 * older link). Anyone signed out is sent to sign in, and a workspace they
 * do not belong to is not found. Pages call the API with the
 * membership's `id`, never the address's segment.
 */
export const viewerOf = async (
  locale: Locale,
  workspace: string
): Promise<Viewer> => {
  const me = await currentUser();

  if (Option.isNone(me)) {
    return redirect({ href: "/login", locale });
  }

  const membership = workspaceAt(me.value.workspaces, workspace);

  if (membership === undefined) {
    notFound();
  }

  return { membership, userId: me.value.user.id };
};

/** The signed-in user's membership of the workspace (see `viewerOf`). */
export const membershipOf = async (
  locale: Locale,
  workspace: string
): Promise<Membership> => {
  const { membership } = await viewerOf(locale, workspace);

  return membership;
};
