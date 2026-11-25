import { Config, Effect, Option, Schema } from "effect";
import { Flag } from "effect/cli";
import type {
  Credential,
  CredentialWorkspace,
  Membership,
} from "peal-contract";

import { apiKey, apiKeyVariable } from "#api-key.ts";
import { PealApi } from "#api.ts";
import { display } from "#display.ts";
import { explain } from "#explain.ts";
import { channelName } from "#print.ts";
import { Refused } from "#refused.ts";
import { accessToken } from "#session.ts";
import { SignInExpired } from "#sign-in-expired.ts";

/** The workspace a command acts in: a flag, then PEAL_WORKSPACE. */
export const workspaceFlag = Flag.String("workspace").pipe(
  Flag.withAlias("w"),
  Flag.withDescription(
    "The workspace to act in, by its slug or id. Defaults to PEAL_WORKSPACE, then to your only workspace. With an API key in PEAL_API_KEY, give the workspace's id, or leave it out to act in the key's own workspace."
  ),
  Flag.withMetavar("<slug>"),
  Flag.withFallbackConfig(Config.String("PEAL_WORKSPACE")),
  Flag.optional
);

/**
 * The HTTP API's client for the server the command line points at, sending
 * the API key in PEAL_API_KEY when there is one, which wins, and otherwise
 * the user's saved sign-in; and `bound`, the same client naming a
 * workspace on every request (`Peal-Workspace`), from the credential read
 * once.
 */
export const signedIn = Effect.gen(function* signedIn() {
  const api = yield* PealApi;
  const url = display(api.baseUrl);
  const key = yield* apiKey;

  if (Option.isSome(key)) {
    return {
      bound: (workspaceId: string) => api.withApiKey(key.value, workspaceId),
      client: yield* api.withApiKey(key.value),
      url,
      withKey: true,
    };
  }

  const token = yield* accessToken;

  return {
    bound: (workspaceId: string) => api.signedIn(token, workspaceId),
    client: yield* api.signedIn(token),
    url,
    withKey: false,
  };
});

/** The workspace a command acts in, as it names it in what it prints. */
export type Workspace = Pick<Membership, "id" | "name" | "slug">;

const isUuid = Schema.is(Schema.String.check(Schema.isUUID()));

/** Whether a value has the shape of a workspace's id. */
export const isWorkspaceId = (value: string): boolean => isUuid(value);

/**
 * The workspace a run names: a blank value, as an unset variable in a
 * script gives, names none, as a blank `Peal-Workspace` does.
 */
export const namedWorkspace = (
  choice: Option.Option<string>
): Option.Option<string> =>
  choice.pipe(Option.filter((value) => value.trim() !== ""));

/** What a key run that names a workspace by its slug is told. */
export const keyTakesAnId = (wanted: string) =>
  `With an API key (${apiKeyVariable}), --workspace and PEAL_WORKSPACE take the workspace's id, not its slug (${wanted}): a key cannot look workspaces up. Leave it out to act in the key's own workspace.`;

/**
 * Why a credential that names no workspace has none to act in, and what
 * to do: a partner key, or a token bound to none, names one; a token
 * bound to a workspace its person has left may do nothing until its
 * application is connected again.
 */
export const noWorkspaceOf = (credential: Credential) => {
  if (credential._tag === "partnerKey") {
    return {
      code: "workspace_id_required",
      reason: `A partner key belongs to no workspace: name one of its partner's workspaces by its id, with --workspace or PEAL_WORKSPACE. GET /api/v1/partner/workspaces lists them.`,
    };
  }

  return credential._tag === "user" &&
    credential.application?.binding._tag === "left"
    ? {
        code: "refused",
        reason: `The token in ${apiKeyVariable} was bound to a workspace its person has left since: it may do nothing anywhere until its application is connected again.`,
      }
    : {
        code: "workspace_id_required",
        reason: `The token in ${apiKeyVariable} belongs to no workspace: name one by its id, with --workspace or PEAL_WORKSPACE.`,
      };
};

/**
 * The workspace a credential belongs to, which the server acts in when a
 * request names none: a workspace's own key's, or the one an
 * application's token is bound to. A partner key belongs to none.
 */
export const ownWorkspaceOf = (
  credential: Credential
): Option.Option<CredentialWorkspace> => {
  if (credential._tag === "apiKey") {
    return Option.some(credential.workspace);
  }

  const binding =
    credential._tag === "user" ? credential.application?.binding : undefined;

  return binding?._tag === "bound"
    ? Option.some({ id: binding.id, name: binding.name })
    : Option.none();
};

// The workspace a key acts in when the run names none, as the credential
// check names it.
const ownWorkspace = (
  credential: Credential
): Effect.Effect<Workspace, Refused> =>
  Option.match(ownWorkspaceOf(credential), {
    onNone: () => Effect.fail(new Refused(noWorkspaceOf(credential))),
    onSome: ({ id, name }) => Effect.succeed({ id, name, slug: id }),
  });

// A key is nobody: it cannot read whose workspaces these are, so a
// workspace it names is known by its id alone, which stands for its name.
const keyWorkspace = (wanted: string): Effect.Effect<Workspace, Refused> =>
  isWorkspaceId(wanted)
    ? Effect.succeed({ id: wanted, name: wanted, slug: wanted })
    : Effect.fail(
        new Refused({
          code: "workspace_id_required",
          reason: keyTakesAnId(wanted),
        })
      );

const pick = (
  workspaces: readonly Membership[],
  choice: Option.Option<string>
): Effect.Effect<Membership, Refused> =>
  Option.match(choice, {
    onNone: () => {
      const [only] = workspaces;

      if (only !== undefined && workspaces.length === 1) {
        return Effect.succeed(only);
      }

      return Effect.fail(
        new Refused({
          code: only === undefined ? "no_workspace" : "workspace_required",
          reason:
            only === undefined
              ? "You do not belong to any workspace yet."
              : `You belong to several workspaces: name one with --workspace or PEAL_WORKSPACE (${workspaces.map(({ slug }) => slug).join(", ")}).`,
        })
      );
    },
    onSome: (wanted) =>
      Option.match(
        Option.fromUndefinedOr(
          workspaces.find(({ id, slug }) => id === wanted || slug === wanted)
        ),
        {
          onNone: () =>
            Effect.fail(
              new Refused({
                code: "workspace_unknown",
                reason: `You belong to no workspace ${wanted}. peal whoami lists yours.`,
              })
            ),
          onSome: Effect.succeed,
        }
      ),
  });

/**
 * The signed-in client, and the workspace a command acts in: the one the
 * user named, by slug or id, or their only one. With an API key, the one
 * whose id was given, or else the key's own, which the credential check
 * names, and which the server acts in when a request names none. The
 * client names a workspace it was given on every request
 * (`Peal-Workspace`), which the workspace's endpoints act in.
 */
export const inWorkspace = (choice: Option.Option<string>) =>
  Effect.gen(function* signedInWorkspace() {
    const { bound, client, url, withKey } = yield* signedIn;

    if (withKey) {
      const wanted = namedWorkspace(choice);

      if (Option.isSome(wanted)) {
        const workspace = yield* keyWorkspace(wanted.value);

        return { client: yield* bound(workspace.id), url, workspace };
      }

      const workspace = yield* client.credential
        .get()
        .pipe(Effect.mapError(explain(url)), Effect.flatMap(ownWorkspace));

      return { client, url, workspace };
    }

    const me = yield* client.me.get().pipe(
      Effect.mapError((failure) =>
        // The sign-in was revoked, or its user banned.
        failure._tag === "Forbidden"
          ? new SignInExpired({ url })
          : explain(url)(failure)
      )
    );

    const workspace: Workspace = yield* pick(me.workspaces, choice);

    return { client: yield* bound(workspace.id), url, workspace };
  });

type SignedInClient = Effect.Success<typeof signedIn>["client"];

/**
 * The workspace's channels by id, as people recognize them, to print beside
 * their ids. A member who may not read them sees the ids alone.
 */
export const channelNames = (client: SignedInClient) =>
  client.channels.list({ headers: {} }).pipe(
    Effect.map(
      (channels): ReadonlyMap<string, string> =>
        new Map(channels.map((channel) => [channel.id, channelName(channel)]))
    ),
    Effect.orElseSucceed((): ReadonlyMap<string, string> => new Map())
  );

/** A channel's id, with its name when it is known. */
export const named = (
  names: ReadonlyMap<string, string>,
  channelId: string
): string => {
  const name = names.get(channelId);

  return name === undefined ? channelId : `${channelId} (${name})`;
};
