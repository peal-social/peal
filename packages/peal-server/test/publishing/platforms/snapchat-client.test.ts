import { assert, describe, it } from "@effect/vitest";
import {
  Cause,
  Context,
  Effect,
  Exit,
  Layer,
  Logger,
  Option,
  References,
  Tracer,
} from "effect";
import { Cipher, SecureRandom } from "effect/crypto";
import { Base64 } from "effect/encoding";

import type { OutgoingPost } from "#publishing/application/platform-client.ts";
import { SnapchatOptions } from "#publishing/domain/snapchat-options.ts";
import { largeHeldUpload } from "#publishing/infrastructure/upload-slots.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import {
  expiredToken,
  fakeSnapchatApi,
  snapchatProfileId,
  snapPartSize,
  snapRefusal,
} from "#test/publishing/fakes/fake-snapchat-api.ts";
import type {
  FakeSnapMedia,
  SnapRoute,
  SnapScript,
} from "#test/publishing/fakes/fake-snapchat-api.ts";
import {
  dropped,
  empty,
  headerOf,
  json,
} from "#test/publishing/fakes/platform-server.ts";

import {
  attached,
  CredentialLog,
  credentialsOf,
  outgoing,
  snapchatClientWith,
  testFile,
} from "./support.ts";
import type { TestFile } from "./support.ts";

const mebibyte = 1024 * 1024;

const CipherTest = Cipher.layerWebCrypto.pipe(
  Layer.provideMerge(SecureRandom.layerWebCrypto)
);

// Snap, and the client posting to it as the synthetic profile.
const onSnapchat = Effect.fn("test.onSnapchat")(function* onSnapchat(
  options: {
    readonly files?: readonly TestFile[];
    readonly opened?: (
      read: { readonly largeFrom?: number } | undefined
    ) => void;
    readonly snapTokens?: readonly string[];
    readonly timeout?: number;
    readonly tokens?: readonly string[];
  } = {}
) {
  const snapchat = yield* fakeSnapchatApi({
    tokens: options.snapTokens ?? ["token-1", "token-2"],
  });

  const credentials = yield* Layer.build(
    credentialsOf(
      { accountId: snapchatProfileId, platform: "snapchat" },
      options.tokens ?? ["token-1", "token-2"]
    )
  );

  const client = yield* snapchatClientWith({
    api: snapchat.url,
    credentials: Layer.succeedContext(credentials),
    files: options.files ?? [],
    opened: options.opened,
    timeout: options.timeout ?? 10_000,
  });

  return { client, log: Context.get(credentials, CredentialLog), snapchat };
});

const post = (fields: Partial<OutgoingPost>) =>
  outgoing({ ...fields, accountId: snapchatProfileId });

const video = () => testFile("video", 3000);

const bytesOf = (base64: string) => Effect.fromResult(Base64.decode(base64));

// The one media object a test expects Snap to hold.
const onlyMedia = (media: readonly FakeSnapMedia[]): FakeSnapMedia =>
  Option.getOrThrow(Option.fromUndefinedOr(media[0]));

const joined = (object: FakeSnapMedia) => {
  const numbers = [...object.parts.keys()].toSorted((a, b) => a - b);

  const parts = numbers.map(
    (number) => object.parts.get(number) ?? new Uint8Array()
  );

  const whole = new Uint8Array(
    parts.reduce((sum, part) => sum + part.length, 0)
  );

  let offset = 0;

  for (const part of parts) {
    whole.set(part, offset);
    offset += part.length;
  }

  return whole;
};

// What Snap received of a media object, decrypted with its key and IV.
const decrypted = (object: FakeSnapMedia) =>
  Effect.gen(function* decrypting() {
    const cipher = yield* Cipher.Cipher;
    const key = yield* Cipher.key(Cipher.aes256Cbc, yield* bytesOf(object.key));

    return yield* cipher.decrypt(key, joined(object), {
      iv: yield* bytesOf(object.iv),
    });
  }).pipe(Effect.provide(CipherTest));

const resultOf = (
  on: Effect.Success<ReturnType<typeof onSnapchat>>,
  sent: OutgoingPost
) => on.client.publish(sent).pipe(Effect.result);

// Everything a span would export, as text.
const spanText = (span: Tracer.NativeSpan) =>
  [
    span.name,
    JSON.stringify([...span.attributes]),
    JSON.stringify(span.events),
    span.status._tag === "Ended" && Exit.isFailure(span.status.exit)
      ? Cause.pretty(span.status.exit.cause)
      : "",
  ].join("\n");

describe("publishing on Snapchat", () => {
  it.live(
    "makes the media, sends it in parts, finishes it, then posts the Spotlight",
    () =>
      Effect.gen(function* posts() {
        const file = video();
        const on = yield* onSnapchat({ files: [file] });

        const result = yield* on.client.publish(
          yield* post({
            media: [attached(file)],
            options: Option.some(new SnapchatOptions({ locale: "fr_FR" })),
            text: "A synthetic Spotlight #peal",
          })
        );

        assert.deepStrictEqual(result, {
          _tag: "published",
          platformPostId: PlatformPostIdSchema.make("W7_synthetic_spotlight_1"),
        });
        assert.deepStrictEqual(on.snapchat.calls(), [
          "createMedia",
          "add",
          "finalize",
          "spotlight",
        ]);

        const [object] = on.snapchat.media();

        assert.isDefined(object);
        assert.strictEqual(object?.type, "VIDEO");
        assert.strictEqual(
          object?.name,
          "peal-9f86d081884c7d659a2feaa0c55ad015"
        );
        assert.deepStrictEqual(object?.partsSent, [1]);
        assert.isTrue(object?.finalized);
        assert.match(
          object?.finalizedAs ?? "",
          /^multipart\/form-data; boundary=/u
        );
        assert.deepStrictEqual(on.snapchat.spotlights()[0]?.body, {
          description: "A synthetic Spotlight #peal",
          locale: "fr_FR",
          media_id: object?.id,
        });

        // What Snap holds is the file, under the key and IV it was given.
        assert.deepStrictEqual(yield* decrypted(object), file.bytes);
        assert.lengthOf(yield* bytesOf(object.key), 32);
        assert.lengthOf(yield* bytesOf(object.iv), 16);
      })
  );

  it.live(
    "sends en_US when the option is left out, and no description for no text",
    () =>
      Effect.gen(function* defaults() {
        const file = video();
        const on = yield* onSnapchat({ files: [file] });

        yield* on.client.publish(
          yield* post({ media: [attached(file)], text: "  \n " })
        );

        const [spotlight] = on.snapchat.spotlights();

        assert.deepStrictEqual(Object.keys(spotlight?.body ?? {}).toSorted(), [
          "locale",
          "media_id",
        ]);
        assert.strictEqual(spotlight?.body["locale"], "en_US");
      })
  );

  it.live("sends a video whose encryption fits in 32 MiB as one part", () =>
    Effect.gen(function* onePart() {
      const file = testFile("video", 9 * mebibyte);
      const on = yield* onSnapchat({ files: [file] });

      yield* on.client.publish(yield* post({ media: [attached(file)] }));

      const [object] = on.snapchat.media();

      assert.deepStrictEqual(object?.partsSent, [1]);
      assert.strictEqual(object?.parts.get(1)?.length, 9 * mebibyte + 16);
    })
  );

  it.live(
    "cuts a larger video every 32 MiB of its encryption, parts numbered from 1, which decrypt to the file",
    () =>
      Effect.gen(function* inParts() {
        const file = testFile("video", 32 * mebibyte + 3000);
        const on = yield* onSnapchat({ files: [file] });

        yield* on.client.publish(yield* post({ media: [attached(file)] }));

        const [object] = on.snapchat.media();

        assert.deepStrictEqual(object?.partsSent, [1, 2]);
        assert.strictEqual(object?.parts.get(1)?.length, snapPartSize);
        assert.strictEqual(object?.parts.get(2)?.length, 3008);
        assert.deepStrictEqual(
          yield* decrypted(onlyMedia(on.snapchat.media())),
          file.bytes
        );
      })
  );

  it.live(
    "sends again only the part whose token was refused, in the same media object",
    () =>
      Effect.gen(function* lapses() {
        const file = testFile("video", 32 * mebibyte + 3000);
        const on = yield* onSnapchat({ files: [file] });

        on.snapchat.script.push("add", [{ _tag: "own" }, expiredToken]);

        const result = yield* on.client.publish(
          yield* post({ media: [attached(file)] })
        );

        assert.strictEqual(result._tag, "published");
        assert.lengthOf(on.snapchat.media(), 1);
        assert.deepStrictEqual(on.snapchat.media()[0]?.partsSent, [1, 2]);
        assert.deepStrictEqual(on.snapchat.calls(), [
          "createMedia",
          "add",
          "add",
          "add",
          "finalize",
          "spotlight",
        ]);
        assert.strictEqual(yield* on.log.renewals, 1);
        assert.deepStrictEqual(
          yield* decrypted(onlyMedia(on.snapchat.media())),
          file.bytes
        );
      })
  );

  it.live(
    "sends the token to the API's origin only, and follows no other path",
    () =>
      Effect.gen(function* origin() {
        for (const path of [
          `http://192.0.2.1/us/v1/public_profiles/${snapchatProfileId}/media/x/multipart-upload`,
          "/us/v1/public_profiles/11111111-2222-4333-8444-555555555555/media/00000000-0000-4000-8000-000000000001/multipart-upload",
        ]) {
          const file = video();
          const on = yield* onSnapchat({ files: [file] });

          on.snapchat.script.push("createMedia", [{ _tag: "addPath", path }]);

          const result = yield* resultOf(
            on,
            yield* post({ media: [attached(file)] })
          );

          assert.isTrue(result._tag === "Failure");
          assert.strictEqual(
            result._tag === "Failure" ? result.failure._tag : "",
            "PlatformUnavailable"
          );
          assert.deepStrictEqual(on.snapchat.calls(), ["createMedia"]);
        }
      })
  );

  it.live(
    "reads the video as a large upload from 4 MiB on, its parts holding it whole",
    () =>
      Effect.gen(function* slotted() {
        const file = video();
        const reads: (number | undefined)[] = [];

        const on = yield* onSnapchat({
          files: [file],
          opened: (read) => {
            reads.push(read?.largeFrom);
          },
        });

        yield* on.client.publish(yield* post({ media: [attached(file)] }));

        assert.deepStrictEqual(reads, [largeHeldUpload]);
      })
  );

  it.live("follows a path that names the profile in capitals", () =>
    Effect.gen(function* capitals() {
      const file = video();
      const on = yield* onSnapchat({ files: [file] });

      on.snapchat.script.push("createMedia", [
        {
          _tag: "addPath",
          path: `/us/v1/public_profiles/${snapchatProfileId.toUpperCase()}/media/00000000-0000-4000-8000-000000000001/multipart-upload`,
        },
      ]);

      const result = yield* on.client.publish(
        yield* post({ media: [attached(file)] })
      );

      assert.strictEqual(result._tag, "published");
    })
  );

  it.live("refuses, unsent, a post Snapchat cannot show", () =>
    Effect.gen(function* unsent() {
      const image = testFile("image", 2000);
      const first = video();
      const second = video();
      const emptyVideo = testFile("video", 0);
      const quicktime = testFile("video", 2000, "video/quicktime");

      const on = yield* onSnapchat({
        files: [image, first, second, emptyVideo, quicktime],
      });

      for (const [media, code] of [
        [[], "mediaRequired"],
        [[attached(image)], "unsupportedType"],
        [[attached(first), attached(second)], "unsupportedType"],
        [[attached(emptyVideo)], "unsupportedType"],
        [[attached(quicktime)], "unsupportedType"],
      ] as const) {
        const result = yield* resultOf(on, yield* post({ media }));

        assert.deepStrictEqual(
          result._tag === "Failure"
            ? [
                result.failure._tag,
                "code" in result.failure ? result.failure.code : undefined,
              ]
            : [],
          ["MediaRejected", code]
        );
      }

      const otherAccount = yield* on.client
        .publish(
          yield* outgoing({ accountId: "../me", media: [attached(first)] })
        )
        .pipe(Effect.flip);

      assert.deepStrictEqual(
        [
          otherAccount._tag,
          otherAccount._tag === "BadRequest" ? otherAccount.code : "",
        ],
        ["BadRequest", "snapchat:invalidProfileId"]
      );
      assert.deepStrictEqual(on.snapchat.calls(), []);
    })
  );

  it.live(
    "renews a token Snap refused once, and posts the Spotlight once",
    () =>
      Effect.gen(function* renews() {
        const file = video();
        const on = yield* onSnapchat({ files: [file] });

        on.snapchat.script.push("spotlight", [expiredToken]);

        const result = yield* on.client.publish(
          yield* post({ media: [attached(file)] })
        );

        assert.strictEqual(result._tag, "published");
        assert.lengthOf(on.snapchat.spotlights(), 1);
        assert.strictEqual(yield* on.log.renewals, 1);
      })
  );

  it.live("asks to reconnect when the renewed token is refused too", () =>
    Effect.gen(function* reconnect() {
      const file = video();
      const on = yield* onSnapchat({ files: [file], snapTokens: [] });

      const failure = yield* on.client
        .publish(yield* post({ media: [attached(file)] }))
        .pipe(Effect.flip);

      assert.strictEqual(failure._tag, "TokenExpired");
    })
  );

  it.live("fails the post, never the channel, on Snap's own 401 and 403", () =>
    Effect.gen(function* refusals() {
      for (const [answer, tag, code] of [
        [
          snapRefusal("SYNTHETIC_UNAUTHORIZED", 401),
          "BadRequest",
          "snapchat:SYNTHETIC_UNAUTHORIZED",
        ],
        [
          snapRefusal("AUTHORIZATION_PERMISSION_DENIED", 403),
          "BadRequest",
          "snapchat:AUTHORIZATION_PERMISSION_DENIED",
        ],
        [empty(401), "PlatformUnavailable", undefined],
        [
          empty(403, { "content-type": "text/html" }),
          "PlatformUnavailable",
          undefined,
        ],
      ] as const) {
        const file = video();
        const on = yield* onSnapchat({ files: [file] });

        on.snapchat.script.push("createMedia", [answer]);

        const failure = yield* on.client
          .publish(yield* post({ media: [attached(file)] }))
          .pipe(Effect.flip);

        assert.strictEqual(failure._tag, tag);
        assert.strictEqual("code" in failure ? failure.code : undefined, code);
        assert.strictEqual(yield* on.log.renewals, 0);
      }
    })
  );

  it.live("waits as long as Snap's rate limit says", () =>
    Effect.gen(function* limited() {
      const file = video();
      const on = yield* onSnapchat({ files: [file] });

      on.snapchat.script.push("createMedia", [
        empty(429, { "retry-after": "120" }),
      ]);

      const failure = yield* on.client
        .publish(yield* post({ media: [attached(file)] }))
        .pipe(Effect.flip);

      assert.strictEqual(failure._tag, "RateLimited");
      assert.isTrue(
        failure._tag === "RateLimited" && failure.retryAfter !== undefined
      );
    })
  );

  it.live("tells the media's refusal from the post's", () =>
    Effect.gen(function* refusedWhat() {
      for (const [route, answer, tag, code] of [
        [
          "spotlight",
          snapRefusal("MEDIA_INVALID", 400),
          "MediaRejected",
          "snapchat:MEDIA_INVALID",
        ],
        [
          "spotlight",
          snapRefusal("VALIDATION_ERROR_INVALID_SPOTLIGHT_LINK", 400),
          "BadRequest",
          "snapchat:VALIDATION_ERROR_INVALID_SPOTLIGHT_LINK",
        ],
        [
          "add",
          snapRefusal("SYNTHETIC_PART_REFUSED", 400),
          "MediaRejected",
          "snapchat:SYNTHETIC_PART_REFUSED",
        ],
        // A 200 that says ERROR is a refusal, not a success.
        [
          "finalize",
          snapRefusal("SYNTHETIC_FINALIZE_REFUSED", 200),
          "MediaRejected",
          "snapchat:SYNTHETIC_FINALIZE_REFUSED",
        ],
        [
          "createMedia",
          snapRefusal("SYNTHETIC_PROFILE_GONE", 200),
          "BadRequest",
          "snapchat:SYNTHETIC_PROFILE_GONE",
        ],
        [
          "createMedia",
          snapRefusal("not a plain code!", 400),
          "BadRequest",
          "snapchat:refused",
        ],
        ["createMedia", empty(418), "BadRequest", "http418"],
      ] as const satisfies readonly (readonly [
        SnapRoute,
        SnapScript,
        string,
        string,
      ])[]) {
        const file = video();
        const on = yield* onSnapchat({ files: [file] });

        on.snapchat.script.push(route, [answer]);

        const failure = yield* on.client
          .publish(yield* post({ media: [attached(file)] }))
          .pipe(Effect.flip);

        assert.deepStrictEqual(
          [failure._tag, "code" in failure ? failure.code : undefined],
          [tag, code]
        );
      }
    })
  );

  it.live(
    "is unavailable when an upload call is not answered, and makes nothing",
    () =>
      Effect.gen(function* unanswered() {
        for (const [route, answer] of [
          ["createMedia", dropped],
          ["add", empty(503)],
          ["finalize", json({ synthetic: "not Snap's" })],
        ] as const satisfies readonly (readonly [SnapRoute, SnapScript])[]) {
          const file = video();
          const on = yield* onSnapchat({ files: [file] });

          on.snapchat.script.push(route, [answer]);

          const failure = yield* on.client
            .publish(yield* post({ media: [attached(file)] }))
            .pipe(Effect.flip);

          assert.strictEqual(failure._tag, "PlatformUnavailable");
          assert.lengthOf(on.snapchat.spotlights(), 0);
        }
      })
  );

  it.live(
    "leaves a Spotlight whose answer says nothing unconfirmed, and never posts it twice",
    () =>
      Effect.gen(function* unknown() {
        for (const [answer, reason] of [
          [empty(502), "noResponse"],
          [snapRefusal("SYNTHETIC_DOWN", 500), "noResponse"],
          [dropped, "noResponse"],
          [{ _tag: "late", after: 1500, answer: json({}) }, "noResponse"],
          [json({ request_status: "SUCCESS" }), "unreadableResponse"],
          [json({ synthetic: "not Snap's" }), "unreadableResponse"],
          [empty(409), "unreadableResponse"],
          [snapRefusal("MEDIA_POSTING_ALREADY_IN_PROGRESS", 400), "noResponse"],
        ] as const satisfies readonly (readonly [SnapScript, string])[]) {
          const file = video();
          const on = yield* onSnapchat({ files: [file], timeout: 1000 });

          on.snapchat.script.push("spotlight", [answer]);

          const result = yield* on.client.publish(
            yield* post({ media: [attached(file)] })
          );

          assert.deepStrictEqual(result, { _tag: "unconfirmed", reason });
          assert.strictEqual(
            on.snapchat.calls().filter((call) => call === "spotlight").length,
            1
          );
        }
      })
  );

  it.live("answers a resumed run unconfirmed, without a call", () =>
    Effect.gen(function* resumes() {
      const file = video();
      const on = yield* onSnapchat({ files: [file] });

      const result = yield* on.client.resume(
        yield* post({ media: [attached(file)] })
      );

      assert.deepStrictEqual(result, {
        _tag: "unconfirmed",
        reason: "interrupted",
      });
      assert.deepStrictEqual(on.snapchat.calls(), []);
    })
  );

  it.live("sends the token only as the bearer, to the API's host", () =>
    Effect.gen(function* bearer() {
      const file = video();
      const on = yield* onSnapchat({ files: [file] });

      yield* on.client.publish(yield* post({ media: [attached(file)] }));

      for (const request of on.snapchat.requests()) {
        assert.strictEqual(
          headerOf(request, "authorization"),
          "Bearer token-1"
        );
      }

      assert.isTrue(
        on.snapchat
          .requests()
          .filter(({ path }) => path.endsWith("/media"))
          .every((request) =>
            headerOf(request, "content-type").startsWith("application/json")
          )
      );
    })
  );

  it.live(
    "never logs or traces the key, the IV or the token, whatever fails",
    () =>
      Effect.gen(function* secrets() {
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
              JSON.stringify(fiber.getRef(References.CurrentLogAnnotations))
            );
          }),
        ]);

        const secretsSeen: string[] = [];

        for (const [route, answer] of [
          ["createMedia", dropped],
          ["createMedia", empty(500)],
          ["createMedia", snapRefusal("SYNTHETIC", 400)],
          ["add", dropped],
          ["add", snapRefusal("SYNTHETIC", 400)],
          ["finalize", dropped],
          ["spotlight", dropped],
          ["spotlight", snapRefusal("SYNTHETIC", 400)],
        ] as const satisfies readonly (readonly [SnapRoute, SnapScript])[]) {
          const file = video();
          const on = yield* onSnapchat({ files: [file] });

          on.snapchat.script.push(route, [answer]);

          yield* on.client
            .publish(yield* post({ media: [attached(file)] }))
            .pipe(
              Effect.exit,
              Effect.withSpan("test.publish"),
              Effect.provide(
                Layer.merge(capture, Layer.succeed(Tracer.Tracer, tracer))
              )
            );

          // Every create request's, those the script refused included.
          for (const { iv, key } of on.snapchat.created()) {
            secretsSeen.push(key, iv);
          }
        }

        const written = [...lines, ...spans.map(spanText)].join("\n");

        assert.isAbove(spans.length, 8);
        // A key and an IV for each of the eight runs.
        assert.strictEqual(secretsSeen.length, 16);

        for (const secret of [...secretsSeen, "token-1", "token-2"]) {
          assert.notInclude(written, secret);
        }
      })
  );
});
