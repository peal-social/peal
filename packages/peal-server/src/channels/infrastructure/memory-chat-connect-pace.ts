import { Effect, Layer } from "effect";
import { RateLimiter } from "effect/persistence";

import { ChatConnectLimited } from "#channels/application/chat-connect-limited.ts";
import { ChatConnectPace } from "#channels/application/chat-connect-pace.ts";

// The tries a workspace has an hour: enough to fix a mistyped address or
// token many times over.
const triesPerHour = 30;

/** ChatConnectPace counted in this process, per workspace and hour. */
export const MemoryChatConnectPace = Layer.effect(
  ChatConnectPace,
  Effect.gen(function* MemoryChatConnectPace() {
    const limiter = yield* RateLimiter.make;

    return ChatConnectPace.of({
      take: (workspaceId) =>
        limiter
          .consume({
            algorithm: "fixed-window",
            key: `chat-connect:${workspaceId}`,
            limit: triesPerHour,
            onExceeded: "fail",
            window: "1 hour",
          })
          .pipe(
            Effect.asVoid,
            Effect.catchTag("RateLimiterError", (limited) =>
              limited.reason._tag === "RateLimitExceeded"
                ? Effect.fail(new ChatConnectLimited())
                : Effect.die(limited)
            )
          ),
    });
  })
).pipe(Layer.provide(RateLimiter.layerStoreMemory));
