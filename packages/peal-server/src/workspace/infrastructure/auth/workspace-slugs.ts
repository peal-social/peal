import type {
  DBAdapter,
  DBTransactionAdapter,
} from "@better-auth/core/db/adapter";
import { APIError } from "better-auth/api";
import { Schema } from "effect";
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

// Postgres's refusal of a second workspace with a slug (a unique
// violation on the organization's slug), as node-postgres reports it,
// under Drizzle's error or on its own.
const SlugConstraintSchema = Schema.Struct({
  code: Schema.Literal("23505"),
  constraint: Schema.Literal("organization_slug_key"),
});

const isSlugConstraint = Schema.is(SlugConstraintSchema);

const CausedSchema = Schema.Struct({ cause: Schema.Unknown });

const isCaused = Schema.is(CausedSchema);

const slugTaken = () =>
  APIError.from("BAD_REQUEST", {
    code: "ORGANIZATION_SLUG_ALREADY_TAKEN",
    message: "Organization slug already taken",
  });

const refusingTakenSlugs = async <A>(
  model: string,
  write: () => Promise<A>
): Promise<A> => {
  try {
    return await write();
  } catch (error) {
    const heldElsewhere =
      isSlugConstraint(error) ||
      (isCaused(error) && isSlugConstraint(error.cause));

    throw model === "organization" && heldElsewhere ? slugTaken() : error;
  }
};

const writesRefusingTakenSlugs = <T extends DBTransactionAdapter>(
  adapter: T
): T => ({
  ...adapter,
  create: async (data) =>
    await refusingTakenSlugs(
      data.model,
      async () => await adapter.create(data)
    ),
  update: async (data) =>
    await refusingTakenSlugs(
      data.model,
      async () => await adapter.update(data)
    ),
  updateMany: async (data) =>
    await refusingTakenSlugs(
      data.model,
      async () => await adapter.updateMany(data)
    ),
});

/**
 * Better Auth checks that no workspace holds a slug, then writes it: two
 * people making, or moving to, the same slug at once both pass the check,
 * and the database refuses the second write. That refusal answers as the
 * check does, 400 `ORGANIZATION_SLUG_ALREADY_TAKEN`, never 500. The
 * workspace's row is the route's first write, so nothing of the refused
 * one is left: no member, no active workspace, no billing account.
 */
export const refuseTakenSlugs = (adapter: DBAdapter): DBAdapter => ({
  ...writesRefusingTakenSlugs(adapter),
  transaction: async (run) =>
    await adapter.transaction(
      async (trx) => await run(writesRefusingTakenSlugs(trx))
    ),
});
