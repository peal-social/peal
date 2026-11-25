import { describe, expect, it } from "vitest";

import {
  accountSamples,
  digestSample,
  noticeSamples,
  noticeUrl,
  reasonSamples,
  workspaceName,
} from "../previews/_support/samples.ts";
import {
  renderAccountEmail,
  renderNoticeEmail,
  renderWeeklyDigest,
} from "../src/index.ts";
import type { Locale, RenderedEmail } from "../src/index.ts";

interface Sample {
  readonly name: string;
  readonly render: () => Promise<RenderedEmail>;
  readonly url: string;
}

const samplesIn = (locale: Locale): readonly Sample[] => [
  ...Object.entries(accountSamples(locale)).map(([name, email]) => ({
    name,
    render: async () => await renderAccountEmail(email),
    url: email.url,
  })),
  ...[
    ...Object.entries(noticeSamples),
    ...reasonSamples.map((event) => [event._tag, event] as const),
  ].map(([name, event]) => ({
    name,
    render: async () =>
      await renderNoticeEmail({ event, locale, url: noticeUrl, workspaceName }),
    url: noticeUrl,
  })),
  {
    name: "weeklyDigest",
    render: async () => await renderWeeklyDigest(digestSample(locale)),
    url: digestSample(locale).calendarUrl,
  },
];

// Gmail clips a message past 102 kB, its unsubscribe link with it.
const clippedAt = 102 * 1024;

const placeholder = /\{\w+\}/u;

describe.each(["en", "fr"] as const)("every email, in %s", (locale) => {
  it.each(samplesIn(locale))(
    "$name is whole: no placeholder left, its link in both parts, short enough not to be clipped",
    async ({ render, url }) => {
      const { html, subject, text } = await render();

      for (const part of [html, subject, text]) {
        expect(part).not.toMatch(placeholder);
        expect(part).not.toContain("undefined");
      }

      expect(subject.trim()).not.toBe("");
      expect(text).toContain(url);
      expect(html).toContain(`href="${url.replaceAll("&", "&amp;")}"`);
      expect(html).toMatch(new RegExp(`<html [^>]*lang="${locale}"`, "u"));
      expect(Buffer.byteLength(html)).toBeLessThan(clippedAt);
    }
  );

  // The tests that read emails from Mailpit, the server's and the
  // end-to-end run's, take the first address of the text.
  it.each(Object.entries(accountSamples(locale)))(
    "%s has its link as the first address of its text",
    async (_, email) => {
      const { text } = await renderAccountEmail(email);

      expect(/https?:\/\/\S+/u.exec(text)?.[0]).toBe(email.url);
    }
  );

  it("is escaped by React once, and no more", async () => {
    const { html } = await renderWeeklyDigest(digestSample(locale));

    expect(html).toContain("Studio &lt;Nord&gt; &amp; Co");
    expect(html).not.toContain("&amp;lt;");
    expect(html).not.toContain("<b>soon</b>");
  });
});
