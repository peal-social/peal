import { Option, Schema } from "effect";

// What the server's `/api/auth/confirm-email` answers it did with the
// emailed token (peal-server's email-confirmation.ts): the confirmation
// page posts it, so opening the link confirms nothing on its own.
const OutcomeSchema = Schema.Struct({
  status: Schema.Literals([
    "alreadyConfirmed",
    "choose",
    "inUse",
    "notErased",
    "passwordNeeded",
    "replaced",
    "signedIn",
  ]),
});

const ErrorSchema = Schema.Struct({
  code: Schema.Literals(["INVALID_TOKEN", "TOKEN_EXPIRED"]),
});

/**
 * Why the page posts: on its own as it opens (`auto`, which confirms only
 * from the browser that made the account), the person's press of its
 * button (`confirm`), or their explicit word that the account is not
 * theirs and may be deleted (`erase`).
 */
export type ConfirmationIntent = "auto" | "confirm" | "erase";

/**
 * What the confirmation page shows once the server answered: what it did,
 * a link that no longer works (`expired`, `invalid`), or a failure to try
 * again (`failed`).
 */
export type ConfirmationResult =
  | typeof OutcomeSchema.Type.status
  | "expired"
  | "failed"
  | "invalid";

const decodeOutcome = Schema.decodeUnknownOption(OutcomeSchema);

const decodeError = Schema.decodeUnknownOption(ErrorSchema);

/** The result of the route's answer, as Better Auth's client reports it. */
export const confirmationResultOf = (answer: {
  readonly data: unknown;
  readonly error: unknown;
}): ConfirmationResult =>
  answer.error === null
    ? Option.match(decodeOutcome(answer.data), {
        onNone: (): ConfirmationResult => "failed",
        onSome: ({ status }) => status,
      })
    : Option.match(decodeError(answer.error), {
        onNone: (): ConfirmationResult => "failed",
        onSome: ({ code }) =>
          code === "TOKEN_EXPIRED" ? "expired" : "invalid",
      });
