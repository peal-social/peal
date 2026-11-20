import { Schema } from "effect";
import {
  isWorkspaceSlug,
  workspaceSlugOf,
  workspaceSlugWordsOf,
} from "peal-contract/workspace-slug";

/**
 * The address a new workspace of this name is offered, which the person
 * may replace: its words alone (`maple-studio`), or, once `tail` is given
 * (a few random letters and digits, for words another workspace holds or
 * a reserved word), the words and the tail.
 */
export const suggestedSlugOf = (name: string, tail: string | null): string => {
  const words = workspaceSlugWordsOf(name);

  return tail === null && (words === "" || isWorkspaceSlug(words))
    ? words
    : workspaceSlugOf(name, tail ?? "");
};

/** Whether a new workspace's address can be taken, as far as is known. */
export type SlugAvailability =
  | "checking"
  | "free"
  | "invalid"
  | "taken"
  | "unknown";

/**
 * What the form says of `slug`: `invalid` before asking, else the answer
 * the server gave for that very slug (`checked`), `checking` while the
 * last answer is another slug's.
 */
export const slugAvailabilityOf = (
  slug: string,
  checked: { readonly answer: SlugAvailability; readonly slug: string } | null
): SlugAvailability => {
  if (!isWorkspaceSlug(slug)) {
    return "invalid";
  }

  return checked?.slug === slug ? checked.answer : "checking";
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
