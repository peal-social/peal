import { describe, expect, it } from "vitest";

import { nameForMail, readsAsAddress } from "../src/names.ts";

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
    "Synthetic Studio Inc.",
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
