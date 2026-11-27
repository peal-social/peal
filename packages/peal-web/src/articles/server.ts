import { Effect, Option } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { headers } from "next/headers";
import { Api, forWorkspace } from "peal-contract";

import { serverUrl } from "#api/server-url.ts";

const readSite = Effect.fn("articleSite")(function* readSite(
  cookie: string,
  workspaceId: string,
  articleId: string
) {
  const client = yield* HttpApiClient.make(Api, {
    baseUrl: yield* serverUrl,
    transformClient: HttpClient.mapRequest(
      HttpClientRequest.setHeader("cookie", cookie)
    ),
  });

  const article = yield* client.articles.get({
    headers: forWorkspace(workspaceId),
    params: { articleId },
  });

  return article.channelId;
}, Effect.provide(FetchHttpClient.layer));

/**
 * For Server Components: the website an article of the workspace is for,
 * read from the server at PEAL_API_URL with the visitor's cookies, or
 * none when it could not be read (an article deleted, or not theirs).
 */
export const articleSiteOf = async (
  workspaceId: string,
  articleId: string
): Promise<Option.Option<string>> => {
  const incoming = await headers();
  const cookie = incoming.get("cookie");

  if (cookie === null) {
    return Option.none();
  }

  return await Effect.runPromise(
    readSite(cookie, workspaceId, articleId).pipe(
      Effect.timeout("5 seconds"),
      Effect.map(Option.some),
      Effect.catchCause(() => Effect.succeed(Option.none<string>()))
    )
  );
};
