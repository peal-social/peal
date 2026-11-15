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

const optionalJson = Schema.optional(Schema.Json);

// The body of `/sign-in/social`, as far as Peal reads it.
const SignInStartSchema = Schema.Struct({
  additionalData: optionalJson,
  additionalParams: optionalJson,
  callbackURL: Schema.optional(Schema.String),
  disableRedirect: Schema.optional(Schema.Boolean),
  errorCallbackURL: Schema.optional(Schema.String),
  idToken: optionalJson,
  loginHint: optionalJson,
  newUserCallbackURL: Schema.optional(Schema.String),
  oauth_query: Schema.optional(Schema.String),
  provider: Schema.optional(Schema.String),
  requestSignUp: Schema.optional(Schema.Boolean),
  scopes: optionalJson,
});

export type SignInStart = typeof SignInStartSchema.Type;

const decodeSignInStart = Schema.decodeUnknownOption(SignInStartSchema);

/** The fields of a sign-in's body Peal refuses, in the order checked. */
export const refusedProviderFields = (
  start: SignInStart
): readonly string[] => {
  const refused: string[] = refusedFields.filter(
    (field) => start[field] !== undefined
  );

  if (
    start.additionalData !== undefined &&
    Option.isNone(decodeAdditionalData(start.additionalData))
  ) {
    refused.push("additionalData");
  }

  return refused;
};

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

  // A body Peal cannot read is left to the route, which refuses it.
  const refused = Option.match(decodeSignInStart(ctx.body), {
    onNone: () => [],
    onSome: refusedProviderFields,
  });

  if (refused.length > 0) {
    throw APIError.from("BAD_REQUEST", {
      code: providerFieldCode,
      message: `A sign-in with a provider takes no ${refused.join(", ")}`,
    });
  }
};
