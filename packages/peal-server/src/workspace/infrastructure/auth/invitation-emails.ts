import type { GenericEndpointContext } from "better-auth";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { Option, Schema } from "effect";

import { WorkspaceIdSchema } from "#shared/domain/ids.ts";

/** An invitation email Better Auth's route is about to send. */
export interface InvitationEmailRequest {
  readonly email: string;
  readonly inviterId: string;
  readonly workspaceId: string;
}

/**
 * Whether the day still has an email for the inviter, the workspace and
 * the address (`InvitationEmails`), taking it if so: awaited before
 * Better Auth's route writes or sends an invitation again. A failure
 * refuses the request.
 */
export type InvitationEmailAllowance = (
  request: InvitationEmailRequest
) => Promise<boolean>;

/** The code an invitation past the day's emails is refused with. */
export const invitationEmailsCode = "DAILY_INVITATION_LIMIT_REACHED";

const exhausted = () =>
  APIError.from("TOO_MANY_REQUESTS", {
    code: invitationEmailsCode,
    message:
      "The inviter, the workspace or the address invited had all the invitation emails a day allows: try again tomorrow",
  });

/**
 * Takes one of the day's invitation emails for a new invitation of
 * Better Auth's `/organization/invite-member`, from its
 * `beforeCreateInvitation`, once the route checked the rest and before it
 * writes the invitation: refused past the inviter's, the workspace's or
 * the address's day (429 `DAILY_INVITATION_LIMIT_REACHED`). Better Auth
 * sends its emails where a failure is only logged, so the count is taken
 * before. Peal's own API counts them in its own transaction
 * (`WorkspacePeopleLive`).
 */
export const claimInvitationEmail = async (
  allows: InvitationEmailAllowance,
  request: InvitationEmailRequest
): Promise<void> => {
  if (!(await allows(request))) {
    throw exhausted();
  }
};

const ResendSchema = Schema.Struct({
  email: Schema.String,
  organizationId: Schema.optional(Schema.String),
  resend: Schema.Literal(true),
});

const decodeResend = Schema.decodeUnknownOption(ResendSchema);

const decodeWorkspaceId = Schema.decodeUnknownOption(WorkspaceIdSchema);

const decodeActive = Schema.decodeUnknownOption(
  Schema.Struct({ activeOrganizationId: Schema.String })
);

/**
 * The same for an invitation the route sends again (`resend`, which
 * writes none, so no `beforeCreateInvitation` runs): from the before hook,
 * for a member of the workspace with an invitation pending to the address,
 * which the route then sends again. Any other request is left to the
 * route, which counts a new invitation itself, or refuses.
 */
export const claimResentInvitationEmail = async (
  ctx: GenericEndpointContext,
  allows: InvitationEmailAllowance
): Promise<void> => {
  if (ctx.path !== "/organization/invite-member") {
    return;
  }

  const resend = decodeResend(ctx.body);

  if (Option.isNone(resend)) {
    return;
  }

  const session = await getSessionFromCtx(ctx);

  const named =
    resend.value.organizationId ??
    Option.getOrUndefined(
      Option.map(
        decodeActive(session?.session),
        ({ activeOrganizationId }) => activeOrganizationId
      )
    );

  const workspaceId = decodeWorkspaceId(named);

  if (session === null || Option.isNone(workspaceId)) {
    return;
  }

  const { adapter } = ctx.context;
  const email = resend.value.email.toLowerCase();

  const [member, pending] = await Promise.all([
    adapter.findOne({
      model: "member",
      select: ["id"],
      where: [
        { field: "organizationId", value: workspaceId.value },
        { field: "userId", value: session.user.id },
      ],
    }),
    adapter.findOne({
      model: "invitation",
      select: ["id"],
      where: [
        { field: "organizationId", value: workspaceId.value },
        { field: "email", value: email },
        { field: "status", value: "pending" },
      ],
    }),
  ]);

  if (member === null || pending === null) {
    return;
  }

  await claimInvitationEmail(allows, {
    email,
    inviterId: session.user.id,
    workspaceId: workspaceId.value,
  });
};
