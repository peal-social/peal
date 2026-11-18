// EmDash's admin and API answer at /_emdash only: never under the base,
// where EmDash would take an API call for a public page, and the blog
// answers nothing of the site it shares a host name with.
import { describe, expect, it } from "vitest";

import { rawPathRefused } from "../server/raw-path.ts";
import { refused } from "../src/guard.ts";

describe("the paths the blog refuses under /blog", () => {
  it.each([
    "/blog/_emdash",
    "/blog/_emdash/admin",
    "/blog/_emdash/api/health",
    "/BLOG/_EMDASH/api/health",
    "/Blog/_EmDash/api/content/posts",
    "/blog//_emdash/api/health",
    "//blog/_emdash/api/health",
    "/blog/%5Femdash/api/health",
    "/blog/%5femdash/admin",
    "/blog/_emdashx",
    "/",
    "/pricing",
    "/robots.txt",
    "/sitemap.xml",
    "/.well-known/security.txt",
    "/_EMDASH/admin",
    "/%5Femdash/admin",
    "/_emdashx",
    "/blogger",
    "/%E0%A4%A",
  ])("refuses %s", (path) => {
    expect(refused(path, "/blog")).toBe(true);
  });

  it.each([
    "/blog",
    "/blog/",
    "/blog/a-post",
    "/blog/fr/",
    "/blog/fr/un-article",
    "/blog/_astro/client.js",
    "/blog/_image",
    "/blog/sitemap.xml",
    "/_emdash",
    "/_emdash/admin",
    "/_emdash/api/health",
    "/_emdash/api/media/file/01SYNTHETIC.png",
  ])("serves %s", (path) => {
    expect(refused(path, "/blog")).toBe(false);
  });

  it("reads the base with or without its trailing slash", () => {
    expect(refused("/blog/_emdash/admin", "/blog/")).toBe(true);
    expect(refused("/blog/a-post", "/blog/")).toBe(false);
  });
});

describe("the paths the blog refuses without a base", () => {
  it.each(["/", "/a-post", "/fr/", "/_emdash/admin", "/_emdash/api/health"])(
    "serves %s",
    (path) => {
      expect(refused(path, "/")).toBe(false);
    }
  );
});

// What the server refuses as sent, before Node and Astro resolve it: those
// spellings reach a route the guard never sees them under.
describe("the request targets the server refuses as sent", () => {
  it.each([
    "/blog/../_emdash/api/health",
    "/blog/%2e%2e/_emdash/api/setup/status",
    "/blog/%2E%2E/_emdash/api/setup/status",
    "/blog/.%2e/_emdash/admin",
    "/blog/%2e./_emdash/admin",
    "/blog/./_emdash/admin",
    "/blog/%2e/x",
    "/blog/..",
    "/..",
    "/blog/..\\_emdash/api/health",
    "/blog/..%5c_emdash/api/health",
    "/blog/..%5C_emdash/api/health",
    "/blog/%252e%252e/_emdash/admin",
    "/_emdash/api/media/file/%2e%2e/%2e%2e/setup/status",
    "/_emdash/api/media/file/../../setup/status",
    "/_emdash/admin/..",
  ])("refuses %s", (target) => {
    expect(rawPathRefused(target)).toBe(true);
  });

  it.each([
    "/blog/",
    "/blog/a-post",
    "/blog/a.post",
    "/blog/_astro/client.D1x9.js",
    "/blog/_image?href=http%3A%2F%2Flocalhost%2F_emdash%2Fapi%2Fmedia%2Ffile%2Fa.png&w=640",
    "/blog/a-post?_preview=synthetic..token",
    "/_emdash/admin",
    "/_emdash/api/media/file/01SYNTHETIC.png",
    "/blog/fr/l%C3%A9t%C3%A9",
  ])("serves %s", (target) => {
    expect(rawPathRefused(target)).toBe(false);
  });
});
