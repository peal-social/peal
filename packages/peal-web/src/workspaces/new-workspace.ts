import { Schema } from "effect";
import {
  isWorkspaceSlug,
  workspaceSlugOf,
  workspaceSlugWordsOf,
} from "peal-contract/workspace-slug";

/**
 * The slugs a new workspace of this name tries, in turn: its words alone
 * (`/acme-studio`) when they make a slug the server takes, then its
 * words and `tail` (a few random letters and digits), for a name another
 * workspace holds or a reserved word. A slug never changes after.
 */
export const slugsToTry = (name: string, tail: string): readonly string[] => {
  const words = workspaceSlugWordsOf(name);
  const tailed = workspaceSlugOf(name, tail);

  return isWorkspaceSlug(words) && words !== tailed
    ? [words, tailed]
    : [tailed];
};

/** Better Auth's answer when the slug is another workspace's. */
export const slugTaken = (code: string | undefined): boolean =>
  code === "ORGANIZATION_ALREADY_EXISTS" ||
  code === "ORGANIZATION_SLUG_ALREADY_TAKEN";

/**
 * The first word of a person's name, for the workspace made for them
 * ("Maxime’s workspace"); none for a name without one.
 */
export const firstNameOf = (name: string): string | null => {
  const [first = ""] = name.trim().split(/\s+/u);

  return first === "" ? null : first;
};

/**
 * Whether French elides "de" before a word ("Espace d’Alice", "Espace de
 * Maxime"): a vowel, or an h, starts it.
 */
export const elidesBefore = (word: string): boolean =>
  /^[aeiouyhàâäéèêëîïôöùûüÿæœ]/iu.test(word.normalize("NFC"));

// An invitation as Better Auth's list of the person's answers it, its end
// as a date or as the text of one.
const InvitationsSchema = Schema.Array(
  Schema.Struct({
    expiresAt: Schema.Union([Schema.Date, Schema.DateFromString]),
    id: Schema.String,
    status: Schema.String,
  })
);

export type Invitations = typeof InvitationsSchema.Type;

/** Better Auth's list of the person's invitations, read: none when malformed. */
export const decodeInvitations = Schema.decodeUnknownOption(InvitationsSchema);

/**
 * The first invitation still open among those Better Auth lists for the
 * person (pending, not expired at `now`): someone invited joins that
 * workspace rather than get one of their own.
 */
export const openInvitationOf = (
  invitations: Invitations,
  now: Date
): string | null =>
  invitations.find(
    ({ expiresAt, status }) =>
      status === "pending" && expiresAt.getTime() > now.getTime()
  )?.id ?? null;
