import { fetchStars } from "peal-ui/lib/site/stars";
import type { Fetch } from "peal-ui/lib/site/stars";

// The header's star count. The site reads it once a build; the blog renders
// on request, so it keeps the count an hour, and asks GitHub at most once
// an hour whatever it answered.

const hour = 60 * 60 * 1000;

export interface StarMemo {
  /** The count, from GitHub at most once per hour. */
  readonly stars: () => Promise<number | undefined>;
}

export const starMemo = (
  fetcher: Fetch = fetch,
  now: () => number = Date.now
): StarMemo => {
  let current: { at: number; count: Promise<number | undefined> } | undefined;

  return {
    stars: async () => {
      if (current === undefined || now() - current.at >= hour) {
        current = { at: now(), count: fetchStars(fetcher, "peal-blog") };
      }

      return await current.count;
    },
  };
};

const memo = starMemo();

/** The repository's star count, for every page of this server. */
export const repositoryStars = async (): Promise<number | undefined> =>
  await memo.stars();
