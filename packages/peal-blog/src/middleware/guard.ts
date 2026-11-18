import { defineMiddleware } from "astro:middleware";

import { refused } from "../guard.ts";
import { imageRefused } from "../image-request.ts";

const notFound = () =>
  new Response("Not found", {
    headers: { "content-type": "text/plain; charset=utf-8" },
    status: 404,
  });

// Registered ahead of EmDash's middleware (see astro.config.ts), so a path
// the blog refuses never reaches EmDash's runtime, auth or routes, and an
// image request Astro would not build never reaches sharp.
export const onRequest = defineMiddleware(async (context, next) =>
  refused(context.url.pathname, import.meta.env.BASE_URL) ||
  imageRefused(context.url, import.meta.env.BASE_URL)
    ? notFound()
    : await next()
);
