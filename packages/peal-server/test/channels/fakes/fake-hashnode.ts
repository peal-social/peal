import type { Buffer } from "node:buffer";
import { once } from "node:events";
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import { Clock, Effect, Option, Schema } from "effect";

import type { GraphQlVariables } from "#shared/infrastructure/platforms/hashnode-api.ts";
import { fakeHandler } from "#test/shared/fake-handler.ts";
import { receivedBody } from "#test/shared/received-body.ts";

// Hashnode's GraphQL API on a loopback port, as its schema and its agent
// guide document it: a member's personal access token in
// `Authorization`, every answer 200 with refusals in `errors` (their
// `extensions.code`), every request refused FORBIDDEN for a publication
// without the Pro plan, images uploaded to a presigned address then
// confirmed. It answers the operations Peal sends, by their name: it
// parses no GraphQL.

/** A member of Hashnode, and the token they made. */
export interface FakeHashnodeUser {
  readonly id: string;
  readonly name: string;
  readonly token: string;
  readonly username: string;
}

/** A publication, and whether it has Hashnode's Pro plan. */
export interface FakeHashnodePublication {
  readonly id: string;
  /** The members of a team's publication, with their role there. */
  readonly members?: readonly {
    readonly role: string;
    readonly userId: string;
  }[];
  readonly ownerId: string;
  readonly pro: boolean;
  readonly title: string;
  readonly url: string;
}

/** A post, or a draft, as the fake keeps it. */
export interface FakeHashnodePost {
  coverImage: string | null;
  readonly draft: boolean;
  readonly id: string;
  markdown: string;
  readonly publicationId: string;
  readonly publishedAt: string;
  removed: boolean;
  subtitle: string | null;
  tags: readonly string[];
  title: string;
}

/** A request the fake received: the operation and its variables. */
export interface FakeHashnodeRequest {
  readonly authorization: string | undefined;
  readonly body: Buffer;
  readonly method: string;
  readonly operation: string;
  readonly path: string;
  readonly variables: typeof VariablesSchema.Type;
}

export interface FakeHashnodeAnswer {
  readonly body?: unknown;
  readonly status: number;
}

export interface FakeHashnodeOptions {
  readonly drop?: (request: FakeHashnodeRequest) => boolean;
  readonly intercept?: (
    request: FakeHashnodeRequest
  ) => FakeHashnodeAnswer | undefined;
  readonly publications?: readonly FakeHashnodePublication[];
  readonly users?: readonly FakeHashnodeUser[];
  /**
   * How old Hashnode's cached reads are, in seconds: a listing leaves out
   * what was made since, as a cache some 25 seconds old would.
   */
  readonly cacheSeconds?: number;
}

export interface FakeHashnode {
  readonly api: string;
  readonly posts: () => readonly FakeHashnodePost[];
  /** Adds a post made outside Peal: its id. */
  readonly addPost: (post: Partial<FakeHashnodePost>) => string;
  readonly requests: () => readonly FakeHashnodeRequest[];
  /** The files uploaded, by the address Hashnode serves them at. */
  readonly uploads: () => ReadonlyMap<string, Buffer>;
}

/** A writer on Hashnode, whose token is synthetic. */
export const writerOnHashnode: FakeHashnodeUser = {
  id: "64f0000000000000000000a1",
  name: "Synthetic Gardener",
  token: "synthetic-hashnode-token-gardener",
  username: "synthetic_gardener",
};

/** The writer's publication, on the Pro plan. */
export const gardenBlog: FakeHashnodePublication = {
  id: "64f0000000000000000000b1",
  ownerId: writerOnHashnode.id,
  pro: true,
  title: "Synthetic Garden Notes",
  url: "https://garden.hashnode.example",
};

const InputSchema = Schema.Struct({
  contentMarkdown: Schema.optionalKey(Schema.String),
  contentType: Schema.optionalKey(Schema.String),
  coverImage: Schema.optionalKey(Schema.NullOr(Schema.String)),
  coverImageOptions: Schema.optionalKey(
    Schema.Struct({ coverImageURL: Schema.optionalKey(Schema.String) })
  ),
  draftId: Schema.optionalKey(Schema.String),
  id: Schema.optionalKey(Schema.String),
  key: Schema.optionalKey(Schema.String),
  publicationId: Schema.optionalKey(Schema.String),
  subtitle: Schema.optionalKey(Schema.NullOr(Schema.String)),
  tags: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        name: Schema.optionalKey(Schema.String),
        slug: Schema.String,
      })
    )
  ),
  title: Schema.optionalKey(Schema.String),
});

const VariablesSchema = Schema.Struct({
  after: Schema.optionalKey(Schema.NullOr(Schema.String)),
  host: Schema.optionalKey(Schema.String),
  id: Schema.optionalKey(Schema.String),
  input: Schema.optionalKey(InputSchema),
});

const RequestSchema = Schema.Struct({
  operationName: Schema.optionalKey(Schema.String),
  variables: Schema.optionalKey(VariablesSchema),
});

const decodeAddress = Schema.decodeUnknownSync(
  Schema.Struct({ port: Schema.Number })
);

const refused = (code: string, message: string): FakeHashnodeAnswer => ({
  body: { data: null, errors: [{ extensions: { code }, message }] },
  status: 200,
});

const data = (body: GraphQlVariables): FakeHashnodeAnswer => ({
  body: { data: body },
  status: 200,
});

const send = (response: ServerResponse, answer: FakeHashnodeAnswer) => {
  response.writeHead(answer.status, {
    connection: "close",
    "content-type": "application/json",
  });
  response.end(answer.body === undefined ? "" : JSON.stringify(answer.body));
};

const noPro =
  "Publication does not have an active Pro plan. Upgrade to Pro to use the GraphQL API.";

const hostOf = (url: string) => new URL(url).host;

// A page of a publication's visible members, 100 at most, after the
// cursor given, as a GraphQL connection.
const membersPage = (
  members: readonly { readonly role: string; readonly userId: string }[],
  after: string | undefined
) => {
  const start = after === undefined ? 0 : Number(after);
  const page = members.slice(start, start + 100);
  const end = start + page.length;

  return {
    edges: page.map(({ role, userId }) => ({
      node: { role, user: { id: userId } },
    })),
    pageInfo: {
      endCursor: page.length === 0 ? null : String(end),
      hasNextPage: end < members.length,
    },
  };
};

const nowOf = (clock: Clock.Clock) => () =>
  new Date(clock.currentTimeMillisUnsafe()).toISOString();

/** A fake Hashnode for the life of the scope, plain HTTP on loopback. */
export const fakeHashnode = (options: FakeHashnodeOptions = {}) =>
  Clock.clockWith((clock) =>
    Effect.acquireRelease(
      Effect.promise(async () => {
        const users = options.users ?? [writerOnHashnode];
        const publications = options.publications ?? [gardenBlog];
        const received: FakeHashnodeRequest[] = [];
        const posts = new Map<string, FakeHashnodePost>();
        const pending = new Map<string, Buffer | undefined>();
        const uploads = new Map<string, Buffer>();
        const now = nowOf(clock);
        let nextId = 0;
        let origin = "";

        const newId = () => {
          nextId += 1;

          return `64f0000000000000000${String(nextId).padStart(5, "0")}`;
        };

        const postView = (post: FakeHashnodePost) => ({
          content: { markdown: post.markdown },
          id: post.id,
          publishedAt: post.publishedAt,
          title: post.title,
          updatedAt: post.publishedAt,
          url: `${origin}/p/${post.id}`,
        });

        const proFor = (publicationId: string | undefined) =>
          publications.find((publication) => publication.id === publicationId)
            ?.pro === true;

        const madeFrom = (
          input: typeof InputSchema.Type,
          draft: boolean
        ): FakeHashnodePost => ({
          coverImage:
            input.coverImage ?? input.coverImageOptions?.coverImageURL ?? null,
          draft,
          id: newId(),
          markdown: input.contentMarkdown ?? "",
          publicationId: input.publicationId ?? "",
          publishedAt: now(),
          removed: false,
          subtitle: input.subtitle ?? null,
          tags: (input.tags ?? []).map(({ slug }) => slug),
          title: input.title ?? "",
        });

        const changedBy = (
          post: FakeHashnodePost,
          input: typeof InputSchema.Type
        ) => {
          post.title = input.title ?? post.title;
          post.markdown = input.contentMarkdown ?? post.markdown;
          post.subtitle =
            input.subtitle === undefined ? post.subtitle : input.subtitle;
          post.coverImage =
            input.coverImage ??
            input.coverImageOptions?.coverImageURL ??
            post.coverImage;
          post.tags =
            input.tags === undefined
              ? post.tags
              : input.tags.map(({ slug }) => slug);
        };

        type Input = typeof InputSchema.Type;

        const imageUpload = (): FakeHashnodeAnswer => {
          const key = `uploads/${newId()}`;

          pending.set(key, undefined);

          return data({
            createImageUploadURL: {
              presignedPut: {
                cdnUrl: `${origin}/cdn/${key}`,
                key,
                url: `${origin}/put/${key}`,
              },
            },
          });
        };

        const confirmImage = (input: Input): FakeHashnodeAnswer => {
          const key = input.key ?? "";
          const bytes = pending.get(key);

          if (bytes === undefined) {
            return refused("BAD_USER_INPUT", "Upload not found");
          }

          uploads.set(`${origin}/cdn/${key}`, bytes);

          return data({
            confirmImageUpload: { cdnUrl: `${origin}/cdn/${key}`, ok: true },
          });
        };

        const make = (input: Input, draft: boolean): FakeHashnodeAnswer => {
          if (!proFor(input.publicationId)) {
            return refused("FORBIDDEN", noPro);
          }

          if ((input.title ?? "").trim() === "") {
            return refused("BAD_USER_INPUT", "Title is required");
          }

          const post = madeFrom(input, draft);

          posts.set(post.id, post);

          return draft
            ? data({ createDraft: { draft: { id: post.id } } })
            : data({
                publishPost: {
                  post: { id: post.id, url: `${origin}/p/${post.id}` },
                },
              });
        };

        const change = (
          input: Input,
          changing: (post: FakeHashnodePost) => void
        ): FakeHashnodeAnswer => {
          const post = posts.get(input.id ?? input.draftId ?? "");

          if (post === undefined || post.removed) {
            return refused("NOT_FOUND", "Post not found");
          }

          changing(post);

          return data({ ok: true });
        };

        const mutations = new Map<string, (input: Input) => FakeHashnodeAnswer>(
          [
            ["PealImageUpload", imageUpload],
            ["PealConfirmImage", confirmImage],
            ["PealPublishPost", (input) => make(input, false)],
            ["PealCreateDraft", (input) => make(input, true)],
            [
              "PealUpdatePost",
              (input) =>
                change(input, (post) => {
                  changedBy(post, input);
                }),
            ],
            [
              "PealUpdateDraft",
              (input) =>
                change(input, (post) => {
                  changedBy(post, input);
                }),
            ],
            [
              "PealRemovePost",
              (input) =>
                change(input, (post) => {
                  post.removed = true;
                }),
            ],
            [
              "PealDeleteDraft",
              (input) =>
                change(input, (post) => {
                  post.removed = true;
                }),
            ],
          ]
        );

        const mutation = (
          request: FakeHashnodeRequest,
          input: Input
        ): FakeHashnodeAnswer =>
          mutations.get(request.operation)?.(input) ??
          refused("BAD_USER_INPUT", `Unknown operation ${request.operation}`);

        const query = (
          request: FakeHashnodeRequest,
          user: FakeHashnodeUser
        ): FakeHashnodeAnswer => {
          const own = publications.filter(
            (publication) => publication.ownerId === user.id
          );

          if (request.operation === "PealMember") {
            return data({
              me: {
                id: user.id,
                name: user.name,
                profilePicture: `${origin}/avatars/${user.id}.png`,
                publications: {
                  edges: own.map((publication) => ({
                    node: {
                      id: publication.id,
                      title: publication.title,
                      url: publication.url,
                    },
                  })),
                },
                username: user.username,
              },
            });
          }

          const { host, id } = request.variables;

          const publication = publications.find(
            (known) =>
              (host !== undefined && hostOf(known.url) === host) ||
              known.id === id
          );

          if (publication === undefined) {
            return data({ publication: null });
          }

          if (!publication.pro) {
            return refused("FORBIDDEN", noPro);
          }

          const cachedAt =
            Date.parse(now()) - (options.cacheSeconds ?? 0) * 1000;

          const mine = [...posts.values()]
            .filter(
              (post) =>
                post.publicationId === publication.id &&
                !post.removed &&
                Date.parse(post.publishedAt) <= cachedAt
            )
            .toReversed();

          if (request.operation === "PealRecentPosts") {
            return data({
              publication: {
                posts: {
                  edges: mine.flatMap((post) =>
                    post.draft ? [] : [{ node: postView(post) }]
                  ),
                },
              },
            });
          }

          if (request.operation === "PealDrafts") {
            return data({
              publication: {
                drafts: {
                  edges: mine.flatMap((post) =>
                    post.draft ? [{ node: postView(post) }] : []
                  ),
                },
              },
            });
          }

          return data({
            publication: {
              author: { id: publication.ownerId },
              id: publication.id,
              members: membersPage(
                publication.members ?? [],
                request.variables.after ?? undefined
              ),
              title: publication.title,
              url: publication.url,
            },
          });
        };

        const answer = async (
          incoming: IncomingMessage,
          response: ServerResponse
        ) => {
          const body = await receivedBody(incoming);

          if (body === undefined) {
            return;
          }

          const url = new URL(incoming.url ?? "/", origin);

          // The presigned upload, which carries no token.
          if (incoming.method === "PUT" && url.pathname.startsWith("/put/")) {
            const key = url.pathname.slice("/put/".length);

            if (pending.has(key)) {
              pending.set(key, body);
            }

            response.writeHead(pending.has(key) ? 200 : 403);
            response.end();

            return;
          }

          const parsed = Option.getOrUndefined(
            Schema.decodeUnknownOption(Schema.fromJsonString(RequestSchema))(
              body.toString()
            )
          );

          const request: FakeHashnodeRequest = {
            authorization: incoming.headers.authorization,
            body,
            method: incoming.method ?? "GET",
            operation: parsed?.operationName ?? "",
            path: url.pathname,
            variables: parsed?.variables ?? {},
          };

          received.push(request);

          const intercepted = options.intercept?.(request);

          if (intercepted !== undefined) {
            send(response, intercepted);

            return;
          }

          const token = (request.authorization ?? "").replace(/^bearer /iu, "");

          const user = users.find((known) => known.token === token);

          const { input } = request.variables;

          const answerTo = (): FakeHashnodeAnswer => {
            if (user === undefined) {
              return refused("UNAUTHENTICATED", "You must be logged in");
            }

            return input === undefined
              ? query(request, user)
              : mutation(request, input);
          };

          const answered = answerTo();

          if (options.drop?.(request) === true) {
            incoming.socket.destroy();

            return;
          }

          send(response, answered);
        };

        const server = createServer(fakeHandler(answer));

        server.listen(0, "127.0.0.1");
        await once(server, "listening");

        origin = `http://127.0.0.1:${decodeAddress(server.address()).port}`;

        const fake: FakeHashnode = {
          addPost: (partial) => {
            const post: FakeHashnodePost = {
              coverImage: null,
              draft: false,
              id: newId(),
              markdown: "",
              publicationId: gardenBlog.id,
              publishedAt: now(),
              removed: false,
              subtitle: null,
              tags: [],
              title: "",
              ...partial,
            };

            posts.set(post.id, post);

            return post.id;
          },
          api: `${origin}/`,
          posts: () => [...posts.values()],
          requests: () => [...received],
          uploads: () => new Map(uploads),
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
