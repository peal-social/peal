// The marks outside simple-icons are copied from their owners' files, never
// drawn: each must still be in the file it came from.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  googleBusinessProfilePaths,
  linkedin,
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
