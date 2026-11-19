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
 * A workspace's slug is set when it is made and never changes after, so
 * the links to its pages keep working: an update that names one is
 * refused, whatever it names.
 */
export const keepSlug = async (data: {
  readonly slug?: string | undefined;
}): Promise<void> => {
  if (data.slug !== undefined) {
    throw APIError.from("BAD_REQUEST", {
      code: "WORKSPACE_SLUG_FIXED",
      message: "A workspace's slug is set when it is made and never changes",
    });
  }

  await Promise.resolve();
};
