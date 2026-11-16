import { Option, Schema } from "effect";

import type { Locale } from "./i18n/locales.ts";

// The header's star count, read from GitHub's API at build time without a
// token: the unauthenticated limit (60 an hour) is ample for one build.

const repositoryApi = "https://api.github.com/repos/peal-social/peal";

const RepositorySchema = Schema.Struct({
  stargazers_count: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/** The star count in GitHub's answer for a repository, if it holds one. */
export const starsFrom = async (
  response: Response
): Promise<number | undefined> => {
  if (!response.ok) {
    return undefined;
  }

  return Schema.decodeUnknownOption(RepositorySchema)(
    await response.json()
  ).pipe(
    Option.map((repository) => repository.stargazers_count),
    Option.getOrUndefined
  );
};

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * The repository's star count, or `undefined` when GitHub does not give
 * one in five seconds: the header then shows no count.
 */
export const fetchStars = async (
  fetcher: Fetch = fetch
): Promise<number | undefined> => {
  try {
    const response = await fetcher(repositoryApi, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "peal-site-build",
      },
      signal: AbortSignal.timeout(5000),
    });

    return await starsFrom(response);
  } catch {
    return undefined;
  }
};

/** A star count as the header shows it: 7, 1.2K, or 1,2 k in French. */
export const formatStars = (count: number, locale: Locale): string =>
  new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(count);

let stars: Promise<number | undefined> | undefined;

/** The star count, fetched once per build for every page. */
export const repositoryStars = async (): Promise<number | undefined> => {
  stars ??= fetchStars();

  return await stars;
};
