import { assert, describe, it } from "@effect/vitest";
import {
  Context,
  Duration,
  Effect,
  Layer,
  Logger,
  Option,
  References,
} from "effect";
import { FetchHttpClient } from "effect/http";

import { PlatformCredentials } from "#publishing/application/platform-credentials.ts";
import { TikTokCreators } from "#publishing/application/tiktok-creators.ts";
import type { CreatorFailure } from "#publishing/application/tiktok-creators.ts";
import { ownRefusalCodes } from "#publishing/domain/own-refusals.ts";
import { tiktokCreatorsWith } from "#publishing/infrastructure/platforms/tiktok/tiktok-creators.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import { RateLimited } from "#shared/domain/rate-limited.ts";
import { TokenExpired } from "#shared/domain/token-expired.ts";
import { OpenOutboundGuard } from "#test/channels/support.ts";
import {
  fakeTikTokApi,
  tiktokAccountId,
  tiktokToken,
} from "#test/publishing/fakes/fake-tiktok-api.ts";
import { json } from "#test/publishing/fakes/platform-server.ts";
import type { PlatformAnswer } from "#test/publishing/fakes/platform-server.ts";

import { channelId, CredentialLog, credentialsOf } from "./support.ts";

const creatorInfo = "POST /v2/post/publish/creator_info/query/";

// An answer of TikTok's v2 API refusing with `code`.
const refusal = (
  code: string,
  status: number,
  headers: Readonly<Record<string, string>> = {}
): PlatformAnswer =>
  json(
    {
      error: { code, log_id: "20261125000000SYNTHETIC", message: "Synthetic." },
    },
    status,
    headers
  );

// What the adapter logged, with the code it named.
interface Logged {
  readonly code: unknown;
  readonly message: unknown;
}

// TikTok's creator info, read through the adapter with `tokens` handed out
// as the channels context would, TikTok answering `answers` first.
const onTikTok = Effect.fn("test.creatorsOnTikTok")(function* onTikTok(
  options: {
    readonly answers?: readonly PlatformAnswer[];
    readonly tokens?: readonly string[];
  } = {}
) {
  const tiktok = yield* fakeTikTokApi();

  tiktok.failNext(creatorInfo, options.answers ?? []);

  const credentials = yield* Layer.build(
    credentialsOf(
      { accountId: tiktokAccountId, platform: "tiktok" },
      options.tokens ?? [tiktokToken]
    )
  );

  const creators = yield* Layer.build(
    tiktokCreatorsWith({
      apiUrl: new URL(tiktok.url),
      pullFrom: Option.none(),
    }).pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeedContext(credentials),
          FetchHttpClient.layer,
          OpenOutboundGuard
        )
      )
    )
  );

  const logs: Logged[] = [];

  const capture = Logger.layer([
    Logger.make(({ fiber, message }) => {
      const annotations = fiber.getRef(References.CurrentLogAnnotations);

      logs.push({ code: annotations["code"], message });
    }),
  ]);

  return {
    log: Context.get(credentials, CredentialLog),
    logs,
    read: Context.get(creators, TikTokCreators)
      .read(channelId)
      .pipe(Effect.provide(capture)),
    tiktok,
  };
});

// What reading failed with, whatever it was.
const failureOf = (read: Effect.Effect<unknown, CreatorFailure>) =>
  read.pipe(Effect.flip);

describe("TikTok's creators, read for the composer and the lookups", () => {
  it.effect("renews a token TikTok refused, and reads with the new one", () =>
    Effect.gen(function* renewed() {
      const { log, read } = yield* onTikTok({
        tokens: ["act.synthetic-expired", tiktokToken],
      });

      const posting = yield* read;

      assert.strictEqual(posting._tag, "ready");
      assert.strictEqual(yield* log.renewals, 1);
    })
  );

  it.effect(
    "asks for a reconnect when the renewed token is refused too, as an expired grant is",
    () =>
      Effect.gen(function* expired() {
        const { log, read } = yield* onTikTok({
          tokens: ["act.synthetic-expired", "act.synthetic-revoked"],
        });

        assert.deepStrictEqual(yield* failureOf(read), new TokenExpired());
        assert.strictEqual(yield* log.renewals, 1);
      })
  );

  it.effect("asks for a reconnect when the grant lacks a scope", () =>
    Effect.gen(function* scopeMissing() {
      const { read } = yield* onTikTok({
        answers: [refusal("scope_not_authorized", 401)],
      });

      assert.deepStrictEqual(yield* failureOf(read), new TokenExpired());
    })
  );

  it.effect("says how long TikTok asked to wait", () =>
    Effect.gen(function* limited() {
      const { read } = yield* onTikTok({
        answers: [refusal("rate_limit_exceeded", 429, { "retry-after": "30" })],
      });

      assert.deepStrictEqual(
        yield* failureOf(read),
        new RateLimited({ retryAfter: Duration.seconds(30) })
      );
    })
  );

  it.effect("waits an hour for a cap of the day", () =>
    Effect.gen(function* capped() {
      const { read } = yield* onTikTok({
        answers: [refusal("spam_risk_too_many_pending_share", 403)],
      });

      assert.deepStrictEqual(
        yield* failureOf(read),
        new RateLimited({ retryAfter: Duration.hours(1) })
      );
    })
  );

  it.effect("finds TikTok unavailable when it fails on its side", () =>
    Effect.gen(function* down() {
      const { read } = yield* onTikTok({
        answers: [refusal("internal_error", 500)],
      });

      assert.deepStrictEqual(yield* failureOf(read), new PlatformUnavailable());
    })
  );

  it.effect(
    "takes TikTok's refusal of the read for TikTok's doing, never the channel's, and logs its code",
    () =>
      Effect.gen(function* refused() {
        for (const [answer, code] of [
          [
            refusal("unaudited_client_can_only_post_to_private_accounts", 403),
            "appNotAudited",
          ],
          [refusal("invalid_params", 400), "invalid_params"],
          // A code that is no identifier is never logged as TikTok wrote
          // it: the status names the refusal instead.
          [refusal("invalid\u0000params\uD800", 403), "http403"],
        ] as const) {
          const { logs, read } = yield* onTikTok({ answers: [answer] });

          assert.deepStrictEqual(
            yield* failureOf(read),
            new PlatformUnavailable()
          );
          assert.deepStrictEqual(logs, [
            { code, message: ["TikTok refused to read a creator's settings"] },
          ]);
        }
      })
  );

  it.effect("passes on a channel the channels context will not hand out", () =>
    Effect.gen(function* unusable() {
      const tiktok = yield* fakeTikTokApi();

      const creators = yield* Layer.build(
        tiktokCreatorsWith({
          apiUrl: new URL(tiktok.url),
          pullFrom: Option.none(),
        }).pipe(
          Layer.provide(
            Layer.mergeAll(
              Layer.succeed(
                PlatformCredentials,
                PlatformCredentials.of({
                  account: () =>
                    Effect.fail(
                      new BadRequest({ code: ownRefusalCodes.channelDisabled })
                    ),
                  withToken: () =>
                    Effect.fail(
                      new BadRequest({ code: ownRefusalCodes.channelDisabled })
                    ),
                })
              ),
              FetchHttpClient.layer,
              OpenOutboundGuard
            )
          )
        )
      );

      const failure = yield* Context.get(creators, TikTokCreators)
        .read(channelId)
        .pipe(Effect.flip);

      assert.deepStrictEqual(
        failure,
        new BadRequest({ code: ownRefusalCodes.channelDisabled })
      );
      assert.deepStrictEqual(tiktok.requests(), []);
    })
  );
});
