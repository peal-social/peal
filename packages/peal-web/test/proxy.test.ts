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

const answerTo = async (path: string) =>
  await proxy(new NextRequest(`${origin}${path}`));

describe("the proxy", () => {
  it.each([
    "/en/admin/users/x%2F..%2F..%2F..%2F..%2Fy",
    "/admin/users/x%2f..%2fy",
    "/fr/admin/workspaces/x%5C..%5Cy",
    "/en/admin/x%5c..",
    "/api%2F..%2Fadmin",
    "/x%2F..%2Fen%2Fadmin",
  ])("refuses %s", async (path) => {
    const answer = await answerTo(path);

    expect(answer.status).toBe(400);
  });

  // The server refuses them itself, in the API's envelope.
  it("forwards such a path under /api to the server", async () => {
    const answer = await answerTo("/api/admin/users/x%2F..%2Fhealth");

    expect(answer.headers.get("x-middleware-rewrite")).toMatch(
      /\/api\/admin\/users\/x%2F\.\.%2Fhealth$/u
    );
  });

  it.each(["/admin/users", "/fr/admin/users/x..y"])(
    "leaves %s, an encoded slash in its query included",
    async (path) => {
      const answer = await answerTo(`${path}?next=%2F..%2Fadmin`);

      expect(answer.status).not.toBe(400);
    }
  );

  // Next no longer removes them (skipTrailingSlashRedirect), for the
  // measurement's relay: every other path is redirected as it did.
  // On the request's own address, as Next takes no relative Location from
  // a proxy.
  it.each([
    ["/synthetic-studio/posts/", "/synthetic-studio/posts"],
    ["/fr/account/", "/fr/account"],
    ["/api/health/", "/api/health"],
    ["/agenda//?next=%2Fagenda", "/agenda?next=%2Fagenda"],
  ])("redirects %s to %s, without its trailing slash", async (path, to) => {
    const answer = await answerTo(path);

    expect(answer.status).toBe(308);
    expect(answer.headers.get("location")).toBe(`${origin}${to}`);
  });

  it("leaves the relay's trailing slashes, and the home page", async () => {
    // The relay's route handler answers it, unredirected.
    const relay = await answerTo("/pulse/e/");
    const home = await answerTo("/");

    expect(relay.headers.get("x-middleware-next")).toBe("1");
    expect(home.status).not.toBe(308);
  });

  // A workspace named by its id, as the server's emails write it: the
  // proxy asks the server whose it is, which only a session can say.
  it("lets a workspace's page named by its id through without a session", async () => {
    const answer = await answerTo(
      "/5b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e31/posts"
    );

    expect(answer.status).not.toBe(308);
  });

  // The site's and the docs' host names reach the relay's site mode
  // through the edge, with their own Host.
  it("lets the site's events through, whatever host they came to", async () => {
    const answer = await proxy(
      new NextRequest("https://docs.example.test/pulse/site/e/?ip=0", {
        headers: { host: "docs.example.test" },
        method: "POST",
      })
    );

    expect(answer.headers.get("x-middleware-next")).toBe("1");
  });
});
