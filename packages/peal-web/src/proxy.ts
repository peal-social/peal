import { Effect } from "effect";
import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isRefusedPath } from "peal-contract/path-spelling";

import { forwardToApi, servedByApi } from "#api/forward.ts";
import { routing } from "#i18n/routing.ts";
import { forwardToPostHog, relayed } from "#measurement/relay.ts";

const handleI18nRouting = createMiddleware(routing);

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
// /pulse/* is the web app's measurement, relayed to PostHog without the
// visitor's cookies or address (src/measurement/relay.ts). PostHog's paths
// end with a slash, so Next no longer removes trailing slashes
// (`skipTrailingSlashRedirect`): every other path that ends with one is
// redirected here to the path without it, as Next did.
const proxy = (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  if (relayed(pathname)) {
    return Effect.runSync(forwardToPostHog(request));
  }

  // A Location of this origin's own, as Next writes it, whatever host the
  // request came to behind the edge.
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const location = `${pathname.replace(/\/+$/u, "") || "/"}${request.nextUrl.search}`;

    return new NextResponse(null, { headers: { location }, status: 308 });
  }

  if (servedByApi(pathname)) {
    return Effect.runSync(forwardToApi(request));
  }

  return isRefusedPath(pathname)
    ? new NextResponse(null, { status: 400 })
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
