import { Effect } from "effect";
import { CurrentMember } from "peal-contract";

import { PeopleTools } from "#app/mcp/people-tools.ts";
import { refuse } from "#app/mcp/refusals.ts";
import { actorOf } from "#shared/api/actor.ts";
import { memberView } from "#workspace/api/members.ts";
import { WorkspaceMembers } from "#workspace/application/workspace-members.ts";

// What only a member does: an API key, a workspace's or a partner's, is
// nobody, and a user's token is bound to a workspace they belonged to,
// which they left meanwhile.
const gone = () =>
  CurrentMember.pipe(
    Effect.flatMap(({ principal }) => {
      if (principal._tag === "partnerKey") {
        return refuse(
          "Only a person signed in to Peal does this, never a partner key: a workspace's members are theirs to see, and a partner's customers' workspaces have none."
        );
      }

      return refuse(
        principal._tag === "apiKey"
          ? "Only a person signed in to Peal does this, never an API key: the workspace's members are theirs to see. Connect with OAuth, as a member, to use this tool."
          : "You no longer belong to the workspace this connection acts in. Connect to Peal again and pick another."
      );
    })
  );

/** What the people tools do, through the workspace context's use cases. */
export const PeopleToolsLive = PeopleTools.toLayer(
  Effect.gen(function* peopleTools() {
    const members = yield* WorkspaceMembers;

    const actor = CurrentMember.pipe(Effect.map(actorOf));

    return PeopleTools.of({
      list_members: ({ includeEmails }) =>
        Effect.gen(function* list() {
          const listed = yield* members.list(yield* actor).pipe(
            Effect.catchTags({
              DirectoryUnavailable: Effect.die,
              UserRequired: gone,
            })
          );

          return {
            members: listed.map((member) => {
              const { email, ...view } = memberView(member);

              return includeEmails === true ? { ...view, email } : view;
            }),
          };
        }),
    });
  })
);
