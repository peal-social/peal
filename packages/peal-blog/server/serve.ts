// Starts the blog's production build (dist/server/entry.mjs) behind one
// check of each request target as sent (./raw-path.ts), which Node and
// Astro resolve before the blog's middleware sees it. The Node adapter's
// own server would otherwise start when the entry loads: ASTRO_NODE_AUTOSTART
// stops it, and this server hands every other request to the adapter's
// handler, which serves the static files and the pages as it would. Run it
// with Node, which strips the types: `node server/serve.ts`, with HOST and
// PORT as the adapter reads them.
import { createServer } from "node:http";
import type { RequestListener } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Predicate, Schema } from "effect";

import { rawPathRefused } from "./raw-path.ts";

process.env["ASTRO_NODE_AUTOSTART"] = "disabled";

const EntrySchema = Schema.Struct({
  handler: Schema.declare((value: unknown): value is RequestListener =>
    Predicate.isFunction(value)
  ),
});

const entry = pathToFileURL(
  path.join(import.meta.dirname, "..", "dist", "server", "entry.mjs")
);

const { handler } = Schema.decodeUnknownSync(EntrySchema)(
  await import(entry.href),
  { onExcessProperty: "ignore" }
);

const host = process.env["HOST"] ?? "localhost";
const port = Number(process.env["PORT"] ?? "4324");

const server = createServer((request, response) => {
  if (rawPathRefused(request.url ?? "/")) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");

    return;
  }

  handler(request, response);
});

server.listen(port, host, () => {
  console.log(`The blog listens on http://${host}:${port}`);
});
