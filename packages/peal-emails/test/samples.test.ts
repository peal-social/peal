import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, expectTypeOf, it } from "vitest";

import {
  accountSamples,
  digestSample,
  identity,
  noticeSamples,
  noticeUrl,
  reasonSamples,
  workspaceName,
} from "../previews/_support/samples.ts";
import {
  emailAssets,
  renderNoticeEmail,
  renderWeeklyDigest,
  renderAccountEmail,
} from "../src/index.ts";
import type {
  AccountEmail,
  Letterhead,
  Locale,
  NoticeEvent,
  RenderedEmail,
} from "../src/index.ts";
import { accountEmail, letterhead, weeklyDigest } from "./support.ts";

interface Sample {
  /** The most its HTML may weigh, in kB. */
  readonly kilobytes: number;
  /** Whether its header's glow moves. */
  readonly moves: boolean;
  readonly name: string;
  readonly render: (on?: Letterhead) => Promise<RenderedEmail>;
  /** Its heading, when it is not its subject. */
  readonly title?: string;
  readonly url: string;
}

// What an email weighs at most: far from where Gmail clips it.
const messageKilobytes = 20;

// The glow moves in the first emails someone gets, and in the digest.
const moving: ReadonlySet<string> = new Set([
  "Invitation",
  "VerifyEmail",
] satisfies AccountEmail["_tag"][]);

const samplesIn = (locale: Locale): readonly Sample[] => [
  ...Object.entries(accountSamples(locale)).map(([name, email]) => ({
    kilobytes: messageKilobytes,
    moves: moving.has(email._tag),
    name,
    render: async (on = letterhead) => await renderAccountEmail(email, on),
    url: email.url,
  })),
  ...[
    ...Object.entries(noticeSamples),
    ...reasonSamples.map((event) => [event._tag, event] as const),
  ].map(([name, event]) => ({
    kilobytes: messageKilobytes,
    moves: false,
    name,
    render: async (on = letterhead) =>
      await renderNoticeEmail(
        { event, locale, url: noticeUrl, workspaceName },
        on
      ),
    url: noticeUrl,
  })),
  {
    kilobytes: 40,
    moves: true,
    name: "weeklyDigest",
    render: async (on = letterhead) =>
      await renderWeeklyDigest(digestSample(locale), on),
    title: locale === "fr" ? "Votre semaine sur Peal" : "Your week on Peal",
    url: digestSample(locale).calendarUrl,
  },
];

const placeholder = /\{\w+\}/u;

// What React escapes in text.
const entities = new Map([
  ["&", "&amp;"],
  ['"', "&quot;"],
  ["'", "&#x27;"],
  ["<", "&lt;"],
  [">", "&gt;"],
]);

const escaped = (words: string): string =>
  words.replaceAll(/["&'<>]/gu, (character) => entities.get(character) ?? "");

// The HTML without what keeps "e-mail" on one line.
const withoutNowrap = (html: string): string =>
  html.replaceAll(
    /<span style="white-space:nowrap">(?<words>[^<]*)<\/span>/gu,
    "$<words>"
  );

// What is left of an email's body without its pictures and its tags, as it
// is written in the HTML.
const wordsOf = (html: string): string =>
  withoutNowrap(html)
    .replace(/<head>.*?<\/head>/su, "")
    .replaceAll(/<!--.*?-->/gsu, "")
    .replaceAll(/<[^>]*>/gu, " ");

const picturesOf = (html: string): readonly string[] =>
  html.match(/<img [^>]*>/gu) ?? [];

const attributeOf = (tag: string, name: string): string | undefined =>
  new RegExp(` ${name}="(?<value>[^"]*)"`, "u").exec(tag)?.groups?.["value"];

const sourcesOf = (html: string): readonly (string | undefined)[] =>
  picturesOf(html).map((picture) => attributeOf(picture, "src"));

const assetsIn = `${letterhead.assetsUrl}/`;

const stated: Letterhead = { ...letterhead, identity: `${identity} <&> Co` };

describe.each(["en", "fr"] as const)("every email, in %s", (locale) => {
  it.each(samplesIn(locale))(
    "$name is whole: no placeholder left, its link in both parts, light",
    async ({ kilobytes, render, url }) => {
      const { html, subject, text } = await render();

      for (const part of [html, subject, text]) {
        expect(part).not.toMatch(placeholder);
        expect(part).not.toContain("undefined");
      }

      expect(subject.trim()).not.toBe("");
      expect(text).toContain(url);
      expect(html).toContain(`href="${url.replaceAll("&", "&amp;")}"`);
      expect(html).toMatch(new RegExp(`<html [^>]*lang="${locale}"`, "u"));
      expect(Buffer.byteLength(html)).toBeLessThan(kilobytes * 1024);
    }
  );

  it.each(samplesIn(locale))(
    "$name has its subject as its title, and one heading",
    async ({ render, title }) => {
      const { html, subject } = await render();

      expect(html).toContain(`<title>${escaped(subject)}</title>`);
      expect(html.match(/<h1/gu)).toHaveLength(1);
      expect(withoutNowrap(html)).toMatch(/<h1[^>]*>[^<]+<\/h1>/u);
      expect(withoutNowrap(html)).toContain(
        `>${escaped(title ?? subject)}</h1>`
      );
    }
  );

  it.each(samplesIn(locale))(
    "$name starts in an inbox as it starts, or with a digest's first counts",
    async ({ render, title }) => {
      const { html, text } = await render();
      const start = /^.{1,40}/u.exec(text)?.[0] ?? "";

      const preview =
        /<div style="display:none[^>]*>(?<words>[^<]*)/u.exec(html)?.groups?.[
          "words"
        ] ?? "";

      expect(preview).not.toBe("");

      expect(preview.startsWith(escaped(start))).toBe(title === undefined);
    }
  );

  it.each(samplesIn(locale))(
    "$name shows pictures of the server's alone, at addresses that say nothing of the reader",
    async ({ render }) => {
      const { html } = await render();

      for (const picture of picturesOf(html)) {
        expect(attributeOf(picture, "alt")).toBe("");
        expect(attributeOf(picture, "width")).toMatch(/^\d+$/u);
        expect(attributeOf(picture, "height")).toMatch(/^\d+$/u);
      }

      const names = sourcesOf(html).map((source) =>
        source?.startsWith(assetsIn) === true
          ? source.slice(assetsIn.length)
          : source
      );

      expect(
        names.filter((name) => name === undefined || !emailAssets.has(name))
      ).toStrictEqual([]);
      expect(names.length).toBeGreaterThanOrEqual(3);
      expect(html).not.toMatch(/background-image|url\(|data:|srcset/u);
    }
  );

  it.each(samplesIn(locale))(
    "$name says everything without its pictures",
    async ({ render, title, url }) => {
      const email = await render();
      const words = wordsOf(email.html);

      expect(words).toMatch(/ Peal /u);
      expect(words).toContain(escaped(title ?? email.subject));
      expect(words).toContain(escaped(url));

      // Each paragraph of the text but the button's link and the digest's
      // parts, which the HTML lays out otherwise.
      const missing = email.text
        .split("\n\n")
        .filter(
          (paragraph) =>
            !/\n|https:/u.test(paragraph) && !words.includes(escaped(paragraph))
        );

      expect(missing).toStrictEqual([]);
    }
  );

  it.each(samplesIn(locale))(
    "$name asks to stay light, and gives each text its ground",
    async ({ render }) => {
      const { html } = await render();

      expect(html).toContain('<meta content="light only" name="color-scheme"');
      expect(html).toContain(
        '<meta content="light only" name="supported-color-schemes"'
      );
      // The page, then the card.
      expect(html).toMatch(
        /<body [^>]*background-color:#fafaf9.*<table [^>]*background-color:#ffffff/su
      );
    }
  );

  it.each(samplesIn(locale))(
    "$name moves as its family does",
    async ({ moves, render }) => {
      const { html } = await render();

      expect(
        sourcesOf(html).filter(
          (source) => source?.includes("/header.") ?? false
        )
      ).toStrictEqual(
        moves
          ? [`${assetsIn}header.gif`, `${assetsIn}header.png`]
          : [`${assetsIn}header.png`]
      );
    }
  );

  it.each(samplesIn(locale))(
    "$name hides no picture by its own style, which Outlook ignores, but by what holds it",
    async ({ moves, render }) => {
      const { html } = await render();

      expect(
        picturesOf(html).filter((picture) =>
          /display:none|mso-hide/u.test(attributeOf(picture, "style") ?? "")
        )
      ).toStrictEqual([]);

      // Around the moving header's still alone: hidden by `display`, by
      // Word's own property, and by its size where a client takes neither.
      const holders = [
        ...html.matchAll(
          /<div class="peal-still" style="(?<style>[^"]*)"><img [^>]*src="(?<source>[^"]*)"[^>]*><\/div>/gu
        ),
      ].map(({ groups }) => ({
        source: groups?.["source"],
        style: groups?.["style"]?.split(";").toSorted(),
      }));

      expect(holders).toStrictEqual(
        moves
          ? [
              {
                source: `${assetsIn}header.png`,
                style: [
                  "display:none",
                  "font-size:0",
                  "line-height:0",
                  "max-height:0",
                  "mso-hide:all",
                  "overflow:hidden",
                ],
              },
            ]
          : []
      );
    }
  );

  it.each(samplesIn(locale))(
    "$name states who sends, last, where the server does",
    async ({ render }) => {
      const plain = await render();
      const signed = await render(stated);
      const line = stated.identity ?? "";

      expect(signed.subject).toBe(plain.subject);
      expect(signed.text).toBe(`${plain.text}\n\n${line}`);
      expect(signed.html.split(escaped(line))).toHaveLength(2);
      // After the card, whose last picture closes it.
      expect(signed.html.indexOf(escaped(line))).toBeGreaterThan(
        signed.html.indexOf("footer.png")
      );
      expect(`${plain.html}${plain.text}`).not.toContain(identity);
    }
  );

  // The tests that read emails from Mailpit, the server's and the
  // end-to-end run's, take the first address of the text.
  it.each(Object.entries(accountSamples(locale)))(
    "%s has its link as the first address of its text",
    async (_, email) => {
      const { text } = await accountEmail(email);

      expect(/https?:\/\/\S+/u.exec(text)?.[0]).toBe(email.url);
    }
  );

  it.each(samplesIn(locale))(
    '$name never breaks "e-mail" over two lines where it is read',
    async ({ render }) => {
      const { html } = await render();

      // But for the inbox's preview, which is one line.
      const read = html.replace(
        /<div style="display:none[^>]*>.*?<\/div>/su,
        ""
      );

      expect(
        read
          .replace(/<head>.*?<\/head>/su, "")
          .replaceAll(
            /<span style="white-space:nowrap">e-mails?<\/span>/giu,
            ""
          )
          .match(/e-mail/giu)
      ).toBeNull();
    }
  );

  it("is escaped by React once, and no more", async () => {
    const { html } = await weeklyDigest(digestSample(locale));

    expect(html).toContain("Studio &lt;Nord&gt; &amp; Co");
    expect(html).not.toContain("&amp;lt;");
    expect(html).not.toContain("<b>soon</b>");
  });
});

interface Tagged {
  readonly _tag: string;
}

type TagOf<Samples extends Readonly<Record<string, Tagged>>> =
  Samples[keyof Samples]["_tag"];

// Told in the app alone, never emailed: nothing to preview.
const inAppOnly: ReadonlySet<string> = new Set([
  "SlideshowEnded",
  "VideoGenerationEnded",
] satisfies NoticeEvent["_tag"][]);

const fileNameOf = (name: string): string =>
  `${name.replaceAll(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}.tsx`;

const previewsIn = (folder: string): readonly string[] =>
  readdirSync(
    path.join(import.meta.dirname, "..", "previews", folder)
  ).toSorted();

describe("the samples", () => {
  it("hold every account email and every notice", () => {
    expectTypeOf<
      Exclude<AccountEmail["_tag"], TagOf<ReturnType<typeof accountSamples>>>
    >().toBeNever();
    expectTypeOf<
      Exclude<NoticeEvent["_tag"], TagOf<typeof noticeSamples>>
    >().toBeNever();
  });

  it("have a preview each, but for what is told in the app alone", () => {
    expect(previewsIn("account")).toStrictEqual(
      Object.keys(accountSamples("en")).map(fileNameOf).toSorted()
    );
    expect(previewsIn("notices")).toStrictEqual(
      Object.entries(noticeSamples)
        .filter(([, { _tag }]) => !inAppOnly.has(_tag))
        .map(([name]) => fileNameOf(name))
        .toSorted()
    );
  });
});
