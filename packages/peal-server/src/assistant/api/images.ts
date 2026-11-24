import { Effect } from "effect";
import { HttpApiBuilder } from "effect/http-api";
import {
  Api,
  AssistantFailed,
  AssistantInputRejected,
  AssistantUnavailable,
  CurrentMember,
  ImageProviderRefused,
  MediaImportBusy,
  MediaStoreUnavailable,
  OwnImageLimitReached,
} from "peal-contract";

import type { ImageFailed } from "#assistant/application/image-failed.ts";
import { WritingAssistant } from "#assistant/application/writing-assistant.ts";
import { imageRequestCost } from "#assistant/domain/image-limits.ts";
import { actorOf } from "#shared/api/actor.ts";
import { allowanceRefusal } from "#shared/api/allowance-reached.ts";
import { forbidden } from "#shared/api/forbidden.ts";
import { limitRefusal } from "#shared/api/limit-reached.ts";

import { quotaRefusal } from "./quota-refusal.ts";

// An image's failure as the contract tells it, beside the text's.
const imageReasons: Readonly<
  Record<ImageFailed["reason"], AssistantFailed["reason"]>
> = {
  refused: "declined",
  timedOut: "timedOut",
  unreachable: "unreachable",
  unusableAnswer: "invalidAnswer",
};

/**
 * Images made into the media library from a prompt, by the workspace's own
 * image provider or the server's: each refusal of the use case as the
 * contract's error.
 */
export const MediaImagesHandlers = HttpApiBuilder.group(
  Api,
  "media.images",
  Effect.fn(function* mediaImagesHandlers(handlers) {
    const assistant = yield* WritingAssistant;
    const limitReached = yield* limitRefusal;
    const allowanceReached = yield* allowanceRefusal;
    const quotaExceeded = yield* quotaRefusal;

    return handlers.handleAll({
      create: ({ payload }) =>
        Effect.gen(function* generateImage() {
          const actor = actorOf(yield* CurrentMember);

          return yield* assistant.generateImage(actor, payload).pipe(
            Effect.catchTags({
              AllowanceReached: allowanceReached,
              AssistantQuotaExceeded: ({ dailyLimit, resetsAt }) =>
                quotaExceeded(actor, {
                  dailyLimit,
                  needed: Math.max(dailyLimit + 1, imageRequestCost),
                  resetsAt,
                }),
              AssistantUnavailable: () =>
                Effect.fail(new AssistantUnavailable()),
              DraftRejected: ({ maxLength, reason }) =>
                Effect.fail(new AssistantInputRejected({ maxLength, reason })),
              ImageFailed: ({ reason }) =>
                Effect.fail(
                  new AssistantFailed({ reason: imageReasons[reason] })
                ),
              ImageNotStored: () => Effect.fail(new MediaStoreUnavailable()),
              // The workspace's own provider: what the adapter logged is
              // all that is said of it.
              ImageProviderRefused: ({ reason, status }) =>
                Effect.fail(new ImageProviderRefused({ reason, status })),
              ImagesBusy: () => Effect.fail(new MediaImportBusy()),
              MissingPermission: forbidden,
              OwnImagesExhausted: ({ dailyLimit, resetsAt }) =>
                Effect.fail(new OwnImageLimitReached({ dailyLimit, resetsAt })),
              PlanLimitReached: limitReached,
            })
          );
        }),
    });
  })
);
