import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import { landingAddressOf, landingOf, nextPathOf } from "#auth/next-path.ts";

describe(nextPathOf, () => {
  it.each([
    "/",
    "/app",
    "/device?user_code=WDJB-MJHT",
    "/fr/oauth/workspace",
    "/fr",
    "/north-studio/posts/new?at=2026-11-22T10%3A00#top",
    "/invitations/5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f",
    "/apiary/posts",
    "/fr/apis",
  ])("keeps %s, a page of the app", (path) => {
    expect(nextPathOf(path)).toStrictEqual(Option.some(path));
  });

  it.each([
    "https://elsewhere.example/app",
    "//elsewhere.example/app",
    "/\\elsewhere.example",
    "app",
    "/ app",
    "",
  ])("refuses %s", (path) => {
    expect(nextPathOf(path)).toStrictEqual(Option.none());
  });

  // The server answers these, and a short link redirects anywhere.
  it.each([
    "/api/l/abc123",
    "/api",
    "/api?x=1",
    "/API/l/abc123",
    "/Api/l/abc123",
    "/fr/api/l/abc123",
    "/FR/api/l/abc123",
    "/en/api/l/abc123",
    // next-intl drops a default language's prefix one redirect at a time.
    "/en/en/api/l/AbCd123",
    "/fr/en/api/l/AbCd123",
    "/EN/en/Api/l/AbCd123",
    "/en/fr/en/api/l/AbCd123",
    "/en/en/app",
    "/fr/fr",
    "/.well-known/oauth-authorization-server",
    "/fr/.well-known/api-catalog",
    "/.WELL-KNOWN/api-catalog",
    "/llms.txt",
    "/pulse/e/",
    "/emoji-data/en/data.json",
    "/_next/static/chunk.js",
  ])("refuses %s, which is not a page", (path) => {
    expect(nextPathOf(path)).toStrictEqual(Option.none());
  });

  // Spellings a browser or a proxy reads as another path.
  it.each([
    "/app/../api/l/abc123",
    "/./api/l/abc123",
    "/%2e%2e/api/l/abc123",
    "/%2E./api/l/abc123",
    "/app%2F..%2Fapi/l/abc123",
    "/%61pi/l/abc123",
    "/app//elsewhere",
    "/app?to=//elsewhere.example",
    "/app\\..\\api",
    "/app?x=\\y",
    "/app\tx",
    "/app\u0000",
    "/app?x=\u001B",
    "/app\u007F",
    `/app${String.fromCodePoint(0x20_28)}`,
    "/café",
  ])("refuses %j", (path) => {
    expect(nextPathOf(path)).toStrictEqual(Option.none());
  });

  it("refuses a repeated parameter", () => {
    expect(nextPathOf(["/app", "/device"])).toStrictEqual(Option.none());
    expect(nextPathOf(undefined)).toStrictEqual(Option.none());
  });
});

describe(landingOf, () => {
  it("opens the app in the language the account keeps", () => {
    expect(landingOf("/app", "fr")).toStrictEqual({
      href: "/app",
      locale: Option.some("fr"),
    });
    expect(landingOf("/device?user_code=ABCD", "en")).toStrictEqual({
      href: "/device?user_code=ABCD",
      locale: Option.some("en"),
    });
  });

  // The signed-in app is in the account's language, whatever its address
  // says (#i18n/account-language.ts): straight there, with no detour.
  it("opens a page of the app in the account's language, whatever the path names", () => {
    expect(
      landingOf("/fr/synthetic-studio/posts?status=draft", "en")
    ).toStrictEqual({
      href: "/synthetic-studio/posts?status=draft",
      locale: Option.some("en"),
    });
    expect(landingOf("/fr", "en")).toStrictEqual({
      href: "/",
      locale: Option.some("en"),
    });
  });

  // next-intl's router prefixes the language it is given: a path that
  // names one goes without it, never `/fr/fr/…`.
  it("keeps the language a page outside the app names, without naming it twice", () => {
    expect(landingOf("/fr/device", "en")).toStrictEqual({
      href: "/device",
      locale: Option.some("fr"),
    });
    expect(landingOf("/fr/app", "de")).toStrictEqual({
      href: "/app",
      locale: Option.some("fr"),
    });
  });

  it("ignores a language the account names that the app does not know", () => {
    expect(landingOf("/app", "de")).toStrictEqual({
      href: "/app",
      locale: Option.none(),
    });
    expect(landingOf("/app", undefined)).toStrictEqual({
      href: "/app",
      locale: Option.none(),
    });
  });

  it("does not take a path that starts like a language for one", () => {
    expect(landingOf("/french-notes", "en")).toStrictEqual({
      href: "/french-notes",
      locale: Option.some("en"),
    });
  });
});

// A provider's sign-in comes back to the sign-in page, which sends on from
// the server: the whole address, in the language `landingOf` picks, else
// the page's. English is named too, so next-intl sets the language
// cookie from it before it drops the prefix.
describe(landingAddressOf, () => {
  it("lands where the password's sign-in does", () => {
    expect(
      landingAddressOf("/fr/synthetic-studio/posts?status=draft", "en", "fr")
    ).toBe("/en/synthetic-studio/posts?status=draft");
    expect(landingAddressOf("/device?user_code=ABCD", "en", "fr")).toBe(
      "/en/device?user_code=ABCD"
    );
    expect(landingAddressOf("/fr/device", "en", "en")).toBe("/fr/device");
  });

  it("names the language of the home page without a trailing slash", () => {
    expect(landingAddressOf("/", "fr", "en")).toBe("/fr");
    expect(landingAddressOf("/fr?from=email", "en", "fr")).toBe(
      "/en?from=email"
    );
  });

  it("keeps the page's language where neither the account nor the path names one", () => {
    expect(landingAddressOf("/device", "de", "fr")).toBe("/fr/device");
    expect(landingAddressOf("/", undefined, "en")).toBe("/en");
  });
});
