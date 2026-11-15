import { Effect, Option, Schema } from "effect";

import { SiteRefused } from "#channels/application/site-refused.ts";
import type {
  SiteKeySignIn,
  VerifiedSite,
} from "#channels/application/site-verifier.ts";
import { AvatarUrlSchema } from "#channels/domain/avatar-url.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";
import {
  hashnodeAnswerOf,
  hashnodeRequest,
  isPlanRefusal,
} from "#shared/infrastructure/platforms/hashnode-api.ts";
import type {
  GraphQlVariables,
  HashnodeAnswer,
  HashnodeHosts,
} from "#shared/infrastructure/platforms/hashnode-api.ts";
import { publicHttpClient } from "#shared/infrastructure/platforms/public-http.ts";

const PublicationSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  url: Schema.optionalKey(Schema.NullOr(Schema.String)),
});

type Publication = typeof PublicationSchema.Type;

const MemberSchema = Schema.Struct({
  me: Schema.Struct({
    id: Schema.String,
    name: Schema.optionalKey(Schema.NullOr(Schema.String)),
    profilePicture: Schema.optionalKey(Schema.NullOr(Schema.String)),
    publications: Schema.Struct({
      edges: Schema.Array(Schema.Struct({ node: PublicationSchema })),
    }),
    username: Schema.String,
  }),
});

// A publication found by its address, with who may publish there: its
// author, and a team's members with their role.
const FoundSchema = Schema.Struct({
  publication: Schema.NullOr(
    Schema.Struct({
      ...PublicationSchema.fields,
      author: Schema.Struct({ id: Schema.String }),
      members: Schema.Struct({
        edges: Schema.Array(
          Schema.Struct({
            node: Schema.Struct({
              role: Schema.String,
              user: Schema.Struct({ id: Schema.String }),
            }),
          })
        ),
        pageInfo: Schema.Struct({
          endCursor: Schema.optionalKey(Schema.NullOr(Schema.String)),
          hasNextPage: Schema.Boolean,
        }),
      }),
    })
  ),
});

// The roles of a team's publication that publish: a contributor submits
// drafts for review only.
const publishingRoles: ReadonlySet<string> = new Set(["OWNER", "EDITOR"]);

// The pages of members read at most, 100 each.
const maxMemberPages = 20;

const member = {
  name: "PealMember",
  query:
    "query PealMember { me { id username name profilePicture publications(first: 50) { edges { node { id title url } } } } }",
};

const publicationAt = {
  name: "PealPublication",
  query:
    "query PealPublication($host: String!, $after: String) { publication(host: $host) { id title url author { id } members(first: 100, after: $after) { edges { node { role user { id } } } pageInfo { hasNextPage endCursor } } } }",
};

const decodeAvatar = Schema.decodeUnknownOption(AvatarUrlSchema);

// The host an address names, as Hashnode finds a publication by it.
const hostOf = (written: string) => {
  const trimmed = written.trim();

  const url = URL.parse(
    /^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed) ? trimmed : `https://${trimmed}`
  );

  return url === null ? "" : url.host.toLowerCase();
};

const publicationHost = (publication: Publication) =>
  hostOf(publication.url ?? "");

/**
 * How `SiteVerifier` checks a Hashnode token and the publication it is
 * to publish to: the member the token is theirs (`me`), then the
 * publication, named by its address or the member's only one. Hashnode
 * refuses every request for a publication without its Pro plan
 * (`planRequired`). Only its own UNAUTHENTICATED refuses the token;
 * anything else it, or a server on the way, says is Hashnode unavailable.
 */
export const hashnodeVerifyKey = Effect.fnUntraced(function* hashnodeVerifyKey(
  hosts: HashnodeHosts
) {
  const http = yield* publicHttpClient;

  const ask = <A, I>(
    signIn: SiteKeySignIn,
    operation: { readonly name: string; readonly query: string },
    variables: GraphQlVariables,
    schema: Schema.Codec<A, I>
  ) =>
    http
      .execute(hashnodeRequest(hosts, signIn.apiKey, operation, variables))
      .pipe(
        Effect.flatMap(hashnodeAnswerOf(schema)),
        Effect.mapError(() => new PlatformUnavailable()),
        Effect.flatMap(
          (answer): Effect.Effect<A, PlatformUnavailable | SiteRefused> =>
            Option.match(answer, {
              onNone: () => Effect.fail(new PlatformUnavailable()),
              onSome: (known: HashnodeAnswer<A>) =>
                known._tag === "data"
                  ? Effect.succeed(known.data)
                  : Effect.fail(refusalOf(known.errors)),
            })
        )
      );

  // The publication at `host`, which the member may publish to: their own,
  // or a team's where they are an owner or an editor. A member the
  // visible list leaves out (Hashnode hides members who chose to be
  // private) is not refused: the first article says whether they may.
  const publicationFor = Effect.fn("HashnodeKeyVerifier.publicationFor")(
    function* publicationFor(signIn: SiteKeySignIn, host: string, me: string) {
      let after: string | null = null;

      for (let page = 1; page <= maxMemberPages; page += 1) {
        const answer: typeof FoundSchema.Type = yield* ask(
          signIn,
          publicationAt,
          { after, host },
          FoundSchema
        );

        const { publication: found } = answer;

        if (found === null) {
          return yield* new SiteRefused({ reason: "publicationNotFound" });
        }

        if (found.author.id === me) {
          return found;
        }

        const listed = found.members.edges.find(
          ({ node }) => node.user.id === me
        );

        if (listed !== undefined) {
          return yield* publishingRoles.has(listed.node.role.toUpperCase())
            ? Effect.succeed(found)
            : new SiteRefused({ reason: "cannotPublish" });
        }

        const { endCursor, hasNextPage } = found.members.pageInfo;

        if (!hasNextPage || endCursor === null || endCursor === undefined) {
          return found;
        }

        after = endCursor;
      }

      return yield* new PlatformUnavailable();
    }
  );

  return Effect.fn("HashnodeKeyVerifier.verify")(function* verify(
    signIn: SiteKeySignIn
  ) {
    const { me } = yield* ask(signIn, member, {}, MemberSchema);
    const own = me.publications.edges.map(({ node }) => node);

    const publication = yield* Option.match(signIn.publication, {
      onNone: () => {
        const [only, ...more] = own;

        if (only === undefined) {
          return Effect.fail(
            new SiteRefused({ reason: "publicationNotFound" })
          );
        }

        return more.length > 0
          ? Effect.fail(new SiteRefused({ reason: "publicationRequired" }))
          : Effect.succeed(only);
      },
      onSome: (written) => {
        const host = hostOf(written);
        const mine = own.find((known) => publicationHost(known) === host);

        if (mine !== undefined) {
          return Effect.succeed(mine);
        }

        // A team's publication the member writes for is not among theirs.
        return host === ""
          ? Effect.fail(new SiteRefused({ reason: "publicationNotFound" }))
          : publicationFor(signIn, host, me.id);
      },
    });

    const site: VerifiedSite = {
      accountId: publication.id,
      avatarUrl: Option.fromNullishOr(me.profilePicture).pipe(
        Option.flatMap(decodeAvatar)
      ),
      displayName: Option.some(publication.title).pipe(
        Option.filter((title) => title.trim() !== "")
      ),
      handle: publicationHost(publication) || me.username,
      scopes: [],
    };

    return site;
  });
});

// Hashnode's refusal at connection: the token, the Pro plan, or Hashnode.
const refusalOf = (
  errors: readonly { readonly code: string; readonly message: string }[]
): PlatformUnavailable | SiteRefused => {
  if (errors.some((error) => error.code === "UNAUTHENTICATED")) {
    return new SiteRefused({ reason: "credentialsRefused" });
  }

  if (errors.some(isPlanRefusal)) {
    return new SiteRefused({ reason: "planRequired" });
  }

  if (errors.some((error) => error.code === "NOT_FOUND")) {
    return new SiteRefused({ reason: "publicationNotFound" });
  }

  return new PlatformUnavailable();
};
