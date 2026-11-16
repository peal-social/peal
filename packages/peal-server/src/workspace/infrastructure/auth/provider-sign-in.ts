import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";
import { Option, Schema } from "effect";

import { LocaleSchema } from "#shared/domain/locale.ts";

// What `/sign-in/social` takes that would let a client steer the sign-in:
// a token it obtained itself instead of the code exchange Peal makes,
// scopes and parameters Peal never asks the provider for, and an account
// to preselect at the provider.
const refusedFields = [
  "idToken",
  "scopes",
  "additionalParams",
  "loginHint",
] as const;

// What the sign-up page keeps in the sign-in's state, and nothing else:
// the invitation it was opened from, and its language for the new account.
const AdditionalDataSchema = Schema.Struct({
  invitation: Schema.optionalKey(
    Schema.String.check(
      Schema.isPattern(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u
      )
    )
  ),
  locale: Schema.optionalKey(LocaleSchema),
});

const decodeAdditionalData = Schema.decodeUnknownOption(AdditionalDataSchema, {
  onExcessProperty: "error",
});

// The body as JSON gave it, every key kept whatever its value: the route's
// own schema drops keys it does not know, so a decode of the fields Peal
// reads could fail on one of those and refuse nothing.
const BodySchema = Schema.Record(Schema.String, Schema.Json);

const decodeBody = Schema.decodeUnknownOption(BodySchema);

/** What a client sent as a start's body, before anything reads it. */
export type StartBody = Parameters<typeof decodeBody>[0];

/** A start's body: its keys and their values, as sent. */
export type SignInStart = typeof BodySchema.Type;

/**
 * The fields of a start's body Peal refuses, in the order checked: each
 * refused field present at all, whatever its value, and state that is not
 * exactly what the sign-up page keeps.
 */
export const refusedProviderFields = (
  start: SignInStart
): readonly string[] => {
  const refused: string[] = refusedFields.filter((field) =>
    Object.hasOwn(start, field)
  );

  if (
    Object.hasOwn(start, "additionalData") &&
    Option.isNone(decodeAdditionalData(start["additionalData"]))
  ) {
    refused.push("additionalData");
  }

  return refused;
};

/** What a start refuses: `body` for one that is not a JSON object. */
export const refusedStart = (body: StartBody): readonly string[] =>
  Option.match(decodeBody(body), {
    onNone: () => ["body"],
    onSome: refusedProviderFields,
  });

/** The code a sign-in with a refused field answers with. */
export const providerFieldCode = "PROVIDER_SIGN_IN_FIELD_NOT_ALLOWED";

/**
 * Refuses with 400 `PROVIDER_SIGN_IN_FIELD_NOT_ALLOWED` a provider's
 * sign-in that asks for more than Peal's pages do: Peal exchanges the code
 * itself, for the scopes it set, and keeps in the state only what it reads.
 */
export const guardProviderSignIn = (ctx: GenericEndpointContext): void => {
  if (ctx.path !== "/sign-in/social") {
    return;
  }

  // A body that is no JSON object is refused here too: nothing fails open.
  const refused = refusedStart(ctx.body);

  if (refused.length > 0) {
    throw APIError.from("BAD_REQUEST", {
      code: providerFieldCode,
      message: `A sign-in with a provider takes no ${refused.join(", ")}`,
    });
  }
};
