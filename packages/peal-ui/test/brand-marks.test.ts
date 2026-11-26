// The marks outside simple-icons are copied from their owners' files, never
// drawn: each must still be in the file it came from.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  googleBusinessProfilePaths,
  grokBotPaths,
  linkedin,
  muse,
  openaiBlossom,
  slackPaths,
} from "../src/lib/brand-marks.ts";

const fileOf = (name: string) =>
  readFileSync(
    path.join(import.meta.dirname, "../src/brand-marks", name),
    "utf-8"
  );

describe("the brand marks outside simple-icons", () => {
  it("draws LinkedIn's mark from LinkedIn's symbol", () => {
    expect(fileOf("linkedin.svg")).toContain(`d="${linkedin.path}"`);
  });

  it("draws Slack's mark from Slack's black icon, every path of it", () => {
    const file = fileOf("slack.svg");

    const filePaths = [...file.matchAll(/ d="(?<d>[^"]+)"/gu)].map(
      (match) => match.groups?.["d"]
    );

    expect(filePaths).toStrictEqual([...slackPaths]);
  });

  it("draws OpenAI's Blossom from OpenAI's black file", () => {
    expect(fileOf("openai-blossom.svg")).toContain(`d="${openaiBlossom.path}"`);
  });

  it("makes Grok Bot's mark from x.ai's drawing alone: its head, eyes cut out", () => {
    const file = fileOf("grok-bot.svg");

    expect(file).toContain(
      `class="grok-bot-mark__head" d="${grokBotPaths.head}"`
    );

    for (const eye of grokBotPaths.eyes) {
      expect(file).toContain(`class="grok-bot-mark__eye" d="${eye}"`);
    }
  });

  it("draws Muse's mark from Muse's own file", () => {
    expect(fileOf("muse.svg")).toContain(`d="${muse.path}"`);
  });

  it("makes Google Business Profile's one-colour mark from Google's file alone", () => {
    const file = fileOf("google-business-profile.svg");

    expect(file).toContain(
      `<path d="${googleBusinessProfilePaths.outline}" id="c"/>`
    );
    expect(file).toContain(
      `<path d="${googleBusinessProfilePaths.g}" fill="#EEE"/>`
    );
  });
});
