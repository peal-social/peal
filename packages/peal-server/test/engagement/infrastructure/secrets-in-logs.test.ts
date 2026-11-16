// What the server writes while it reads and answers Meta's direct
// messages never holds what a person wrote, who wrote it, or the token:
// the adapter runs against the loopback Graph with a logger and a tracer
// that keep everything a line or a span would export, through a read, a
// refused answer, an answer sent, a lost one and a resume.
import { assert, describe, it } from "@effect/vitest";
import {
  Cause,
  DateTime,
  Duration,
  Effect,
  Exit,
  Layer,
  Logger,
  Option,
  Redacted,
  References,
  Tracer,
} from "effect";
import { Mac, SecureRandom } from "effect/crypto";
import { FetchHttpClient } from "effect/http";

import type { ChannelAccount } from "#channels/application/channel-access.ts";
import { metaMessages } from "#engagement/infrastructure/platforms/meta/meta-messages.ts";
import { ChannelIdSchema } from "#shared/domain/ids.ts";
import { facebookMessageScopes } from "#shared/domain/inbox-message-platform.ts";
import { metaHosts } from "#shared/infrastructure/platforms/meta-graph.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";
import { channelAccessOf } from "#test/analytics/access-log.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import {
  fakeMetaMessages,
  graphError,
} from "#test/engagement/fakes/fake-meta-messages.ts";
import { outgoingMessageId } from "#test/engagement/support.ts";
import {
  facebookPageId,
  graphAppSecret,
} from "#test/publishing/fakes/fake-meta-graph.ts";

const token = "synthetic-page-token-secret";

const text = "synthetic private words 4821";

const answer = "synthetic private answer 9173";

const sender = { id: "7299999999999917", name: "Synthetic Writer Name" };

// Everything a span would export, as text.
const spanText = (span: Tracer.NativeSpan): string =>
  [
    span.name,
    JSON.stringify([...span.attributes]),
    JSON.stringify(span.events),
    span.status._tag === "Ended" && Exit.isFailure(span.status.exit)
      ? Cause.pretty(span.status.exit.cause)
      : "",
  ].join("\n");

describe("what the server writes about Meta's direct messages", () => {
  it.live(
    "holds no text, sender or token, through a read, a refusal, a send, a lost answer and a resume",
    () => {
      const lines: string[] = [];
      const spans: Tracer.NativeSpan[] = [];

      const tracer = Tracer.make({
        span: (options) => {
          const span = new Tracer.NativeSpan(options);

          spans.push(span);

          return span;
        },
      });

      const capture = Logger.layer([
        Logger.make(({ cause, fiber, message }) => {
          lines.push(
            JSON.stringify(message),
            Cause.pretty(cause),
            JSON.stringify(fiber.getRef(References.CurrentLogAnnotations)),
            JSON.stringify(fiber.getRef(References.CurrentLogSpans))
          );
        }),
      ]);

      return Effect.gen(function* searched() {
        const graph = yield* fakeMetaMessages([token], { me: facebookPageId });
        const url = new URL(graph.url);

        graph.add({
          id: "c_1",
          messages: [
            {
              createdTime: "2026-11-16T09:00:00+0000",
              from: sender,
              id: "m_1",
              text,
            },
          ],
          participants: [
            { id: sender.id, name: sender.name },
            { id: facebookPageId, name: "Synthetic Page" },
          ],
          platform: "messenger",
          updatedTime: "2026-11-16T09:00:00+0000",
        });

        const account: ChannelAccount = {
          accountId: facebookPageId,
          channelId: ChannelIdSchema.make(
            "01900000-0000-7000-8000-0000000000e8"
          ),
          connection: Option.none(),
          platform: "facebook",
          scopes: [...facebookMessageScopes],
        };

        const platform = yield* Effect.gen(function* building() {
          return yield* metaMessages({
            appSecret: Option.some(Redacted.make(graphAppSecret)),
            hosts: { ...metaHosts, facebookGraph: url, instagramGraph: url },
            http: yield* publicHttpClient,
            pace: Duration.zero,
          });
        }).pipe(
          Effect.provide(
            Layer.mergeAll(
              channelAccessOf(account, [token]),
              FetchHttpClient.layer,
              OpenOutboundGuard,
              Mac.layerWebCrypto.pipe(
                Layer.provide(SecureRandom.layerWebCrypto)
              )
            )
          )
        );

        const outgoing = {
          createdAt: DateTime.makeUnsafe("2026-11-16T09:30:00.000Z"),
          latestPlatformId: Option.none<string>(),
          messageId: outgoingMessageId(1),
          participants: [
            {
              displayName: Option.some(sender.name),
              handle: "",
              platformId: sender.id,
            },
          ],
          platformConversationId: "c_1",
          request: false,
          takenIds: [],
          text: answer,
        };

        yield* platform.read(account, {
          keptSince: DateTime.makeUnsafe("2026-10-17T00:00:00.000Z"),
          known: new Map(),
        });

        graph.script.push("POST /v27.0/me/messages", [
          graphError(10, 2_018_278),
          graphError(200, 2_018_028),
        ]);

        yield* platform.send(account, outgoing);
        yield* platform.send(account, outgoing);
        yield* platform.send(account, outgoing);

        graph.loseAnswer("POST /v27.0/me/messages");

        yield* platform.send(account, outgoing);
        yield* platform.resume(account, outgoing);

        const all = [...lines, ...spans.map(spanText)].join("\n");

        // The calls were written about at all, and the refusals logged.
        assert.isAbove(spans.length, 3);
        assert.include(all, "Meta refused a direct message");

        for (const [name, secret] of [
          ["what the person wrote", text],
          ["what the account answered", answer],
          ["who wrote", sender.id],
          ["the writer's name", sender.name],
          ["the Page's token", token],
        ] as const) {
          assert.notInclude(all, secret, name);
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(
          Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer))
        )
      );
    }
  );
});
