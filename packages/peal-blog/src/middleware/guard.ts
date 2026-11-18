import { defineMiddleware } from "astro:middleware";

import { refused } from "../guard.ts";

// Registered ahead of EmDash's middleware (see astro.config.ts), so a path
// the blog refuses never reaches EmDash's runtime, auth or routes.
export const onRequest = defineMiddleware(async (context, next) =>
  refused(context.url.pathname, import.meta.env.BASE_URL)
    ? new Response("Not found", {
        headers: { "content-type": "text/plain; charset=utf-8" },
        status: 404,
      })
    : await next()
);
