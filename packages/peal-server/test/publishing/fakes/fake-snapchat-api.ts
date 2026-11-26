import { setTimeout as sleep } from "node:timers/promises";

import { Effect, Schema } from "effect";

import {
  empty,
  formPartsOf,
  headerOf,
  json,
  jsonBodyOf,
  platformServer,
  scripted,
} from "./platform-server.ts";
import type {
  JsonValue,
  PlatformAnswer,
  PlatformRequest,
} from "./platform-server.ts";

/** The synthetic Public Profile the channel posts to. */
export const snapchatProfileId = "d6ed1cac-e0cd-4109-bf04-539cb8591838";

/** A media object Snap made, and what it was sent. */
export interface FakeSnapMedia {
  readonly id: string;
  /** The Base64 key and IV the create call named. */
  readonly iv: string;
  readonly key: string;
  readonly name: string;
  /** Each part's bytes, by its number, as sent last. */
  readonly parts: Map<number, Uint8Array>;
  /** Every part number sent, in order, repeats included. */
  readonly partsSent: number[];
  finalized: boolean;
  /** The content type FINALIZE came in. */
  finalizedAs: string;
  readonly type: string;
}

/** A Spotlight Snap made, with the body it was posted with. */
export interface FakeSpotlight {
  readonly body: Readonly<Record<string, JsonValue>>;
  readonly id: string;
}

/**
 * The routes a test can script: making the media object, a part, the
 * finish, and the Spotlight.
 */
export type SnapRoute = "add" | "createMedia" | "finalize" | "spotlight";

/** What Snap does with the next request to a route instead of its own behaviour. */
export type SnapScript =
  | PlatformAnswer
  // Answers after this many milliseconds, for a client that gives up first.
  | {
      readonly _tag: "late";
      readonly after: number;
      readonly answer: PlatformAnswer;
    }
  // The media object's answer, with this `add_path` (another host or profile).
  | { readonly _tag: "addPath"; readonly path: string }
  // The fake's own answer, to script a later request of the route.
  | { readonly _tag: "own" };

const CreateSchema = Schema.Struct({
  iv: Schema.String,
  key: Schema.String,
  name: Schema.String,
  type: Schema.String,
});

const createOf = jsonBodyOf(CreateSchema);

const spotlightOf = jsonBodyOf(Schema.Record(Schema.String, Schema.Json));

const mediaIdOf = jsonBodyOf(Schema.Struct({ media_id: Schema.String }));

/** Snap's envelope saying `ERROR`, with this code. */
export const snapRefusal = (
  errorCode: string,
  status: number,
  headers: Readonly<Record<string, string>> = {}
): PlatformAnswer =>
  json(
    {
      debug_message: "Synthetic debug message.",
      display_message: "Synthetic display message.",
      error_code: errorCode,
      request_id: "synthetic-request-id",
      request_status: "ERROR",
    },
    status,
    headers
  );

/** The one refused token Snap documents: an expired one. */
export const expiredToken: PlatformAnswer = empty(401, {
  "content-type": "text/html",
  "www-authenticate":
    'Bearer error="invalid_token", error_description="The access token expired"',
});

const success = (fields: Readonly<Record<string, string>> = {}) =>
  json({
    request_id: "synthetic-request-id",
    request_status: "SUCCESS",
    ...fields,
  });

/** A part's size, as Snap's sample splits: `split -b 32m`. */
export const snapPartSize = 32 * 1024 * 1024;

// Whether the parts are numbered 1 to n and cut as `split -b 32m` cuts the
// encrypted file: one of 32 MiB at most, or each but the last exactly
// 32 MiB and the last one of what is left.
const splitAsSnapShows = (parts: ReadonlyMap<number, Uint8Array>) => {
  const sizes = Array.from(
    { length: parts.size },
    (_, index) => parts.get(index + 1)?.length ?? -1
  );

  const last = sizes.at(-1) ?? 0;

  return (
    last >= 1 &&
    last <= snapPartSize &&
    sizes.slice(0, -1).every((size) => size === snapPartSize)
  );
};

const bearerOf = (request: PlatformRequest) =>
  headerOf(request, "authorization").replace(/^Bearer /u, "");

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

/**
 * Snap's Business API for the Public Profile API's posting calls on one
 * synthetic profile: create media (answering paths under `/us/v1/…`), the
 * multipart ADD and FINALIZE, and Post Spotlight. Calls carry one of
 * `tokens`, else an expired token's 401. `script` replaces a route's next
 * answers. FINALIZE takes only the shape Snap's page shows (`split -b
 * 32m` of the encrypted file): one part of 32 MiB at most, or parts of
 * exactly 32 MiB and a last one of what is left. Every create request's
 * key and IV are kept (`created`), whatever the script answers.
 */
export const fakeSnapchatApi = Effect.fnUntraced(function* fakeSnapchatApi(
  options: { readonly tokens?: readonly string[] } = {}
) {
  const tokens = new Set(options.tokens ?? ["token-1"]);
  const media = new Map<string, FakeSnapMedia>();
  const spotlights: FakeSpotlight[] = [];
  const script = scripted<SnapScript>();
  const calls: SnapRoute[] = [];
  const created: { readonly iv: string; readonly key: string }[] = [];

  const profile = `/v1/public_profiles/${snapchatProfileId}`;

  const uploadPath = (mediaId: string) =>
    `/us${profile}/media/${mediaId}/multipart-upload`;

  const createMedia = (request: PlatformRequest, addPath?: string) => {
    const body = createOf(request);
    const id = `00000000-0000-4000-8000-${String(media.size + 1).padStart(12, "0")}`;

    media.set(id, {
      finalized: false,
      finalizedAs: "",
      id,
      iv: body.iv,
      key: body.key,
      name: body.name,
      parts: new Map(),
      partsSent: [],
      type: body.type,
    });

    return success({
      add_path: addPath ?? uploadPath(id),
      finalize_path: uploadPath(id),
      media_id: id,
    });
  };

  const upload = (request: PlatformRequest, mediaId: string) => {
    const object = media.get(mediaId);

    if (object === undefined) {
      return snapRefusal("MEDIA_NOT_FOUND", 404);
    }

    const parts = formPartsOf(request);

    const field = (name: string) =>
      text(parts.find((part) => part.name === name)?.data ?? new Uint8Array());

    if (field("action") === "FINALIZE") {
      if (!splitAsSnapShows(object.parts)) {
        return snapRefusal("SYNTHETIC_PARTS_NOT_AS_DOCUMENTED", 400);
      }

      object.finalized = true;
      object.finalizedAs = headerOf(request, "content-type");

      return success();
    }

    const file = parts.find((part) => part.name === "file");
    const number = Number(field("part_number"));

    if (field("action") !== "ADD" || file === undefined || !(number >= 1)) {
      return snapRefusal("VALIDATION_ERROR", 400);
    }

    object.parts.set(number, file.data);
    object.partsSent.push(number);

    return success();
  };

  const postSpotlight = (request: PlatformRequest) => {
    const body = spotlightOf(request);
    const object = media.get(mediaIdOf(request).media_id);

    if (object === undefined || !object.finalized) {
      return snapRefusal("MEDIA_INVALID", 400);
    }

    const id = `W7_synthetic_spotlight_${spotlights.length + 1}`;

    spotlights.push({ body, id });

    return success({ spotlight_id: id });
  };

  const routeOf = (request: PlatformRequest): SnapRoute | undefined => {
    if (request.method !== "POST") {
      return undefined;
    }

    if (request.path === `${profile}/media`) {
      return "createMedia";
    }

    if (request.path === `${profile}/spotlights`) {
      return "spotlight";
    }

    if (
      /^\/us\/v1\/public_profiles\/[^/]+\/media\/[^/]+\/multipart-upload$/u.test(
        request.path
      )
    ) {
      return text(request.body).includes('name="action"\r\n\r\nFINALIZE')
        ? "finalize"
        : "add";
    }

    return undefined;
  };

  const answered = (
    request: PlatformRequest,
    route: SnapRoute,
    addPath?: string
  ): PlatformAnswer => {
    if (route === "createMedia") {
      return createMedia(request, addPath);
    }

    if (route === "spotlight") {
      return postSpotlight(request);
    }

    const mediaId = request.path.split("/").at(-2) ?? "";

    return upload(request, mediaId);
  };

  const handle = async (request: PlatformRequest): Promise<PlatformAnswer> => {
    const route = routeOf(request);

    if (route === undefined) {
      return snapRefusal("NOT_FOUND", 404);
    }

    calls.push(route);

    if (route === "createMedia") {
      const { iv, key } = createOf(request);

      created.push({ iv, key });
    }

    // A refused token comes before anything: it uses no scripted answer.
    if (!tokens.has(bearerOf(request))) {
      return expiredToken;
    }

    const next = script.next(route);

    if (next === undefined || next._tag === "own") {
      return answered(request, route);
    }

    if (next._tag === "addPath") {
      return answered(request, route, next.path);
    }

    if (next._tag === "late") {
      await sleep(next.after);

      return next.answer;
    }

    return next;
  };

  const server = yield* platformServer(handle);

  return {
    ...server,
    /** The routes called, in order, refused tokens included. */
    calls: () => [...calls],
    /** Every create request's Base64 key and IV, refused ones included. */
    created: () => [...created],
    /** The media objects made, in order. */
    media: () => [...media.values()],
    script,
    /** The Spotlights made, in order. */
    spotlights: () => [...spotlights],
    /** Takes a token from now on, as Snap does once it is renewed. */
    take: (token: string) => {
      tokens.add(token);
    },
    /** Refuses a token from now on, as when its hour has passed. */
    expire: (token: string) => {
      tokens.delete(token);
    },
  };
});
