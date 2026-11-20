import { APIError } from "better-auth/api";
import { isWorkspaceSlug } from "peal-contract/workspace-slug";

/**
 * A workspace is made only with a slug the web app can route
 * (`isWorkspaceSlug`): lower-case words, never one of the person's own
 * pages or another page of the web app, never shaped as an id.
 */
export const checkNewSlug = async (slug: string | undefined): Promise<void> => {
  if (slug === undefined || !isWorkspaceSlug(slug)) {
    throw APIError.from("BAD_REQUEST", {
      code: "INVALID_WORKSPACE_SLUG",
      message:
        "A workspace's slug is lower-case letters and digits in words joined by hyphens, at most 48 characters, and not a reserved word",
    });
  }

  await Promise.resolve();
};

/**
 * A workspace's slug may change, to one the web app can route, as when it
 * is made: an update that names none keeps it. Better Auth's route has
 * checked that no other workspace holds it, and that the member may update
 * the workspace. The server's own links name the workspace by its id, so
 * they keep working.
 */
export const checkChangedSlug = async (data: {
  readonly slug?: string | undefined;
}): Promise<void> => {
  if (data.slug !== undefined) {
    await checkNewSlug(data.slug);
  }
};
