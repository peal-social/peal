import type { Actor, Permission } from "#shared/domain/access.ts";

/**
 * Which of the overview's sections a credential may read in a workspace:
 * each the permission its own page checks. Where the permission is missing
 * the section is not read at all, which is not the same as nothing to
 * show. The standing against the plan is told to every member, as the
 * billing page's standing is.
 */
export interface OverviewSections {
  readonly channels: boolean;
  readonly inbox: boolean;
  readonly mayApprove: boolean;
  readonly posts: boolean;
}

/** The sections these permissions read, as a page of each checks them. */
export const sectionsHeld = (
  permissions: readonly Permission[]
): OverviewSections => ({
  channels: permissions.includes("channel:read"),
  inbox: permissions.includes("engagement:read"),
  mayApprove: permissions.includes("post:approve"),
  posts: permissions.includes("post:read"),
});

export const sectionsFor = (actor: Actor): OverviewSections =>
  sectionsHeld(actor.permissions);
