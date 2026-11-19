// The proxy in front of the pages refuses a path written to read
// differently to cloudflared and to Next's router. cloudflared decodes a
// path and resolves its dot segments before it picks the rule that says
// whether Access guards it; Next keeps `%2F` inside a segment, so
// `/en/admin/users/x%2F..%2F..%2Fy` was `/y` to the first and the staff
// console's user page to the second. That the proxy runs on such paths,
// which hold a dot, is for the end-to-end tests to show
// (peal-e2e/tests/path-spellings.e2e.ts): only Next's build reads the matcher.
import { describe, expect, it } from "@effect/vitest";
import { NextRequest } from "next/server";

import proxy from "../src/proxy.ts";

const origin = "http://localhost:3001";

const answerTo = (path: string) => proxy(new NextRequest(`${origin}${path}`));

describe("the proxy", () => {
  it.each([
    "/en/admin/users/x%2F..%2F..%2F..%2F..%2Fy",
    "/admin/users/x%2f..%2fy",
    "/fr/admin/workspaces/x%5C..%5Cy",
    "/en/admin/x%5c..",
    "/api%2F..%2Fadmin",
    "/x%2F..%2Fen%2Fadmin",
  ])("refuses %s", (path) => {
    expect(answerTo(path).status).toBe(400);
  });

  // The server refuses them itself, in the API's envelope.
  it("forwards such a path under /api to the server", () => {
    expect(
      answerTo("/api/admin/users/x%2F..%2Fhealth").headers.get(
        "x-middleware-rewrite"
      )
    ).toMatch(/\/api\/admin\/users\/x%2F\.\.%2Fhealth$/u);
  });

  it.each(["/admin/users", "/fr/admin/users/x..y"])(
    "leaves %s, an encoded slash in its query included",
    (path) => {
      expect(answerTo(`${path}?next=%2F..%2Fadmin`).status).not.toBe(400);
    }
  );

  // Next no longer removes them (skipTrailingSlashRedirect), for the
  // measurement's relay: every other path is redirected as it did.
  it.each([
    ["/app/", "/app"],
    ["/fr/app/account/", "/fr/app/account"],
    ["/api/health/", "/api/health"],
    ["/app//?next=%2Fapp", "/app?next=%2Fapp"],
  ])("redirects %s to %s, without its trailing slash", (path, to) => {
    const answer = answerTo(path);

    expect(answer.status).toBe(308);
    expect(answer.headers.get("location")).toBe(to);
  });

  it("leaves the relay's trailing slashes, and the home page", () => {
    // The relay's route handler answers it, unredirected.
    expect(answerTo("/pulse/e/").headers.get("x-middleware-next")).toBe("1");
    expect(answerTo("/").status).not.toBe(308);
  });

  // The site's and the docs' host names reach the relay's site mode
  // through the edge, with their own Host.
  it("lets the site's events through, whatever host they came to", () => {
    const answer = proxy(
      new NextRequest("https://docs.example.test/pulse/site/e/?ip=0", {
        headers: { host: "docs.example.test" },
        method: "POST",
      })
    );

    expect(answer.headers.get("x-middleware-next")).toBe("1");
  });
});
