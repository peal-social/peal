import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";

import {
  fittedName,
  holdsLinkMarker,
  maxPersonNameLength,
  nameForMail,
  readsAsAddress,
  typedName,
} from "#shared/domain/display-name.ts";

describe(readsAsAddress, () => {
  it.each([
    "https://evil.example/claim",
    "Visit evil.com today",
    "WWW.EVIL.NET",
    "login-peal.social",
    "evil.social/login",
    "evil.finance",
    "Evil.Io",
    "evil.Ru",
    "admin@evil.social",
    "93.184.216.34/x",
    "пример.рф",
    "Support team evil．com",
    "Booking.com",
    "Node.js",
    "Fly.io",
    "evil\u0065\u0301.com",
    "हिन्दी.भारत",
    "tel:+19005550199",
    "SMS:+19005550199",
    "Call +1 900 555 0199",
    "(900) 555-0199",
  ])("reads %s as an address", (name) => {
    expect(readsAsAddress(name)).toBeTruthy();
  });

  it.each([
    "St. John",
    "J.R.R. Tolkien",
    "Ph.D. candidates",
    "Acme Inc.",
    "Équipe Marketing",
    "Studio 54",
    "Anne-Marie O'Neil",
    "李小龍",
    "Version 1.2",
    "Studio 2026",
    "Hôtel du Nord",
    "Team 555",
  ])("reads %s as a name", (name) => {
    expect(readsAsAddress(name)).toBeFalsy();
  });
});

describe(nameForMail, () => {
  it("shows a name as written, and the fallback for one that reads as an address", () => {
    expect(nameForMail("St. John", "A member")).toBe("St. John");
    expect(nameForMail("Booking.com", "A member")).toBe("A member");
  });
});

describe(typedName, () => {
  it("keeps a name on one line, without control characters", () => {
    expect(
      typedName("  Jane\n\tDoe\u0000 ", maxPersonNameLength)
    ).toStrictEqual(Result.succeed("Jane Doe"));
  });

  it("takes names that look like hosts, which emails leave out instead", () => {
    for (const name of ["Node.js", "Next.js Paris", "Booking.com", "J.LO"]) {
      expect(typedName(name, maxPersonNameLength)).toStrictEqual(
        Result.succeed(name)
      );
    }
  });

  it("refuses what is empty, too long, or holds a link's markers", () => {
    expect(
      typedName(` ${String.fromCodePoint(0x20_2e)} `, maxPersonNameLength)
    ).toStrictEqual(Result.fail("empty"));
    expect(
      typedName("a".repeat(maxPersonNameLength + 1), maxPersonNameLength)
    ).toStrictEqual(Result.fail("tooLong"));
    expect(
      typedName("a".repeat(maxPersonNameLength), maxPersonNameLength)
    ).toStrictEqual(Result.succeed("a".repeat(maxPersonNameLength)));

    for (const name of ["Prize at https://evil.example", "see www.evil"]) {
      expect(typedName(name, maxPersonNameLength)).toStrictEqual(
        Result.fail("link")
      );
    }
  });
});

describe(fittedName, () => {
  it("takes a link's markers out of a name it is given, rather than refusing it", () => {
    expect(fittedName("Prize at https://evil.com/x", 100)).toBe(
      "Prize at https evil.com/x"
    );
    expect(holdsLinkMarker(fittedName("go to www.evil.com", 100))).toBeFalsy();
    expect(fittedName("Jane Doe", 100)).toBe("Jane Doe");
    expect(fittedName("Jane\nDoe", 4)).toBe("Jane");
  });
});
