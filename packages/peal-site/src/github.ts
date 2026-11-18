import { Option, Schema } from "effect";
import { fetchStars, repositoryApi } from "peal-ui/lib/site/stars";
import type { Fetch } from "peal-ui/lib/site/stars";

// What the site reads from GitHub's API at build time without a token: the
// header's star count (peal-ui's lib/site/stars.ts, which the blog shares)
// and the home page's latest merged pull requests.

const PullsSchema = Schema.Array(
  Schema.Struct({
    html_url: Schema.String,
    merged_at: Schema.NullOr(Schema.String),
    number: Schema.Int,
    title: Schema.String,
  })
);

/** A merged pull request, as the home page lists it. */
export interface MergedPull {
  readonly href: string;
  readonly mergedAt: string;
  readonly number: number;
  readonly title: string;
}

// A title's trailing work-package codes, such as "(U13b)" or "(N1 to N5)".
const workCodes = /\s*\((?=[^)]*\b[A-Z]{1,3}\d)[^)]*\)\s*$/u;

/** A pull request's title without the work-package codes it ends with. */
export const pullTitle = (title: string): string =>
  title.replace(workCodes, "").trim();

/**
 * The repository's three pull requests merged last, newest first, or none
 * when GitHub does not answer: the home page then hides the list.
 */
export const fetchMergedPulls = async (
  fetcher: Fetch = fetch
): Promise<readonly MergedPull[]> => {
  try {
    const response = await fetcher(
      `${repositoryApi}/pulls?state=closed&sort=updated&direction=desc&per_page=30`,
      {
        headers: {
          accept: "application/vnd.github+json",
          "user-agent": "peal-site-build",
        },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      return [];
    }

    const pulls = Schema.decodeUnknownOption(PullsSchema)(
      await response.json()
    ).pipe(Option.getOrElse(() => []));

    return pulls
      .flatMap(({ html_url: href, merged_at: mergedAt, number, title }) =>
        mergedAt === null
          ? []
          : [{ href, mergedAt, number, title: pullTitle(title) }]
      )
      .toSorted((a, b) => b.mergedAt.localeCompare(a.mergedAt))
      .slice(0, 3);
  } catch {
    return [];
  }
};

let pulls: Promise<readonly MergedPull[]> | undefined;

/** The latest merged pull requests, fetched once per build. */
export const latestPulls = async (): Promise<readonly MergedPull[]> => {
  pulls ??= fetchMergedPulls();

  return await pulls;
};

let stars: Promise<number | undefined> | undefined;

/** The star count, fetched once per build for every page. */
export const repositoryStars = async (): Promise<number | undefined> => {
  stars ??= fetchStars();

  return await stars;
};
