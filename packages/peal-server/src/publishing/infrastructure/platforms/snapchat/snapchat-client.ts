import { Effect, Option, Schema, Stream } from "effect";
import type { Redacted } from "effect";
import { Cipher, SecureRandom } from "effect/crypto";
import { Base64 } from "effect/encoding";
import { HttpClientRequest, HttpClientResponse } from "effect/http";
import type { HttpClient, HttpClientError } from "effect/http";

import { MediaForPublishing } from "#publishing/application/media-for-publishing.ts";
import { OutcomeUnknown } from "#publishing/application/outcome-unknown.ts";
import type { OutgoingPost } from "#publishing/application/platform-client.ts";
import { PlatformCredentials } from "#publishing/application/platform-credentials.ts";
import {
  defaultStepTiming,
  sequenced,
} from "#publishing/application/publication-steps.ts";
import type {
  PublicationSteps,
  Readiness,
  StepTiming,
} from "#publishing/application/publication-steps.ts";
import {
  defaultSnapchatLocale,
  SnapchatOptions,
} from "#publishing/domain/snapchat-options.ts";
import {
  commitUnanswered,
  unanswered,
} from "#publishing/infrastructure/platforms/platform-exchange.ts";
import { BadRequest } from "#shared/domain/bad-request.ts";
import { MediaRejected } from "#shared/domain/media-rejected.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import type { PublishFailure } from "#shared/domain/publish-failure.ts";
import { PlatformPostIdSchema } from "#shared/domain/publish-result.ts";
import type { Published } from "#shared/domain/publish-result.ts";
import type { TokenRejected } from "#shared/domain/token-rejected.ts";
import {
  multipartBody,
  multipartFormBody,
  randomBoundary,
} from "#shared/infrastructure/platforms/multipart-stream.ts";
import type { MultipartFile } from "#shared/infrastructure/platforms/multipart-stream.ts";
import type { OutboundRequestRefused } from "#shared/infrastructure/platforms/outbound-request-refused.ts";
import { streamedBody } from "#shared/infrastructure/platforms/public-http.ts";
import {
  isProfileId,
  snapchatEnvelopeOf,
  succeeded,
} from "#shared/infrastructure/platforms/snapchat-api.ts";

import { encryptedParts, snapchatPartSize } from "./snapchat-encryption.ts";
import { refused } from "./snapchat-refusal.ts";
import type { SnapchatCall, SnapchatRefusal } from "./snapchat-refusal.ts";

/** The HTTP client the adapter sends through: the public one. */
export type SnapchatHttp = HttpClient.HttpClient.With<
  HttpClientError.HttpClientError | OutboundRequestRefused
>;

export interface SnapchatClientOptions {
  /** For making the media object. */
  readonly api: SnapchatHttp;
  /** The Business API's origin: `https://businessapi.snapchat.com`. */
  readonly apiUrl: URL;
  /**
   * For posting the Spotlight: a slow answer there is unconfirmed, which a
   * member must check by hand, so it is waited for longer than a plain
   * call (two minutes in production).
   */
  readonly spotlights: SnapchatHttp;
  readonly timing?: StepTiming;
  /**
   * For the parts of a video and the finish, which may put up to 1 GB
   * together on Snap's side (ten minutes in production).
   */
  readonly uploads: SnapchatHttp;
}

/** What `prepare` made: the media object the Spotlight is posted with. */
interface SnapchatMedia {
  readonly mediaId: string;
}

// Reading an answer's body fails with these.
type AnswerError = HttpClientError.HttpClientError | Schema.SchemaError;

// The one file a Spotlight takes: "Video should be in .mp4 format".
const videoType = "video/mp4";

const keyLength = 32;

const ivLength = 16;

// The media object's name: derived from the attempt, never from what the
// member wrote.
const nameLength = 32;

// create media's answer: the object, and where its parts and its finish go.
const CreatedMediaSchema = Schema.Struct({
  add_path: Schema.NonEmptyString,
  finalize_path: Schema.NonEmptyString,
  media_id: Schema.NonEmptyString,
  request_status: Schema.String,
});

// Post Spotlight's answer.
const SpotlightSchema = Schema.Struct({
  request_status: Schema.String,
  spotlight_id: Schema.optionalKey(Schema.String),
});

// The error code Snap answers a second request for media it is posting:
// the first "will complete on its own".
const postingInProgress = "MEDIA_POSTING_ALREADY_IN_PROGRESS";

// FINALIZE's form: its one field, and no file.
const noFiles: readonly MultipartFile<never, never>[] = [];

const isSuccess = (response: HttpClientResponse.HttpClientResponse) =>
  response.status >= 200 && response.status < 300;

// An answer of an upload call: a success only when it is 2xx and its body
// says SUCCESS. A 2xx Snap's envelope cannot be read in shows nowhere, and
// may be made again.
const acknowledged =
  (call: SnapchatCall) =>
  (
    response: HttpClientResponse.HttpClientResponse
  ): Effect.Effect<void, SnapchatRefusal> =>
    snapchatEnvelopeOf(response).pipe(
      Effect.flatMap((envelope) => {
        if (isSuccess(response) && Option.isNone(envelope)) {
          return Effect.fail(new PlatformUnavailable());
        }

        return isSuccess(response) && Option.exists(envelope, succeeded)
          ? Effect.void
          : refused(response, call);
      })
    );

const created = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<
  typeof CreatedMediaSchema.Type,
  AnswerError | SnapchatRefusal
> =>
  acknowledged("createMedia")(response).pipe(
    Effect.andThen(
      HttpClientResponse.schemaBodyJson(CreatedMediaSchema)(response)
    )
  );

// The address a path Snap answered resolves to, only when it is on the
// API's origin and names this profile's media object: the member's token
// goes there, and an answer must not be able to send it elsewhere.
const uploadUrlOf = (
  path: string,
  apiUrl: URL,
  accountId: string,
  mediaId: string
): Option.Option<URL> =>
  Option.fromNullishOr(URL.parse(path, apiUrl.href)).pipe(
    Option.filter(
      (url) =>
        url.origin === apiUrl.origin &&
        // Ids are compared whatever their case: a UUID reads the same in
        // either, and Snap's samples write them in lower case.
        url.pathname
          .toLowerCase()
          .endsWith(
            `/public_profiles/${accountId}/media/${mediaId}/multipart-upload`.toLowerCase()
          )
    )
  );

const localeOf = (post: OutgoingPost) =>
  post.options.pipe(
    Option.filter(Schema.is(SnapchatOptions)),
    Option.flatMap(({ locale }) => Option.fromUndefinedOr(locale)),
    Option.getOrElse(() => defaultSnapchatLocale)
  );

/** What Post Spotlight takes of a post. */
interface NewSpotlight {
  description?: string;
  readonly locale: string;
  readonly media_id: string;
}

// What Post Spotlight takes of the post: the video, the locale and, when
// the post has any text, its description. No link, caption or schedule.
const spotlightOf = (post: OutgoingPost, mediaId: string) => {
  const spotlight: NewSpotlight = {
    locale: localeOf(post),
    media_id: mediaId,
  };

  if (post.text.trim() !== "") {
    spotlight.description = post.text;
  }

  return spotlight;
};

// What the Spotlight call answered. A server's error, Snap saying the
// same media is being posted already, or an answer nobody can read
// says nothing of whether the Spotlight was made: it is never sent
// again.
const spotlightAnswer = (
  response: HttpClientResponse.HttpClientResponse
): Effect.Effect<Published, AnswerError | OutcomeUnknown | SnapchatRefusal> =>
  Effect.gen(function* answering() {
    if (response.status >= 500) {
      return yield* new OutcomeUnknown({ reason: "noResponse" });
    }

    const envelope = yield* snapchatEnvelopeOf(response);

    if (
      Option.exists(
        envelope,
        ({ error_code }) => error_code === postingInProgress
      )
    ) {
      return yield* new OutcomeUnknown({ reason: "noResponse" });
    }

    if (isSuccess(response)) {
      if (Option.isSome(envelope) && !succeeded(envelope.value)) {
        return yield* refused(response, "spotlight");
      }

      const answer = yield* HttpClientResponse.schemaBodyJson(SpotlightSchema)(
        response
      ).pipe(
        Effect.mapError(
          () => new OutcomeUnknown({ reason: "unreadableResponse" })
        )
      );

      const id = (answer.spotlight_id ?? "").trim();

      if (!succeeded(answer) || id === "") {
        return yield* new OutcomeUnknown({ reason: "unreadableResponse" });
      }

      const published: Published = {
        _tag: "published",
        platformPostId: PlatformPostIdSchema.make(id),
      };

      return published;
    }

    // A bare answer of a server on the way (a 408, a 409, a 502) says
    // nothing of Snap refusing the Spotlight.
    if (Option.isNone(envelope) && ![401, 403, 429].includes(response.status)) {
      return yield* new OutcomeUnknown({ reason: "unreadableResponse" });
    }

    return yield* refused(response, "spotlight");
  });

/**
 * Publishes on a Snapchat Public Profile as a Spotlight, through Snap's
 * Public Profile API (developers.snap.com, Profile Asset Management, read
 * 2026-11-26). `prepare` makes the media: it encrypts the video with
 * AES-256-CBC under a key and an IV drawn for the run, makes the media
 * object with them (`POST …/media`), sends the ciphertext in parts to the
 * object's `add_path` as multipart forms (`action=ADD`, `part_number` from
 * 1, then the file), one request each with a token of its own, so a token
 * that lapses during the upload sends that part again alone, and finishes
 * it at `finalize_path` (`action=FINALIZE`, a form too). Nothing of it
 * shows anywhere: a new run makes a new object. `commit` posts the
 * Spotlight (`POST …/spotlights`) with the object, the options' `locale`
 * (`en_US` left out) and the text as its description; Snap answers its
 * `spotlight_id`, published at once while Snap reviews it, without a
 * permalink, as no page read gives a Spotlight's address.
 *
 * Confirmation is `none`: nothing documented reads a Spotlight back by a
 * key of Peal's, and which field of the listing holds the description is
 * unverified, so an unknown outcome is unconfirmed at once and a Spotlight
 * is never sent twice. The cost: a run cut short anywhere, during the
 * upload too, resumes as unconfirmed `interrupted`, although nothing can
 * have gone out before the commit.
 *
 * The key and the IV travel in the create call's body alone: its transport
 * errors are turned into the adapter's own failures where they happen, and
 * neither is ever logged or traced.
 */
export const snapchatClient = Effect.fn("SnapchatClient.make")(
  function* snapchatClient(options: SnapchatClientOptions) {
    const credentials = yield* PlatformCredentials;
    const media = yield* MediaForPublishing;
    const random = yield* SecureRandom.SecureRandom;
    const cipher = yield* Cipher.Cipher;
    const { api, apiUrl, spotlights, uploads } = options;

    const profileUrl = (accountId: string, rest: string) =>
      new URL(`/v1/public_profiles/${accountId}${rest}`, apiUrl);

    // Sends one request with the channel's token, renewed once if refused.
    // Without an answer, nothing anyone sees happened.
    const call = <A>(
      post: OutgoingPost,
      client: SnapchatHttp,
      request: (
        token: Redacted.Redacted
      ) => HttpClientRequest.HttpClientRequest,
      answer: (
        response: HttpClientResponse.HttpClientResponse
      ) => Effect.Effect<A, AnswerError | PublishFailure | TokenRejected>
    ) =>
      credentials.withToken(post.channelId, ({ accessToken }) =>
        client.execute(request(accessToken)).pipe(
          Effect.flatMap((response) =>
            answer(response).pipe(
              Effect.catchTags({
                HttpClientError: unanswered,
                SchemaError: unanswered,
              })
            )
          ),
          Effect.catchTags({
            HttpClientError: unanswered,
            OutboundRequestRefused: unanswered,
          })
        )
      );

    // The one video, checked before any call: Snap takes one MP4 alone.
    const videoOf = Effect.fn("SnapchatClient.video")(function* videoOf(
      post: OutgoingPost
    ) {
      const [attachment, ...others] = post.media;

      if (attachment === undefined) {
        return yield* new MediaRejected({ code: "mediaRequired" });
      }

      if (others.length > 0) {
        return yield* new MediaRejected({ code: "unsupportedType" });
      }

      // The profile's id goes into every path: nothing that would need
      // encoding there.
      if (!isProfileId(post.accountId)) {
        return yield* new BadRequest({ code: "snapchat:invalidProfileId" });
      }

      const described = yield* media.describe(
        post.workspaceId,
        attachment.mediaId
      );

      if (
        described.kind !== "video" ||
        described.contentType !== videoType ||
        described.byteSize <= 0
      ) {
        return yield* new MediaRejected({ code: "unsupportedType" });
      }

      return { attachment, described };
    });

    // Makes the media object, with the key and the IV in its body.
    const createMedia = (post: OutgoingPost, key: Uint8Array, iv: Uint8Array) =>
      call(
        post,
        api,
        (token) =>
          HttpClientRequest.post(profileUrl(post.accountId, "/media")).pipe(
            HttpClientRequest.bearerToken(token),
            HttpClientRequest.bodyJsonUnsafe({
              iv: Base64.encode(iv),
              key: Base64.encode(key),
              name: `peal-${post.idempotencyKey.slice(0, nameLength)}`,
              type: "VIDEO",
            })
          ),
        created
      );

    // One part, as a form of its own: the fields, then the file.
    const addPart =
      (post: OutgoingPost, addUrl: URL) =>
      ({
        bytes,
        number,
      }: {
        readonly bytes: Uint8Array;
        readonly number: number;
      }) =>
        call(
          post,
          uploads,
          (token) => {
            const part: Stream.Stream<Uint8Array> = Stream.make(bytes);

            const form = multipartBody({
              boundary: randomBoundary(),
              fields: [
                { name: "action", value: "ADD" },
                { name: "part_number", value: String(number) },
              ],
              file: {
                byteSize: bytes.length,
                bytes: part,
                contentType: "application/octet-stream",
                fileName: `part-${number}`,
                name: "file",
              },
            });

            return HttpClientRequest.post(addUrl).pipe(
              HttpClientRequest.bearerToken(token),
              streamedBody(form.bytes, {
                contentLength: form.contentLength,
                contentType: form.contentType,
              })
            );
          },
          acknowledged("upload")
        );

    const finalize = (post: OutgoingPost, finalizeUrl: URL) =>
      call(
        post,
        uploads,
        (token) => {
          const form = multipartFormBody({
            boundary: randomBoundary(),
            fields: [{ name: "action", value: "FINALIZE" }],
            files: noFiles,
          });

          return HttpClientRequest.post(finalizeUrl).pipe(
            HttpClientRequest.bearerToken(token),
            streamedBody(form.bytes, {
              contentLength: form.contentLength,
              contentType: form.contentType,
            })
          );
        },
        acknowledged("upload")
      );

    const prepare = Effect.fn("SnapchatClient.prepare")(function* prepare(
      post: OutgoingPost
    ) {
      const { attachment, described } = yield* videoOf(post);

      // New for every run: a media object is made again each time.
      const key = yield* random.randomBytes(keyLength).pipe(Effect.orDie);
      const iv = yield* random.randomBytes(ivLength).pipe(Effect.orDie);

      const object = yield* createMedia(post, key, iv);

      const addUrl = uploadUrlOf(
        object.add_path,
        apiUrl,
        post.accountId,
        object.media_id
      );

      const finalizeUrl = uploadUrlOf(
        object.finalize_path,
        apiUrl,
        post.accountId,
        object.media_id
      );

      if (Option.isNone(addUrl) || Option.isNone(finalizeUrl)) {
        return yield* new PlatformUnavailable();
      }

      yield* media.open(post.workspaceId, attachment.mediaId).pipe(
        encryptedParts({
          byteSize: described.byteSize,
          iv,
          key,
          partSize: snapchatPartSize,
        }),
        Stream.provideService(Cipher.Cipher, cipher),
        Stream.mapEffect(addPart(post, addUrl.value)),
        Stream.runDrain
      );

      yield* finalize(post, finalizeUrl.value);

      const ready: Readiness<SnapchatMedia> = {
        _tag: "ready",
        prepared: { mediaId: object.media_id },
      };

      return ready;
    });

    const commit = Effect.fn("SnapchatClient.commit")(function* commit(
      post: OutgoingPost,
      prepared: SnapchatMedia
    ) {
      const spotlight = spotlightOf(post, prepared.mediaId);

      return yield* credentials.withToken(post.channelId, ({ accessToken }) =>
        spotlights
          .execute(
            HttpClientRequest.post(
              profileUrl(post.accountId, "/spotlights")
            ).pipe(
              HttpClientRequest.bearerToken(accessToken),
              HttpClientRequest.bodyJsonUnsafe(spotlight)
            )
          )
          .pipe(
            Effect.flatMap(spotlightAnswer),
            Effect.catchTags({
              HttpClientError: commitUnanswered,
              OutboundRequestRefused: commitUnanswered,
              SchemaError: commitUnanswered,
            })
          )
      );
    });

    const steps: PublicationSteps<SnapchatMedia> = {
      commit,
      confirmation: { _tag: "none" },
      platform: "snapchat",
      // Never reached: `prepare` answers the media ready.
      poll: (_post, prepared) => Effect.succeed({ _tag: "ready", prepared }),
      prepare,
    };

    return sequenced(steps, options.timing ?? defaultStepTiming);
  }
);
