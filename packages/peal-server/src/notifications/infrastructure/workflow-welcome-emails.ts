import { Effect, Layer, Option } from "effect";
import { WorkflowEngine } from "effect/workflow";

import { WelcomeEmails } from "#notifications/application/welcome-emails.ts";
import { WelcomeSigner } from "#notifications/application/welcome-signer.ts";

import { WelcomeV1 } from "./workflows/welcome.ts";

/**
 * Starts WelcomeV1 for a new account, and nothing on a server without a
 * signer. It is detached: making the account never waits for it.
 */
export const WorkflowWelcomeEmails = Layer.effect(
  WelcomeEmails,
  Effect.gen(function* WorkflowWelcomeEmails() {
    const engine = yield* WorkflowEngine.WorkflowEngine;
    const signer = yield* WelcomeSigner;

    return WelcomeEmails.of({
      start: (userId) =>
        Option.isNone(signer.name)
          ? Effect.void
          : WelcomeV1.execute(
              { userId },
              { detached: true, discard: true }
            ).pipe(
              Effect.provideService(WorkflowEngine.WorkflowEngine, engine),
              Effect.asVoid
            ),
    });
  })
);
