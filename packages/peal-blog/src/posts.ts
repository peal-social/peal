import {
  decodeSlug,
  getEmDashCollection,
  getEmDashEntry,
  getTranslations,
} from "emdash";
import { locales } from "peal-ui/lib/site/locales";
import type { Locale } from "peal-ui/lib/site/locales";

import type { Translations } from "./chrome.ts";
import { blogLink } from "./links.ts";

// What the pages read from EmDash: the published posts of a language, and
// one post with its published translations. Kept in TypeScript, since
// TypeScript does not read .astro files.

/** A post as the index lists it. */
export interface PostSummary {
  readonly date: string | undefined;
  readonly excerpt: string | undefined;
  readonly href: string;
  readonly id: string;
  readonly title: string;
}

/** A date as a post shows it: 18 November 2026, 18 novembre 2026. */
export const formatDate = (date: Date, locale: Locale): string =>
  new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(date);

/** The published posts in a language, newest first. */
export const publishedPosts = async (
  locale: Locale
): Promise<readonly PostSummary[]> => {
  const { entries } = await getEmDashCollection("posts", {
    locale,
    orderBy: { published_at: "desc" },
    status: "published",
  });

  // A post without a slug has no address of its own.
  return entries.flatMap(({ data }) =>
    data.slug === null
      ? []
      : [
          {
            date:
              data.publishedAt === null
                ? undefined
                : formatDate(data.publishedAt, locale),
            excerpt: data.excerpt,
            href: blogLink(locale, data.slug),
            id: data.id,
            title: data.title,
          },
        ]
  );
};

const entryOf = async (slug: string, locale: Locale) => {
  const { entry } = await getEmDashEntry("posts", slug, { locale });

  return entry;
};

/**
 * One post in a language, by its slug (or its id, for a preview), with its
 * published translations; `undefined` when there is none, for the page to
 * rewrite to the 404.
 */
export const findPost = async (
  parameter: string | undefined,
  locale: Locale
) => {
  const slug = decodeSlug(parameter);

  const entry = slug === undefined ? undefined : await entryOf(slug, locale);

  return entry === null || entry === undefined
    ? undefined
    : { entry, translations: await publishedTranslations(entry.data.id) };
};

export type FoundPost = NonNullable<Awaited<ReturnType<typeof findPost>>>;

/** The 404 page under Astro's base, which a missing post rewrites to. */
export const notFoundPath = (): string =>
  `${import.meta.env.BASE_URL.replace(/\/+$/u, "")}/404`;

const isLocale = (value: string): value is Locale =>
  locales.some((locale) => locale === value);

/**
 * A post's published translations, by language, as the path of each below
 * the blog's root there.
 */
export const publishedTranslations = async (
  id: string
): Promise<Translations> => {
  const { translations } = await getTranslations("posts", id);

  return Object.fromEntries(
    translations.flatMap(({ locale, slug, status }) =>
      status === "published" && slug !== null && isLocale(locale)
        ? [[locale, slug]]
        : []
    )
  );
};
