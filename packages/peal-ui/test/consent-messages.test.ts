import { describe, expect, it } from "vitest";

import { consentMessages } from "../src/lib/site/consent/messages";
import type { ConsentMessages } from "../src/lib/site/consent/messages";

// Every string of a catalogue, with its key.
const strings = ({ readout, ...rest }: ConsentMessages): [string, string][] => [
  ...Object.entries(rest),
  ...Object.entries(readout).map(([key, text]): [string, string] => [
    `readout.${key}`,
    text,
  ]),
];

describe("the consent notice's strings", () => {
  it("have the same keys in English and French", () => {
    expect(strings(consentMessages.fr).map(([key]) => key)).toStrictEqual(
      strings(consentMessages.en).map(([key]) => key)
    );
  });

  it("hold no em dash and no exclamation mark", () => {
    for (const locale of ["en", "fr"] as const) {
      for (const [, text] of strings(consentMessages[locale])) {
        expect(text).not.toMatch(/[—!]/u);
      }
    }
  });

  it("set French punctuation with its narrow and no-break spaces", () => {
    for (const [, text] of strings(consentMessages.fr)) {
      // A question mark after U+202F, never a plain space or none.
      for (const match of text.matchAll(/(?<before>.)\?/gu)) {
        expect(match.groups?.["before"]).toBe(" ");
      }

      // A colon after U+00A0.
      for (const match of text.matchAll(/(?<before>.):/gu)) {
        expect(match.groups?.["before"]).toBe(" ");
      }

      expect(text).not.toMatch(/« | »/u);
      expect(text).not.toMatch(/«[^ ]|[^ ]»/u);
    }

    expect(consentMessages.fr.title).toBe("Un cookie, vous permettez ?");
  });

  it("put each number beside its unit with a no-break space", () => {
    expect(consentMessages.en.text).toContain("6 months");
    expect(consentMessages.fr.text).toContain("6 mois");
    expect(consentMessages.en.readout.allow).toBe("cookie: 183 d");
    expect(consentMessages.fr.readout.allow).toBe("cookie : 183 j");
  });

  it("use the app's labels for the two answers", () => {
    expect([consentMessages.en.allow, consentMessages.en.refuse]).toStrictEqual(
      ["Allow", "Don’t allow"]
    );
    expect([consentMessages.fr.allow, consentMessages.fr.refuse]).toStrictEqual(
      ["Autoriser", "Refuser"]
    );
  });
});
