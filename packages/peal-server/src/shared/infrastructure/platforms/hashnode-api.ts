import { Effect, Option, Redacted, Schema } from "effect";
import { HttpClientRequest, HttpClientResponse } from "effect/http";

// What the channels and publishing contexts share of Hashnode's GraphQL
// API (its schema, read at gql-beta.hashnode.com, and its own agent
// guide, github.com/Hashnode/gql-skill): where it is, how a member's
// personal access token is sent, and how it answers. Hashnode answers
// 200 to a request it refused: the refusal is in `errors`, with its
// `extensions.code` (UNAUTHENTICATED, FORBIDDEN, NOT_FOUND,
// BAD_USER_INPUT, INTERNAL_SERVER_ERROR). Since 2026-05-13 its API
// answers only for a publication on its Pro plan, refused FORBIDDEN.

/** Where Hashnode's API is. */
export interface HashnodeHosts {
  readonly api: string;
}

export const hashnodeHosts: HashnodeHosts = {
  api: "https://gql-beta.hashnode.com/",
};

/** A value of an operation's variables, as JSON writes it. */
export type GraphQlValue =
  | boolean
  | number
  | string
  | null
  | readonly GraphQlValue[]
  | { readonly [field: string]: GraphQlValue };

/** An operation's variables, by name. */
export interface GraphQlVariables {
  readonly [name: string]: GraphQlValue;
}

/** A request of one named operation, signed with the member's token. */
export const hashnodeRequest = (
  hosts: HashnodeHosts,
  token: Redacted.Redacted,
  operation: { readonly name: string; readonly query: string },
  variables: GraphQlVariables
): HttpClientRequest.HttpClientRequest =>
  HttpClientRequest.post(hosts.api).pipe(
    HttpClientRequest.setHeader("authorization", Redacted.value(token)),
    HttpClientRequest.acceptJson,
    HttpClientRequest.bodyJsonUnsafe({
      operationName: operation.name,
      query: operation.query,
      variables,
    })
  );

const ErrorSchema = Schema.Struct({
  extensions: Schema.optionalKey(
    Schema.Struct({ code: Schema.optionalKey(Schema.String) })
  ),
  message: Schema.optionalKey(Schema.String),
});

/** How Hashnode refused an operation. */
export interface HashnodeError {
  readonly code: string;
  readonly message: string;
}

/** What an operation answered: its data, or why it was refused. */
export type HashnodeAnswer<A> =
  | { readonly _tag: "data"; readonly data: A }
  | { readonly _tag: "refused"; readonly errors: readonly HashnodeError[] };

/**
 * Hashnode's answer, read with the data's schema; none when the answer
 * is not GraphQL's, as a proxy's page or a 5xx.
 */
export const hashnodeAnswerOf =
  <A, I>(data: Schema.Codec<A, I>) =>
  (
    response: HttpClientResponse.HttpClientResponse
  ): Effect.Effect<Option.Option<HashnodeAnswer<A>>> =>
    HttpClientResponse.schemaBodyJson(
      Schema.Struct({
        data: Schema.optionalKey(Schema.NullOr(Schema.Unknown)),
        errors: Schema.optionalKey(Schema.Array(ErrorSchema)),
      })
    )(response).pipe(
      Effect.flatMap((body) => {
        const errors = body.errors ?? [];

        if (errors.length > 0) {
          const refused: HashnodeAnswer<A> = {
            _tag: "refused",
            errors: errors.map((error) => ({
              code: error.extensions?.code ?? "",
              message: error.message ?? "",
            })),
          };

          return Effect.succeed(Option.some(refused));
        }

        return Schema.decodeUnknownEffect(data)(body.data).pipe(
          Effect.map((decoded) =>
            Option.some<HashnodeAnswer<A>>({ _tag: "data", data: decoded })
          )
        );
      }),
      Effect.orElseSucceed(() => Option.none<HashnodeAnswer<A>>())
    );

/** Whether Hashnode refused for want of its Pro plan on the publication. */
export const isPlanRefusal = (error: HashnodeError): boolean =>
  error.code === "FORBIDDEN" && /\bpro\b/iu.test(error.message);
