import { Duration, Effect, Layer, Option } from "effect";

import type { ImageFailed } from "#assistant/application/image-failed.ts";
import { ImageProviderRefused } from "#assistant/application/image-provider-refused.ts";
import type { ImageRequest } from "#assistant/application/ports/image-model.ts";
import { OwnImageModel } from "#assistant/application/ports/own-image-model.ts";
import type { OwnImageEndpoint } from "#assistant/application/ports/own-image-model.ts";
import { imageDimensionsOf } from "#assistant/domain/image-provider.ts";
import type { ImageCallFailed } from "#assistant/infrastructure/ai-sdk/image-call-failed.ts";
import { generateImageWith } from "#assistant/infrastructure/ai-sdk/image-model.ts";
import {
  imageAnswerTimeout,
  imageDownloadFetch,
  imageFailure,
  madeImageOf,
  maxAnswerBytes,
  reasonOfStatus,
  settingsRefused,
} from "#assistant/infrastructure/image-answers.ts";
import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import { publicFetchWith } from "#shared/infrastructure/platforms/public-http.ts";

// What every log line and span of a workspace's provider says of it: whose
// it is, never its host or its model, which are the workspace's business.
const source = { "peal.assistant.image_source": "workspace" } as const;

const failWith = (kind: string, reason: ImageFailed["reason"]) =>
  Effect.logWarning("A workspace's image provider failed", {
    kind,
    reason,
    source: "workspace",
  }).pipe(
    Effect.andThen(Effect.annotateCurrentSpan("peal.assistant.failure", kind)),
    Effect.andThen(Effect.fail(imageFailure(reason)))
  );

const refusedWith = (
  kind: string,
  status: number | null,
  reason: ImageProviderRefused["reason"] = status === null
    ? "addressRefused"
    : "settingsRefused"
) =>
  Effect.logWarning("A workspace's image provider refused its settings", {
    kind,
    source: "workspace",
    status,
  }).pipe(
    Effect.andThen(Effect.annotateCurrentSpan("peal.assistant.failure", kind)),
    Effect.andThen(Effect.fail(new ImageProviderRefused({ reason, status })))
  );

// A host Peal sends nothing to is the workspace's to fix; one that
// cannot be looked up for now may answer later.
const guardRefused = ({
  reason,
}: OutboundRequestRefused): Effect.Effect<
  never,
  ImageFailed | ImageProviderRefused
> =>
  reason === "lookupFailed"
    ? failWith("Lookup", "unreachable")
    : refusedWith("AddressRefused", null);

// A failure of the provider's: the settings it refused, a redirect it
// answered with (never followed, as it could lead past the guard: the
// address is not the API's own), or anything else.
const callFailed = ({
  kind,
  status,
}: ImageCallFailed): Effect.Effect<
  never,
  ImageFailed | ImageProviderRefused
> => {
  if (kind === "status" && status !== null) {
    if (settingsRefused.has(status)) {
      return refusedWith(`Status${status}`, status);
    }

    return status >= 300 && status <= 399
      ? refusedWith(`Status${status}`, status, "redirected")
      : failWith(`Status${status}`, reasonOfStatus(status));
  }

  // The guard checked the address just before: a request it refuses as
  // it is sent (a name whose answer changed since) could not be sent.
  if (kind === "unsent") {
    return failWith("Transport", "unreachable");
  }

  return kind === "unusable"
    ? failWith("UnusableAnswer", "unusableAnswer")
    : failWith("Refused", "refused");
};

// The provider's settings as the AI SDK's adapters take them.
const settingsOf = (endpoint: OwnImageEndpoint) => ({
  apiKey: Option.some(endpoint.apiKey),
  baseUrl: endpoint.baseUrl,
  model: endpoint.model,
  provider: endpoint.provider,
});

/**
 * OwnImageModel on the AI SDK's adapters (`ai-sdk/image-model.ts`), at
 * the address a workspace's member typed: the address is checked by the
 * outbound guard before the call, and every request goes through the
 * guarded fetch (`publicFetchWith`), which checks it again as it is sent
 * (HTTPS on the default port, every address public), follows no redirect,
 * cuts the answer off past `maxAnswerBytes` and sends no trace context.
 * An image the answer gives by address goes through the guard as well,
 * read up to `maxImageBytes`.
 *
 * 401, 402, 403 and 404 are the workspace's settings refused
 * (ImageProviderRefused, with the status), a 3xx is `redirected`, and a
 * host the guard refuses is `addressRefused` (with none), but for a name
 * that cannot be looked up for now, which is `unreachable`; 429 and 5xx
 * are `unreachable`, another status `refused`. It keeps no state: the
 * provider's package is built for each call. The key is `Redacted` until
 * the request's header; the logs and the span say `workspace`, the
 * provider, the status and the kind of failure, never the host, the
 * model, the prompt or the key.
 */
export const ownImageModel = ({
  timeout = imageAnswerTimeout,
}: { readonly timeout?: Duration.Input } = {}) =>
  Layer.effect(
    OwnImageModel,
    Effect.gen(function* makeOwnImageModel() {
      const guard = yield* OutboundGuard;

      // The whole call waits `timeout`: the fetches' own bound is a little
      // later, so a slow provider ends as `timedOut`.
      const fetchTimeout = Duration.sum(
        Duration.fromInputUnsafe(timeout),
        Duration.seconds(1)
      );

      const fetches = {
        api: yield* publicFetchWith({
          maxResponseBytes: maxAnswerBytes,
          timeout: fetchTimeout,
        }),
        download: yield* imageDownloadFetch(fetchTimeout),
      };

      const generate = (endpoint: OwnImageEndpoint, request: ImageRequest) =>
        guard.check(new URL(endpoint.baseUrl)).pipe(
          // The guard's span names the host it refuses.
          Effect.withTracerEnabled(false),
          Effect.catchTag("OutboundRequestRefused", guardRefused),
          Effect.andThen(
            generateImageWith(settingsOf(endpoint), fetches, {
              prompt: request.prompt,
              dimensions: imageDimensionsOf(endpoint.provider, request.aspect),
            }).pipe(Effect.catchTag("ImageCallFailed", callFailed))
          ),
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
          Effect.withSpan("OwnImageModel.generate", {
            attributes: {
              "gen_ai.provider.name": endpoint.provider,
              ...source,
            },
          })
        );

      return OwnImageModel.of({ generate });
    })
  );

/**
 * OwnImageModel as the server runs it: the guard resolves names with the
 * runtime's Dns, which the composition root provides.
 */
export const OwnImageModelLive = ownImageModel().pipe(
  Layer.provide(OutboundGuard.layer)
);
