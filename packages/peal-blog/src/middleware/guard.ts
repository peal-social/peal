import { defineMiddleware } from "astro:middleware";

import { imageRefused, refused } from "../guard.ts";
import { handedOut } from "../image-allow.ts";

const notFound = () =>
  new Response("Not found", {
    headers: { "content-type": "text/plain; charset=utf-8" },
    status: 404,
  });

// Registered ahead of EmDash's middleware (see astro.config.ts), so a path
// the blog refuses never reaches EmDash's runtime, auth or routes, and an
// image transform no page handed out never reaches sharp.
export const onRequest = defineMiddleware(async (context, next) =>
  refused(context.url.pathname, import.meta.env.BASE_URL) ||
  imageRefused(context.url, import.meta.env.BASE_URL, handedOut)
    ? notFound()
    : await next()
);
