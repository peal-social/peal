import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";
import { Option, Result, Schema } from "effect";

import {
  fittedName,
  maxPersonNameLength,
  maxWorkspaceNameLength,
  typedName,
} from "#shared/domain/display-name.ts";
import type { NameRefusal } from "#shared/domain/display-name.ts";

// A person's name and a workspace's go out in invitations' subjects and
// bodies, from Peal's own domain. Better Auth's routes take them as they
// come (`/sign-up/email`, `/update-user`, `/organization/create`,
// `/organization/update`): these hooks keep them one line, bounded, and
// without a web address's markers (`typedName`), and refuse what a person
// typed otherwise, with a code the web app's forms explain. A name a
// sign-in provider gives is made fit instead (`fittedName`), so the
// sign-in goes on. Emails leave out a name that still reads as an address
// (peal-emails' `nameForMail`).

/** The code a person's name that cannot be kept is refused with. */
export const invalidNameCode = "INVALID_NAME";

/** The code a workspace's name that cannot be kept is refused with. */
export const invalidWorkspaceNameCode = "INVALID_WORKSPACE_NAME";

const why: Readonly<Record<NameRefusal, string>> = {
  empty: "is empty",
  link: "holds a web address: leave out `www.` and `://`",
  tooLong: "is too long",
};

const refusedName = (refusal: NameRefusal) =>
  APIError.from("BAD_REQUEST", {
    code: invalidNameCode,
    message: `A name is one line of ${String(maxPersonNameLength)} characters at most, without a web address: this one ${why[refusal]}`,
  });

const refusedWorkspaceName = (refusal: NameRefusal) =>
  APIError.from("BAD_REQUEST", {
    code: invalidWorkspaceNameCode,
    message: `A workspace's name is one line of ${String(maxWorkspaceNameLength)} characters at most, without a web address: this one ${why[refusal]}`,
  });

// The name a person typed, as kept, or refused with `refuse`'s error.
const kept = (
  typed: string,
  maximum: number,
  refuse: (refusal: NameRefusal) => APIError
): string =>
  Result.match(typedName(typed, maximum), {
    onFailure: (refusal) => {
      throw refuse(refusal);
    },
    onSuccess: (name) => name,
  });

const decodeName = Schema.decodeUnknownOption(
  Schema.Struct({ name: Schema.String })
);

/**
 * Refuses a sign-up whose name cannot be kept, before Better Auth's route
 * runs: the route answers an address that has an account with a made-up
 * user before it writes one, so refusing in the database's hook alone
 * would tell a known address from an unknown one. A name that is no
 * string is left to the route, which refuses it.
 */
export const refuseUnfitSignUpNames = (ctx: GenericEndpointContext): void => {
  if (ctx.path !== "/sign-up/email") {
    return;
  }

  const body = decodeName(ctx.body);

  if (Option.isSome(body)) {
    kept(body.value.name, maxPersonNameLength, refusedName);
  }
};

// Whether the route that writes the user is one a person types the name
// in (made fit otherwise, as a provider's callback).
const typedOn = (context: { readonly path?: string } | null): boolean =>
  context?.path === "/sign-up/email" || context?.path === "/update-user";

/**
 * The user's name, as `databaseHooks.user` writes it: refused on the
 * routes a person types it in, made fit on any other (a provider's
 * callback), and left alone when the write names none, or no string.
 */
export const userWithFitName = <U extends Readonly<Record<string, unknown>>>(
  user: U,
  context: { readonly path?: string } | null
): U =>
  Option.match(decodeName(user), {
    onNone: () => user,
    onSome: ({ name }) => ({
      ...user,
      name: typedOn(context)
        ? kept(name, maxPersonNameLength, refusedName)
        : fittedName(name, maxPersonNameLength),
    }),
  });

/**
 * A workspace's name, as Better Auth's organization hooks write it, made
 * or changed: refused unless it can be kept, and left alone by a change
 * that names none.
 */
export const workspaceWithFitName = <
  W extends { readonly name?: string | undefined },
>(
  workspace: W
): W =>
  workspace.name === undefined
    ? workspace
    : {
        ...workspace,
        name: kept(
          workspace.name,
          maxWorkspaceNameLength,
          refusedWorkspaceName
        ),
      };
