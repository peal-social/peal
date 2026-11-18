import { Effect, Layer, Option } from "effect";
import { errorsByTag } from "peal-contract/errors";

import { ActivityLog } from "#activity/application/activity-log.ts";
import { ProductAnalytics } from "#shared/application/product-analytics.ts";
import type { ProductEvent } from "#shared/domain/product-event.ts";
import { ActivityJournal } from "#workspace/application/activity-journal.ts";
import type {
  AnsweredChange,
  ChangeOutcome,
} from "#workspace/application/activity-journal.ts";
import type { Principal } from "#workspace/domain/principal.ts";

// Who asked, as the log names them: the member staff act as is the actor,
// and the log says staff asked, never who.
const whoOf = (principal: Principal) => {
  if (principal._tag === "ApiKeyPrincipal") {
    return {
      actor: { _tag: "apiKey" as const, apiKeyId: principal.apiKeyId },
      clientId: Option.none<string>(),
      impersonated: false,
    };
  }

  // A partner key, by its own id: `via` says it is the partner's.
  if (principal._tag === "PartnerKeyPrincipal") {
    return {
      actor: { _tag: "apiKey" as const, apiKeyId: principal.partnerKeyId },
      clientId: Option.none<string>(),
      impersonated: false,
    };
  }

  return {
    actor: {
      _tag: "user" as const,
      userId: Option.some(principal.userId),
    },
    clientId: principal.oauth.pipe(Option.map(({ clientId }) => clientId)),
    impersonated: Option.isSome(principal.impersonatedBy),
  };
};

interface Answer {
  readonly errorCode: Option.Option<string>;
  readonly status: Option.Option<number>;
}

// A failure the contract does not declare, or a bug: the caller is told
// 500, and no more.
const serverError: Answer = {
  errorCode: Option.none(),
  status: Option.some(500),
};

/**
 * The status and the code an outcome was answered with: a response's own
 * status, or those of the contract's error a handler failed with, as the
 * API's list of errors gives them.
 */
export const answerOf = (
  outcome: ChangeOutcome,
  catalogue: ReturnType<typeof errorsByTag>
): Answer => {
  if (outcome._tag === "answered") {
    return { errorCode: Option.none(), status: Option.some(outcome.status) };
  }

  if (outcome._tag === "toolCalled") {
    return { errorCode: outcome.errorCode, status: Option.none() };
  }

  if (outcome._tag === "unanswered") {
    return { errorCode: Option.none(), status: Option.none() };
  }

  return outcome.error.pipe(
    Option.flatMapNullishOr((tag) => catalogue.get(tag)),
    Option.match({
      onNone: () => serverError,
      onSome: ({ code, status }) => ({
        errorCode: Option.some(code),
        status: Option.some(status),
      }),
    })
  );
};

// The person behind a change, for product analytics: none for a key, whose
// change is its workspace's.
const analyticsActorOf = (principal: Principal) =>
  principal._tag === "UserPrincipal"
    ? Option.some({
        impersonated: Option.isSome(principal.impersonatedBy),
        userId: principal.userId,
      })
    : Option.none();

// The change as product analytics counts it: metadata only. A change
// through the MCP endpoint is its tool's call (`mcp_tool_called`).
const operationEvent = (
  change: AnsweredChange,
  via: Exclude<AnsweredChange["via"], "mcp">,
  answer: Answer
): ProductEvent => ({
  name: "api_operation",
  properties: {
    ...Option.match(answer.errorCode, {
      onNone: () => ({}),
      onSome: (errorCode) => ({ errorCode }),
    }),
    ...Option.match(answer.status, {
      onNone: () => ({}),
      onSome: (status) => ({ status }),
    }),
    operation: change.operation,
    succeeded: Option.exists(answer.status, (status) => status < 400),
    via,
  },
});

/**
 * The ActivityJournal in the activity context's logs, which also tells
 * product analytics of each change the log kept (`api_operation`), but
 * those through the MCP endpoint and those of staff acting as a member.
 */
export const LoggedActivityJournal = Layer.effect(
  ActivityJournal,
  Effect.gen(function* LoggedActivityJournal() {
    const log = yield* ActivityLog;
    const analytics = yield* ProductAnalytics;
    const catalogue = errorsByTag();

    const told = (change: AnsweredChange, answer: Answer) =>
      change.via === "mcp"
        ? Effect.void
        : analytics.capture({
            actor: analyticsActorOf(change.principal),
            billingAccountId: Option.none(),
            event: operationEvent(change, change.via, answer),
            workspaceId: Option.some(change.workspaceId),
          });

    return ActivityJournal.of({
      record: (change) => {
        const answer = answerOf(change.outcome, catalogue);

        return log
          .record({
            ...whoOf(change.principal),
            ...answer,
            named: change.named,
            operation: change.operation,
            requestId: change.requestId,
            via: change.via,
            workspaceId: change.workspaceId,
          })
          .pipe(
            // Once kept, so the log and analytics never disagree.
            Effect.andThen(told(change, answer))
          );
      },
    });
  })
);
