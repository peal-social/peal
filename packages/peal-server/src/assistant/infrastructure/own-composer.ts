import { Duration, Effect, Layer } from "effect";

import { OwnComposer } from "#assistant/application/ports/own-composer.ts";
import { SlideshowFailed } from "#assistant/application/slideshow-failed.ts";
import {
  maxSlideshowBytes,
  slideshowPollInterval,
  slideshowTimeout,
} from "#assistant/domain/slideshow-limits.ts";
import { composeWith } from "#assistant/infrastructure/shotstack/client.ts";
import { OutboundGuard } from "#shared/infrastructure/platforms/outbound-guard.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import { publicFetchWith } from "#shared/infrastructure/platforms/public-http.ts";

/** The most an answer of the service's API may carry: JSON, small. */
export const maxComposerAnswerBytes = 1024 * 1024;

/** How long one request of the API waits. */
const apiRequestTimeout = Duration.seconds(30);

/** How long the video's download waits: up to `maxSlideshowBytes`. */
const downloadTimeout = Duration.minutes(5);

const failWith = (kind: string, reason: SlideshowFailed["reason"]) =>
  Effect.logWarning("A workspace's composition service failed", {
    kind,
    reason,
    source: "workspace",
  }).pipe(Effect.andThen(Effect.fail(new SlideshowFailed({ reason }))));

// A host Peal sends nothing to is the workspace's to fix; one that cannot
// be looked up for now may answer later.
const guardRefused = ({ reason }: OutboundRequestRefused) =>
  reason === "lookupFailed"
    ? failWith("Lookup", "unreachable")
    : failWith("AddressRefused", "addressRefused");

/**
 * OwnComposer on Shotstack's Edit API (`shotstack/client.ts`), outside the
 * AI SDK, which composes nothing: the connection's address checked by the
 * outbound guard before the call, then every request through the guarded
 * fetch (`publicFetchWith`: the guard on each request, no redirect, no
 * trace context), the API's answers bounded at `maxComposerAnswerBytes`
 * and the video's download at `maxSlideshowBytes`. The whole call waits
 * `timeout` (`timedOut` past it, which the service may still bill). The
 * key is `Redacted` until the request's header; logs and the span say
 * `workspace`, the service and the kind of failure, never an address, a
 * caption or the key.
 */
export const ownComposer = ({
  pollInterval = slideshowPollInterval,
  timeout = slideshowTimeout,
}: {
  readonly pollInterval?: Duration.Input;
  readonly timeout?: Duration.Input;
} = {}) =>
  Layer.effect(
    OwnComposer,
    Effect.gen(function* makeOwnComposer() {
      const guard = yield* OutboundGuard;

      const fetches = {
        api: yield* publicFetchWith({
          maxResponseBytes: maxComposerAnswerBytes,
          timeout: apiRequestTimeout,
        }),
        download: yield* publicFetchWith({
          maxResponseBytes: maxSlideshowBytes + 1,
          timeout: downloadTimeout,
        }),
      };

      return OwnComposer.of({
        compose: (endpoint, request) =>
          guard.check(new URL(endpoint.baseUrl)).pipe(
            // The guard's span names the host it refuses.
            Effect.withTracerEnabled(false),
            Effect.catchTag("OutboundRequestRefused", guardRefused),
            Effect.andThen(
              composeWith(fetches, endpoint, request, { pollInterval })
            ),
            // Interrupting the call aborts its request, or its wait.
            Effect.timeoutOrElse({
              duration: Duration.fromInputUnsafe(timeout),
              orElse: () => failWith("Timeout", "timedOut"),
            }),
            Effect.withSpan("OwnComposer.compose", {
              attributes: {
                "peal.assistant.composition_provider": endpoint.provider,
                "peal.assistant.composition_source": "workspace",
              },
            })
          ),
      });
    })
  );

/**
 * OwnComposer as the server runs it: the guard resolves names with the
 * runtime's Dns, which the composition root provides.
 */
export const OwnComposerLive = ownComposer().pipe(
  Layer.provide(OutboundGuard.layer)
);
