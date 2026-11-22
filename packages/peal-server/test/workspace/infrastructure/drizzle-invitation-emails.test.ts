import { randomUUID } from "node:crypto";

import { assert, layer } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";

import { UserIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { PlainPseudonymsTest } from "#test/billing/support.ts";
import { DatabaseTest } from "#test/channels/support.ts";
import { InvitationEmails } from "#workspace/application/invitation-emails.ts";
import { invitationEmailsPerDay } from "#workspace/domain/invitation-emails.ts";
import { DrizzleInvitationEmailsLive } from "#workspace/infrastructure/drizzle-invitation-emails.ts";

// The day's invitation emails, counted by inviter, workspace, workspace
// and address, and address across Peal: a workspace sends an address a
// few, which no other workspace's invitations use up, and the address
// takes a ceiling of them in all.

const EmailsTest = DrizzleInvitationEmailsLive.pipe(
  Layer.provideMerge(Layer.merge(PlainPseudonymsTest, DatabaseTest))
);

const at = DateTime.makeUnsafe("2026-11-23T10:00:00Z");

const someone = () => UserIdSchema.make(randomUUID());

const somewhere = () => WorkspaceIdSchema.make(randomUUID());

layer(EmailsTest)("the day's invitation emails", (it) => {
  it.effect(
    "give each workspace its few for an address, and the address its ceiling in all",
    () =>
      Effect.gen(function* counts() {
        const emails = yield* InvitationEmails;
        const email = `Invited+${randomUUID()}@example.test`;
        const workspaceId = somewhere();
        const inviterId = someone();

        const claim = (claimed: {
          readonly inviterId: ReturnType<typeof someone>;
          readonly workspaceId: ReturnType<typeof somewhere>;
        }) => emails.claim({ at, email, ...claimed });

        const fromOne: boolean[] = [];

        for (
          let sent = 0;
          sent <= invitationEmailsPerDay.perWorkspaceAndRecipient;
          sent += 1
        ) {
          fromOne.push(yield* claim({ inviterId, workspaceId }));
        }

        assert.deepStrictEqual(fromOne, [true, true, true, false]);

        // Other workspaces, until the address's ceiling.
        const others: boolean[] = [];

        for (
          let sent = invitationEmailsPerDay.perWorkspaceAndRecipient;
          sent <= invitationEmailsPerDay.perRecipient;
          sent += 1
        ) {
          others.push(
            yield* claim({ inviterId: someone(), workspaceId: somewhere() })
          );
        }

        assert.strictEqual(others.filter(Boolean).length, 17);
        assert.isFalse(others.at(-1));

        // The address in another case is the same address.
        assert.isFalse(
          yield* emails.claim({
            at,
            email: email.toUpperCase(),
            inviterId: someone(),
            workspaceId: somewhere(),
          })
        );

        // The next day starts again.
        assert.isTrue(
          yield* emails.claim({
            at: DateTime.add(at, { days: 1 }),
            email,
            inviterId,
            workspaceId,
          })
        );
      })
  );
});
