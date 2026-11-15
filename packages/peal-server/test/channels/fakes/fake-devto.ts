import type { Buffer } from "node:buffer";
import { once } from "node:events";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { buffer } from "node:stream/consumers";

import { Clock, Effect, Option, Schema } from "effect";

// DEV's API, Forem's v1, on a loopback port, as its specification
// (forem/forem swagger/v1/api_v1.json) and its code document it: routes
// answered only for the v1 media type in `Accept`, a member's key in
// `api-key`, `/api/users/me`, images uploaded one a request as
// multipart/form-data, articles made, changed and listed (drafts first,
// newest made first, then published ones, newest first). There is no
// way to delete an article. An article titled as one its user made in
// the last five minutes is refused, as Forem refuses it; tags are four at
// most, letters and digits. Only what Peal calls is answered.

/** A member of DEV, and the key they made. */
export interface FakeDevToUser {
  readonly id: number;
  readonly key: string;
  readonly name: string;
  readonly username: string;
}

/** An article as the fake keeps it. */
export interface FakeDevToArticle {
  body_markdown: string;
  canonical_url: string | null;
  createdAt: number;
  description: string;
  id: number;
  main_image: string | null;
  published: boolean;
  published_at: string | null;
  tags: string[];
  title: string;
  readonly userId: number;
}

/** A request the fake received. */
export interface FakeDevToRequest {
  readonly body: Buffer;
  readonly headers: IncomingMessage["headers"];
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  /** When it came, on the test's clock, in milliseconds. */
  readonly receivedAt: number;
}

export interface FakeDevToAnswer {
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly status: number;
}

export interface FakeDevToOptions {
  /** Answers instead of DEV, when it gives an answer. */
  readonly intercept?: (
    request: FakeDevToRequest
  ) => FakeDevToAnswer | "hang" | undefined;
  /** Whether DEV does what the request asks, then drops the connection. */
  readonly drop?: (request: FakeDevToRequest) => boolean;
  readonly users?: readonly FakeDevToUser[];
  /**
   * Whether DEV takes one write a second from the server, whatever key it
   * carries, as Rack::Attack's `api_write_throttle` does by address: a
   * second one within the second answers 429, `Retry-After: 1`.
   */
  readonly writesPerSecond?: boolean;
}

export interface FakeDevTo {
  /** Where the API is, as `DevToHosts.api`. */
  readonly api: string;
  /** Adds an article made outside Peal: its id. */
  readonly addArticle: (article: Partial<FakeDevToArticle>) => number;
  readonly articles: () => readonly FakeDevToArticle[];
  /** The files uploaded, by the address DEV gave them. */
  readonly images: () => ReadonlyMap<string, Buffer>;
  readonly requests: () => readonly FakeDevToRequest[];
  /** How many writes DEV refused for coming too soon. */
  readonly throttled: () => number;
}

/** What a reader of DEV sees of an article's Markdown, and whether Liquid ran. */
export interface ForemReading {
  /** Some of the text made a Liquid tag or variable: an embed, or text lost. */
  readonly liveLiquid: boolean;
  readonly text: string;
}

// Redcarpet un-escapes these alone (`char_escape`); before any other
// character the backslash stays, as text.
const redcarpetEscapes = /\\(?<escaped>[\\`*_{}[\]()#+\-.!:|&<>^~=])/gu;

/**
 * An article's Markdown as Forem renders it, outside code (forem/forem
 * `MarkdownProcessor::Parser#finalize`): Redcarpet un-escapes what it
 * knows, the sanitiser decodes entities, then Liquid reads `{{` and `{%`;
 * Liquid's own text `{{ '{' }}` is a brace. No Markdown syntax is kept:
 * only the text a reader would see, with its line breaks.
 */
export const readAsForem = (markdown: string): ForemReading => {
  const prose = markdown.replaceAll(/```[\s\S]*?```|`[^`]*`/gu, "");

  const decoded = prose
    .replaceAll(redcarpetEscapes, "$<escaped>")
    .replaceAll("&#123;", "{")
    .replaceAll("&#125;", "}")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");

  let liveLiquid = false;

  const text = decoded.replaceAll(/\{\{ '\{' \}\}|\{\{|\{%/gu, (token) => {
    if (token === "{{ '{' }}") {
      return "{";
    }

    liveLiquid = true;

    return token;
  });

  return { liveLiquid, text };
};

/** Another writer on DEV, whose key is synthetic. */
export const neighbour: FakeDevToUser = {
  id: 4343,
  key: "synthetic-devto-key-neighbour",
  name: "Synthetic Neighbour",
  username: "synthetic_neighbour",
};

/** A writer on DEV, whose key is synthetic. */
export const gardener: FakeDevToUser = {
  id: 4242,
  key: "synthetic-devto-key-gardener",
  name: "Synthetic Gardener",
  username: "synthetic_gardener",
};

const v1 = "application/vnd.forem.api-v1+json";

const decodeAddress = Schema.decodeUnknownSync(
  Schema.Struct({ port: Schema.Number })
);

const ArticleFieldsSchema = Schema.Struct({
  article: Schema.Struct({
    body_markdown: Schema.optionalKey(Schema.String),
    canonical_url: Schema.optionalKey(Schema.NullOr(Schema.String)),
    description: Schema.optionalKey(Schema.String),
    main_image: Schema.optionalKey(Schema.NullOr(Schema.String)),
    published: Schema.optionalKey(Schema.Boolean),
    published_at: Schema.optionalKey(Schema.NullOr(Schema.String)),
    tags: Schema.optionalKey(Schema.Array(Schema.String)),
    title: Schema.optionalKey(Schema.String),
  }),
});

const fieldsOf = (body: Buffer) =>
  Schema.decodeUnknownOption(Schema.fromJsonString(ArticleFieldsSchema))(
    body.toString()
  );

const error = (status: number, message: string): FakeDevToAnswer => ({
  body: { error: message, status },
  status,
});

const send = (response: ServerResponse, answer: FakeDevToAnswer) => {
  const json = new Map([["content-type", "application/json; charset=utf-8"]]);

  response.writeHead(answer.status, {
    connection: "close",
    ...Object.fromEntries(answer.body === undefined ? [] : json),
    ...answer.headers,
  });
  response.end(
    answer.body === undefined ? undefined : JSON.stringify(answer.body)
  );
};

const fiveMinutes = 5 * 60 * 1000;

// The test's clock, in milliseconds.
const clockNow = (clock: Clock.Clock) => () => clock.currentTimeMillisUnsafe();

/**
 * A fake DEV for the life of the scope, plain HTTP on loopback: tests
 * open the outbound guard to reach it.
 */
export const fakeDevTo = (options: FakeDevToOptions = {}) =>
  Clock.clockWith((clock) =>
    Effect.acquireRelease(
      Effect.promise(async () => {
        const users = options.users ?? [gardener, neighbour];
        let lastWrite: number | undefined;
        let throttled = 0;
        const received: FakeDevToRequest[] = [];
        const articles = new Map<number, FakeDevToArticle>();
        const images = new Map<string, Buffer>();
        let nextId = 1000;
        let origin = "";

        const now = clockNow(clock);

        const view = (article: FakeDevToArticle) => ({
          body_markdown: article.body_markdown,
          canonical_url: article.canonical_url,
          cover_image: article.main_image,
          description: article.description,
          id: article.id,
          path: `/u${article.userId}/a${article.id}`,
          published: article.published,
          published_at: article.published_at,
          tag_list: article.tags,
          title: article.title,
          type_of: "article",
          url: `${origin}/u${article.userId}/a${article.id}`,
        });

        // Forem's checks on what an article says.
        const refusal = (article: FakeDevToArticle): FakeDevToAnswer | null => {
          if (article.title.trim() === "") {
            return error(422, "Title can't be blank");
          }

          if (
            article.tags.length > 4 ||
            article.tags.some((tag) => !/^[\p{L}\p{N}]{1,30}$/u.test(tag))
          ) {
            return error(422, "Tag list exceed the maximum of 4 tags");
          }

          return null;
        };

        const me = (user: FakeDevToUser): FakeDevToAnswer => ({
          body: {
            id: user.id,
            name: user.name,
            profile_image: `${origin}/avatars/${user.id}.png`,
            type_of: "user",
            username: user.username,
          },
          status: 200,
        });

        const uploaded = (request: FakeDevToRequest): FakeDevToAnswer => {
          const type = request.headers["content-type"] ?? "";

          if (!type.startsWith("multipart/form-data")) {
            return error(422, "image is missing");
          }

          const url = `${origin}/uploads/${images.size + 1}.png`;

          images.set(url, request.body);

          return { body: { url }, status: 201 };
        };

        const made = (
          request: FakeDevToRequest,
          user: FakeDevToUser
        ): FakeDevToAnswer => {
          const fields = fieldsOf(request.body);

          if (Option.isNone(fields)) {
            return error(422, "param is missing or the value is empty");
          }

          const given = fields.value.article;
          const publishedNow = given.published === true;

          nextId += 1;

          const article: FakeDevToArticle = {
            body_markdown: given.body_markdown ?? "",
            canonical_url: given.canonical_url ?? null,
            createdAt: now(),
            description: given.description ?? "",
            id: nextId,
            main_image: given.main_image ?? null,
            published: publishedNow,
            published_at: publishedNow
              ? (given.published_at ?? new Date(now()).toISOString())
              : null,
            tags: (given.tags ?? []).map((tag) => tag.toLowerCase()),
            title: given.title ?? "",
            userId: user.id,
          };

          const refused = refusal(article);

          if (refused !== null) {
            return refused;
          }

          const recent = [...articles.values()].some(
            (other) =>
              other.userId === user.id &&
              other.title === article.title &&
              now() - other.createdAt < fiveMinutes
          );

          if (recent) {
            return error(
              422,
              "Title has already been used in the last five minutes"
            );
          }

          articles.set(article.id, article);

          return { body: view(article), status: 201 };
        };

        const changed = (
          request: FakeDevToRequest,
          user: FakeDevToUser,
          id: number
        ): FakeDevToAnswer => {
          const article = articles.get(id);

          if (article === undefined || article.userId !== user.id) {
            return error(404, "not found");
          }

          const fields = fieldsOf(request.body);

          if (Option.isNone(fields)) {
            return error(422, "param is missing or the value is empty");
          }

          const given = fields.value.article;

          const next: FakeDevToArticle = {
            ...article,
            body_markdown: given.body_markdown ?? article.body_markdown,
            description: given.description ?? article.description,
            main_image:
              given.main_image === undefined
                ? article.main_image
                : given.main_image,
            published: given.published ?? article.published,
            published_at:
              given.published === true
                ? (article.published_at ?? new Date(now()).toISOString())
                : article.published_at,
            tags:
              given.tags === undefined
                ? article.tags
                : given.tags.map((tag) => tag.toLowerCase()),
            title: given.title ?? article.title,
          };

          const refused = refusal(next);

          if (refused !== null) {
            return refused;
          }

          articles.set(next.id, next);

          return { body: view(next), status: 200 };
        };

        const listed = (
          request: FakeDevToRequest,
          user: FakeDevToUser
        ): FakeDevToAnswer => {
          const page = Number(request.query.get("page") ?? "1");
          const perPage = Number(request.query.get("per_page") ?? "30");

          const mine = [...articles.values()].filter(
            (article) => article.userId === user.id
          );

          const drafts = mine
            .filter((article) => !article.published)
            .toSorted((left, right) => right.createdAt - left.createdAt);

          const published = mine
            .filter((article) => article.published)
            .toSorted((left, right) =>
              (right.published_at ?? "").localeCompare(left.published_at ?? "")
            );

          return {
            body: [...drafts, ...published]
              .slice((page - 1) * perPage, page * perPage)
              .map(view),
            status: 200,
          };
        };

        const route = (
          request: FakeDevToRequest,
          user: FakeDevToUser
        ): FakeDevToAnswer => {
          const { method, path } = request;

          const own = /^\/api\/articles\/(?<id>\d+)$/u.exec(path)?.groups?.[
            "id"
          ];

          if (method === "GET" && path === "/api/users/me") {
            return me(user);
          }

          if (method === "POST" && path === "/api/images") {
            return uploaded(request);
          }

          if (method === "POST" && path === "/api/articles") {
            return made(request, user);
          }

          if (method === "PUT" && own !== undefined) {
            return changed(request, user, Number(own));
          }

          if (method === "GET" && path === "/api/articles/me/all") {
            return listed(request, user);
          }

          return error(404, "not found");
        };

        const answer = async (
          incoming: IncomingMessage,
          response: ServerResponse
        ) => {
          const body = await buffer(incoming);
          const url = new URL(incoming.url ?? "/", origin);

          const request: FakeDevToRequest = {
            body,
            headers: incoming.headers,
            method: incoming.method ?? "GET",
            path: url.pathname,
            query: url.searchParams,
            receivedAt: now(),
          };

          received.push(request);

          const intercepted = options.intercept?.(request);

          if (intercepted === "hang") {
            return;
          }

          if (intercepted !== undefined) {
            send(response, intercepted);

            return;
          }

          // Without the v1 media type, Forem routes to its older API.
          if (!(incoming.headers.accept ?? "").includes(v1)) {
            send(response, error(404, "not found"));

            return;
          }

          const key = incoming.headers["api-key"];
          const user = users.find((known) => known.key === key);

          if (user === undefined) {
            send(response, error(401, "unauthorized"));

            return;
          }

          const write = request.method !== "GET";

          const tooSoon =
            options.writesPerSecond === true &&
            write &&
            lastWrite !== undefined &&
            now() - lastWrite < 1000;

          if (tooSoon) {
            throttled += 1;
            send(response, {
              body: { error: "Rate limit reached", status: 429 },
              headers: { "retry-after": "1" },
              status: 429,
            });

            return;
          }

          if (write) {
            lastWrite = now();
          }

          const answered = route(request, user);

          if (options.drop?.(request) === true) {
            incoming.socket.destroy();

            return;
          }

          send(response, answered);
        };

        const server = createServer((incoming, response) => {
          void answer(incoming, response);
        });

        server.listen(0, "127.0.0.1");
        await once(server, "listening");

        origin = `http://127.0.0.1:${decodeAddress(server.address()).port}`;

        const fake: FakeDevTo = {
          addArticle: (partial) => {
            nextId += 1;

            const article: FakeDevToArticle = {
              body_markdown: "",
              canonical_url: null,
              createdAt: now(),
              description: "",
              id: nextId,
              main_image: null,
              published: false,
              published_at: null,
              tags: [],
              title: "",
              userId: gardener.id,
              ...partial,
            };

            articles.set(article.id, article);

            return article.id;
          },
          api: origin,
          articles: () => [...articles.values()],
          images: () => new Map(images),
          requests: () => [...received],
          throttled: () => throttled,
        };

        return { fake, server };
      }),
      ({ server }) =>
        Effect.promise(async () => {
          server.closeAllConnections();
          server.close();
          await once(server, "close");
        })
    ).pipe(Effect.map(({ fake }) => fake))
  );
