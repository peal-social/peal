import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";

import {
  fittedName,
  maxPersonNameLength,
  readsAsLink,
  typedName,
} from "#shared/domain/display-name.ts";

describe(readsAsLink, () => {
  it.each([
    "https://evil.example/claim",
    "Visit evil.com today",
    "WWW.EVIL.NET",
    "www.example",
    "bit.ly",
    "EVIL.RU",
    "Acme.io",
    "xn--80ak6aa92e.xn--p1ai",
    "Support team evil．com",
    "hxxp://not-a-scheme",
  ])("reads %s as a link", (name) => {
    expect(readsAsLink(name)).toBeTruthy();
  });

  it.each([
    "St. John",
    "J.R.R. Tolkien",
    "Jane Doe, M.Sc",
    "Dr.Jo Martin",
    "Ph.D. candidates",
    "Acme Inc.",
    "Équipe Marketing",
    "Studio 54",
    "St.Louis Bakery",
    "Anne-Marie O'Neil",
    "李小龍",
  ])("reads %s as a name", (name) => {
    expect(readsAsLink(name)).toBeFalsy();
  });
});

describe(typedName, () => {
  it("keeps a name on one line, without control characters", () => {
    expect(
      typedName("  Jane\n\tDoe\u0000 ", maxPersonNameLength)
    ).toStrictEqual(Result.succeed("Jane Doe"));
  });

  it("refuses what is empty, too long, or a link", () => {
    expect(
      typedName(` ${String.fromCodePoint(0x20_2e)} `, maxPersonNameLength)
    ).toStrictEqual(Result.fail("empty"));
    expect(
      typedName("a".repeat(maxPersonNameLength + 1), maxPersonNameLength)
    ).toStrictEqual(Result.fail("tooLong"));
    expect(
      typedName("a".repeat(maxPersonNameLength), maxPersonNameLength)
    ).toStrictEqual(Result.succeed("a".repeat(maxPersonNameLength)));
    expect(
      typedName("Claim your prize at evil.com", maxPersonNameLength)
    ).toStrictEqual(Result.fail("link"));
  });
});

describe(fittedName, () => {
  it("takes the link out of a name it is given, rather than refusing it", () => {
    expect(fittedName("Prize at https://evil.com/x", 100)).toBe(
      "Prize at https evil com/x"
    );
    expect(
      readsAsLink(fittedName("Prize at https://evil.com/x", 100))
    ).toBeFalsy();
    expect(fittedName("Jane Doe", 100)).toBe("Jane Doe");
    expect(fittedName("Jane\nDoe", 4)).toBe("Jane");
  });
});
