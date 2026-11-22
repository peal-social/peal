import { describe, expect, it } from "@effect/vitest";
import { Option } from "effect";

import { landingLocale, nextPathOf } from "#auth/next-path.ts";

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

describe(landingLocale, () => {
  it("opens the app in the language the account keeps", () => {
    expect(landingLocale("/app", "fr")).toStrictEqual(Option.some("fr"));
    expect(landingLocale("/device?user_code=ABCD", "en")).toStrictEqual(
      Option.some("en")
    );
  });

  it("keeps the language a path names, and ignores one it does not know", () => {
    expect(landingLocale("/fr/device", "en")).toStrictEqual(Option.none());
    expect(landingLocale("/fr", "en")).toStrictEqual(Option.none());
    expect(landingLocale("/app", "de")).toStrictEqual(Option.none());
    expect(landingLocale("/app", undefined)).toStrictEqual(Option.none());
  });

  it("does not take a path that starts like a language for one", () => {
    expect(landingLocale("/french-notes", "en")).toStrictEqual(
      Option.some("en")
    );
  });
});
