import { Effect, Layer, Ref } from "effect";
import type { Duration } from "effect";

import { AssistantUnavailable } from "#assistant/application/assistant-unavailable.ts";
import type { ImageFailed } from "#assistant/application/image-failed.ts";
import { ImageModel } from "#assistant/application/ports/image-model.ts";
import type { ImageRequest } from "#assistant/application/ports/image-model.ts";
import { imageDimensionsOf } from "#assistant/domain/image-provider.ts";
import type { ImageCallFailed } from "#assistant/infrastructure/ai-sdk/image-call-failed.ts";
import { generateImageWith } from "#assistant/infrastructure/ai-sdk/image-model.ts";
import type { ImageModelSettings } from "#assistant/infrastructure/ai-sdk/models.ts";
import {
  imageAnswerTimeout,
  imageDownloadFetch,
  imageFailure,
  madeImageOf,
  maxAnswerBytes,
  reasonOfStatus,
  settingsRefused,
} from "#assistant/infrastructure/image-answers.ts";
import { boundedFetchWith } from "#shared/infrastructure/platforms/public-http.ts";

/**
 * The assistant's ImageModel on the AI SDK's adapter for the provider the
 * operator named (`ai-sdk/image-model.ts`): its API is called with plain
 * fetch, at the host the operator named (not through the outbound guard,
 * as for the writing model), the answer cut off past `maxAnswerBytes`. An
 * image the answer gives by address came from outside: it is fetched
 * through the guarded fetch, which checks the address, follows no
 * redirect and reads `maxImageBytes` at most. The whole call waits
 * `timeout` at most, and nothing of the prompt, the image or the
 * provider's answer reaches a log or a trace: the provider gets no trace
 * context, and the call's own span names the provider, the model and the
 * kind of failure.
 *
 * 401, 402, 403 and 404 say the operator's settings are wrong: logged by
 * status alone, answered AssistantUnavailable, and images stay off until
 * the server restarts. 429 and 5xx are `unreachable`, another status
 * `refused`, a request that could not be sent `unreachable`, an answer
 * with no image the library takes `unusableAnswer`. Needs the
 * OutboundGuard.
 */
export const aiSdkImageModel = (
  settings: ImageModelSettings,
  { timeout = imageAnswerTimeout }: { readonly timeout?: Duration.Input } = {}
) =>
  Layer.effect(
    ImageModel,
    Effect.gen(function* makeImageModel() {
      const { model, provider } = settings;

      const fetches = {
        api: boundedFetchWith({ maxResponseBytes: maxAnswerBytes }),
        download: yield* imageDownloadFetch(timeout),
      };

      // Whether the provider refused the server's settings since it started.
      const refused = yield* Ref.make(false);

      const identity = {
        "gen_ai.provider.name": provider,
        "gen_ai.request.model": model,
      };

      // The log and the span name the kind of failure, never a body.
      const failWith = (kind: string, reason: ImageFailed["reason"]) =>
        Effect.logWarning("The assistant's image model failed", {
          kind,
          model,
          reason,
        }).pipe(
          Effect.andThen(
            Effect.annotateCurrentSpan("peal.assistant.failure", kind)
          ),
          Effect.andThen(Effect.fail(imageFailure(reason)))
        );

      // The operator's to fix: by status alone, never the body. Images
      // stay off until the server restarts with other settings.
      const settingsWrong = (status: number) =>
        Ref.set(refused, true).pipe(
          Effect.andThen(
            Effect.logError(
              "The image model refused the server's settings: images are off until the server restarts",
              { model, status }
            )
          ),
          Effect.andThen(
            Effect.annotateCurrentSpan(
              "peal.assistant.failure",
              `Status${status}`
            )
          ),
          Effect.andThen(Effect.fail(new AssistantUnavailable()))
        );

      const callFailed = ({
        kind,
        status,
      }: ImageCallFailed): Effect.Effect<
        never,
        AssistantUnavailable | ImageFailed
      > => {
        if (kind === "status" && status !== null) {
          return settingsRefused.has(status)
            ? settingsWrong(status)
            : failWith(`Status${status}`, reasonOfStatus(status));
        }

        if (kind === "unsent") {
          return failWith("Transport", "unreachable");
        }

        return kind === "unusable"
          ? failWith("UnusableAnswer", "unusableAnswer")
          : failWith("Refused", "refused");
      };

      const call = ({ aspect, prompt }: ImageRequest) =>
        generateImageWith(settings, fetches, {
          prompt,
          dimensions: imageDimensionsOf(provider, aspect),
        }).pipe(
          Effect.catchTag("ImageCallFailed", callFailed),
          Effect.flatMap((bytes) =>
            madeImageOf(bytes).pipe(
              Effect.catchTag("ImageFailed", ({ reason }) =>
                failWith("UnusableAnswer", reason)
              )
            )
          ),
          // Interrupting the call aborts its HTTP request.
          Effect.timeoutOrElse({
            duration: timeout,
            orElse: () => failWith("Timeout", "timedOut"),
          }),
          Effect.withSpan("ImageModel.generate", { attributes: identity })
        );

      const generate = (made: ImageRequest) =>
        Ref.get(refused).pipe(
          Effect.flatMap((off) =>
            off ? Effect.fail(new AssistantUnavailable()) : call(made)
          )
        );

      return ImageModel.of({
        available: Ref.get(refused).pipe(Effect.map((off) => !off)),
        generate,
      });
    })
  );
