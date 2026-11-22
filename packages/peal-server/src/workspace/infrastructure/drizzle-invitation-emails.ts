import { lt, sql } from "drizzle-orm";
import { DateTime, Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { DatabaseError } from "#shared/application/database-error.ts";
import { Pseudonyms } from "#shared/application/pseudonyms.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";
import { InvitationEmails } from "#workspace/application/invitation-emails.ts";
import type { InvitationEmailClaim } from "#workspace/application/invitation-emails.ts";
import {
  invitationEmailDays,
  invitationEmailsPerDay,
} from "#workspace/domain/invitation-emails.ts";

import { invitationEmails } from "./schema.ts";

// One of the counts has had all its day allows: the claim's transaction
// gives back what it took of the others.
class DayExhausted extends Schema.TaggedError<DayExhausted>()(
  "DayExhausted",
  {}
) {}

const failed = (cause: unknown) => new DatabaseError({ cause });

/**
 * InvitationEmails in Postgres, by day (UTC): one row a subject and day,
 * each claim adding one to the inviter's, the workspace's and the
 * address's counts while each stays within its limit, in one transaction
 * (a savepoint within the caller's), subjects in one order so claims
 * sent together never wait on each other in a circle. The days before
 * the last `invitationEmailDays` are deleted as it goes.
 */
export const DrizzleInvitationEmailsLive = Layer.effect(
  InvitationEmails,
  Effect.gen(function* DrizzleInvitationEmails() {
    const db = yield* Drizzle;
    const client = yield* SqlClient.SqlClient;
    const pseudonyms = yield* Pseudonyms;

    const subjectsOf = ({
      email,
      inviterId,
      workspaceId,
    }: InvitationEmailClaim) =>
      Effect.all([
        pseudonyms.ofCounted("inviter", inviterId).pipe(
          Effect.map((subject) => ({
            limit: invitationEmailsPerDay.perInviter,
            subject,
          }))
        ),
        pseudonyms.ofCounted("workspace", workspaceId).pipe(
          Effect.map((subject) => ({
            limit: invitationEmailsPerDay.perWorkspace,
            subject,
          }))
        ),
        pseudonyms
          .ofCounted(
            "workspace-address",
            `${workspaceId}:${email.trim().toLowerCase()}`
          )
          .pipe(
            Effect.map((subject) => ({
              limit: invitationEmailsPerDay.perWorkspaceAndRecipient,
              subject,
            }))
          ),
        pseudonyms.ofEmail(email).pipe(
          Effect.map((subject) => ({
            limit: invitationEmailsPerDay.perRecipient,
            subject,
          }))
        ),
      ]).pipe(
        Effect.map((subjects) =>
          subjects.toSorted((one, other) =>
            one.subject.localeCompare(other.subject)
          )
        )
      );

    const claim = Effect.fn("InvitationEmails.claim")(function* claim(
      request: InvitationEmailClaim
    ) {
      const day = DateTime.formatIsoDateUtc(request.at);

      const firstKept = DateTime.formatIsoDateUtc(
        DateTime.subtract(request.at, { days: invitationEmailDays - 1 })
      );

      const subjects = yield* subjectsOf(request);

      return yield* client
        .withTransaction(
          Effect.gen(function* counting() {
            yield* db
              .delete(invitationEmails)
              .where(lt(invitationEmails.day, firstKept));

            for (const { limit, subject } of subjects) {
              const counted = yield* db
                .insert(invitationEmails)
                .values({ day, sent: 1, subject })
                .onConflictDoUpdate({
                  set: { sent: sql`${invitationEmails.sent} + 1` },
                  setWhere: lt(invitationEmails.sent, limit),
                  target: [invitationEmails.subject, invitationEmails.day],
                })
                .returning({ sent: invitationEmails.sent });

              if (counted.length === 0) {
                return yield* new DayExhausted();
              }
            }

            return true;
          })
        )
        .pipe(
          Effect.catchTag("DayExhausted", () => Effect.succeed(false)),
          Effect.mapError(failed)
        );
    });

    return InvitationEmails.of({ claim });
  })
);
