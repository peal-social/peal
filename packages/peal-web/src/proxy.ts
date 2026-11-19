import { Effect, Option } from "effect";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRefusedPath } from "peal-contract/path-spelling";

import { forwardToApi, servedByApi } from "#api/forward.ts";
import { currentUserEffect } from "#auth/session.ts";
import { routing } from "#i18n/routing.ts";
import { relayed } from "#measurement/relay.ts";
import { namesWorkspaceById, slugAddressOf } from "#shell/workspace-path.ts";

const handleI18nRouting = createMiddleware(routing);

// A page of a workspace named by its id, as links did before they named
// its slug (emails, notices, bookmarks): sent on to the same page under
// the slug, for a member, once GET /api/me says which it is. Anyone else,
// or an API that does not answer, gets the page as it is, which finds the
// workspace by its id too or answers not found.
const toSlug = async (request: NextRequest): Promise<NextResponse> => {
  const cookie = request.headers.get("cookie");

  const me =
    cookie === null
      ? Option.none()
      : await Effect.runPromise(
          currentUserEffect(cookie).pipe(
            Effect.orElseSucceed(() => Option.none())
          )
        );

  const location = Option.match(me, {
    onNone: () => null,
    onSome: ({ workspaces }) => slugAddressOf(request.nextUrl, workspaces),
  });

  // Next reads a proxy's Location as a whole URL: the path, on the
  // request's own address.
  return location === null
    ? handleI18nRouting(request)
    : NextResponse.redirect(new URL(location, request.nextUrl), 308);
};

// /api/*, the OAuth discovery documents, the API catalogue and llms.txt go
// to the Peal server (see
// src/api/forward.ts). The rewrite lives here rather than in next.config.ts
// because Next resolves config rewrites at build time; here PEAL_API_URL is
// read per request. Everything else is a page: negotiate its locale, with
// English unprefixed and French under /fr.
//
// A page path with an encoded slash or backslash is refused (400):
// cloudflared decodes it and resolves its dot segments before it picks the
// rule that says whether Access guards it, while Next keeps `%2F` inside a
// segment, so `/en/admin/users/x%2F..%2F..%2Fy` would be `/y` to the one and
// the staff console to the other (peal-contract/path-spelling). The server
// refuses such a path under /api itself, in the API's envelope.
//
// /pulse/* is the web app's measurement, which its route handler relays to
// PostHog without the visitor's cookies or address (src/measurement/relay.ts,
// app/pulse): it passes through, as no language applies to it. PostHog's paths
// end with a slash, so Next no longer removes trailing slashes
// (`skipTrailingSlashRedirect`): every other path that ends with one is
// redirected here to the path without it, as Next did.
//
// A workspace's page named by its id (`/<id>/posts`), as the server's
// emails write it, is redirected to
// the same page under its slug (`toSlug`).
const proxy = (request: NextRequest): NextResponse | Promise<NextResponse> => {
  const { pathname } = request.nextUrl;

  if (relayed(pathname)) {
    return NextResponse.next();
  }

  // The same path without its trailing slashes, on the request's own
  // address: Next refuses a relative Location from a proxy.
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const location = `${pathname.replace(/\/+$/u, "") || "/"}${request.nextUrl.search}`;

    return NextResponse.redirect(new URL(location, request.nextUrl), 308);
  }

  if (servedByApi(pathname)) {
    return Effect.runSync(forwardToApi(request));
  }

  if (isRefusedPath(pathname)) {
    return new NextResponse(null, { status: 400 });
  }

  return namesWorkspaceById(pathname)
    ? toSlug(request)
    : handleI18nRouting(request);
};

export default proxy;

export const config = {
  // The relay, /api/*, the discovery documents, and pages: not Next's own files nor
  // anything else with a dot, such as favicon.ico, but any path with an
  // encoded slash or backslash, which the proxy refuses.
  matcher: [
    "/pulse/:path*",
    "/api/:path*",
    "/.well-known/api-catalog",
    "/llms.txt",
    "/.well-known/oauth-authorization-server/:path*",
    "/.well-known/oauth-protected-resource/:path*",
    "/((?!api|_next|.*\\..*).*)",
    "/(.*(?:%2[fF]|%5[cC]).*)",
  ],
};
