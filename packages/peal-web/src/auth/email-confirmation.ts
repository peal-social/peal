import { Option, Schema } from "effect";

// What the server's `/api/auth/confirm-email` answers it did with the
// emailed token (peal-server's email-confirmation.ts): the confirmation
// page posts it, so opening the link confirms nothing on its own.
const OutcomeSchema = Schema.Struct({
  status: Schema.Literals([
    "alreadyConfirmed",
    "inUse",
    "passwordNeeded",
    "replaced",
    "signedIn",
  ]),
});

const ErrorSchema = Schema.Struct({
  code: Schema.Literals(["INVALID_TOKEN", "TOKEN_EXPIRED"]),
});

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
