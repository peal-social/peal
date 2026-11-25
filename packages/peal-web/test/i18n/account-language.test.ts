import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";
import type { Me } from "peal-contract";

import {
  accountLanguageAddress,
  accountLanguageOf,
} from "#i18n/account-language.ts";

const person = (locale: "en" | "fr", impersonatedBy: string | null = null) =>
  ({
    impersonatedBy,
    user: {
      email: "ada@example.test",
      emailVerified: true,
      id: "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      image: null,
      locale,
      name: "Ada",
      twoStepEnabled: false,
    },
    workspaces: [],
  }) satisfies Me;

// What the layout knows of the page from its route's own params: the
// language it is shown in, and the first segment its path may hold.
const shown = (locale: "en" | "fr", ...firstSegments: string[]) => ({
  firstSegments,
  locale,
});

describe(accountLanguageOf, () => {
  it("is the account's own language", () => {
    expect(accountLanguageOf(person("fr"))).toStrictEqual(Option.some("fr"));
    expect(accountLanguageOf(person("en"))).toStrictEqual(Option.some("en"));
  });

  // Staff acting as someone read the app as anyone would: the address,
  // then their own browser's language, never the person's.
  it("is none while staff act as the person", () => {
    expect(
      accountLanguageOf(person("fr", "3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c"))
    ).toStrictEqual(Option.none());
  });
});

describe(accountLanguageAddress, () => {
  it("sends a page shown in another language to the account's, its query kept", () => {
    expect(
      accountLanguageAddress(
        Option.some(person("fr")),
        shown("en", "synthetic-studio"),
        "/synthetic-studio/posts?status=draft"
      )
    ).toStrictEqual(Option.some("/fr/synthetic-studio/posts?status=draft"));
    expect(
      accountLanguageAddress(
        Option.some(person("en")),
        shown("fr", "synthetic-studio"),
        "/fr/synthetic-studio/calendar?view=week"
      )
    ).toStrictEqual(Option.some("/en/synthetic-studio/calendar?view=week"));
  });

  // English has no prefix, but the way there names it: the proxy sets the
  // language cookie from it, then next-intl drops it.
  it("names English in the address it sends to", () => {
    expect(
      accountLanguageAddress(Option.some(person("en")), shown("fr", ""), "/fr")
    ).toStrictEqual(Option.some("/en"));
    expect(
      accountLanguageAddress(
        Option.some(person("en")),
        shown("fr", ""),
        "/fr?next=1"
      )
    ).toStrictEqual(Option.some("/en?next=1"));
    expect(
      accountLanguageAddress(
        Option.some(person("en")),
        shown("fr", "notes"),
        "/FR/notes"
      )
    ).toStrictEqual(Option.some("/en/notes"));
  });

  it("sends the home page on too", () => {
    expect(
      accountLanguageAddress(Option.some(person("fr")), shown("en", ""), "/")
    ).toStrictEqual(Option.some("/fr"));
    expect(
      accountLanguageAddress(
        Option.some(person("fr")),
        shown("en", ""),
        "/?from=email"
      )
    ).toStrictEqual(Option.some("/fr?from=email"));
  });

  it("does not take a segment that starts like a language for one", () => {
    expect(
      accountLanguageAddress(
        Option.some(person("fr")),
        shown("en", "french-notes"),
        "/french-notes"
      )
    ).toStrictEqual(Option.some("/fr/french-notes"));
  });

  it("leaves a page already in the account's language", () => {
    expect(
      accountLanguageAddress(
        Option.some(person("fr")),
        shown("fr", "notes"),
        "/fr/notes"
      )
    ).toStrictEqual(Option.none());
    expect(
      accountLanguageAddress(
        Option.some(person("en")),
        shown("en", "notes"),
        "/notes"
      )
    ).toStrictEqual(Option.none());
  });

  it("leaves the page for someone signed out, and for staff acting as someone", () => {
    expect(
      accountLanguageAddress(Option.none(), shown("fr", "notes"), "/fr/notes")
    ).toStrictEqual(Option.none());
    expect(
      accountLanguageAddress(
        Option.some(person("en", "3f2a1b0c-9d8e-4f7a-8b6c-5d4e3f2a1b0c")),
        shown("fr", "notes"),
        "/fr/notes"
      )
    ).toStrictEqual(Option.none());
  });

  // The address comes from a request header the proxy writes: anything
  // but a page of this app sends nowhere.
  it("sends nowhere from an address that is not a page of the app", () => {
    for (const address of [null, "", "//elsewhere.example/x", "/api/me"]) {
      expect(
        accountLanguageAddress(
          Option.some(person("fr")),
          shown("en", ""),
          address
        )
      ).toStrictEqual(Option.none());
    }
  });

  // The header reaches the page from the browser itself wherever the
  // proxy did not run (a path it skips, or next-intl's early return): it
  // is only taken when it names the page the route renders.
  it("sends nowhere from an address that is not the page shown", () => {
    for (const [page, address] of [
      [shown("en", "synthetic-studio"), "/elsewhere/posts"],
      [shown("en", "synthetic-studio"), "/synthetic-studio-2/posts"],
      [shown("en", "synthetic-studio"), "/fr/synthetic-studio/posts"],
      [shown("fr", "synthetic-studio"), "/synthetic-studio/posts"],
      [shown("en", "", "create"), "/synthetic-studio"],
      [shown("en", "", "create"), "/creative"],
    ] as const) {
      expect(
        accountLanguageAddress(Option.some(person("fr")), page, address)
      ).toStrictEqual(Option.none());
    }
  });

  it("takes an address of the page shown, by its first segment", () => {
    expect(
      accountLanguageAddress(
        Option.some(person("fr")),
        shown("en", "", "create"),
        "/create/synthetic-studio/channels"
      )
    ).toStrictEqual(Option.some("/fr/create/synthetic-studio/channels"));
    expect(
      accountLanguageAddress(
        Option.some(person("fr")),
        shown("en", "", "create"),
        "/?from=email"
      )
    ).toStrictEqual(Option.some("/fr?from=email"));
    expect(
      accountLanguageAddress(
        Option.some(person("en")),
        shown("fr", "synthetic-studio"),
        "/fr/synthetic-studio"
      )
    ).toStrictEqual(Option.some("/en/synthetic-studio"));
  });
});
