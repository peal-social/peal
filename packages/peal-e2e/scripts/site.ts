// The marketing site for the end-to-end run: peal-site's build for the run
// (`nx run peal-site:build-e2e`, measured with the stand-in's token), served
// as nginx serves it, with `/pulse/` forwarded to the run's web app as the
// tunnel forwards it in production, the visitor's address in
// `cf-connecting-ip`. The run's site and web app share the host name
// 127.0.0.1 on two ports, so they share cookies, as peal.social and its
// app share the parent domain's.
import { once } from "node:events";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";
import path from "node:path";

import { Schema } from "effect";

/** The site's build for the run. */
export const siteRoot = path.join(
  import.meta.dirname,
  "..",
  "..",
  "peal-site",
  "dist-e2e"
);

/** Where the run writes the site's address, for the journeys to read. */
export const siteUrlFile = path.join(
  import.meta.dirname,
  "..",
  ".e2e",
  "site-url"
);

/** The address the edge says the visitor came from: a documentation range. */
export const visitorAddress = "203.0.113.7";

const types: ReadonlyMap<string, string> = new Map([
  [".css", "text/css"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".woff2", "font/woff2"],
  [".xml", "application/xml"],
]);

const isFile = (file: string) => {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
};

// The file a path names, as nginx's `try_files $uri $uri/index.html`.
const fileOf = (pathname: string): string | undefined => {
  const decoded = decodeURIComponent(pathname);
  const file = path.join(siteRoot, decoded);

  if (!file.startsWith(siteRoot)) {
    return undefined;
  }

  return [file, path.join(file, "index.html")].find(isFile);
};

const serveFile = (pathname: string, response: ServerResponse) => {
  const file = fileOf(pathname);

  if (file === undefined) {
    response.writeHead(404, { "content-type": "text/plain" });
    response.end("Not found");

    return;
  }

  response.writeHead(200, {
    "content-type": types.get(path.extname(file)) ?? "application/octet-stream",
  });
  response.end(readFileSync(file));
};

// `/pulse/` to the web app, as the tunnel sends it: every header of the
// browser's, and the visitor's address the edge adds.
const forward = (
  incoming: IncomingMessage,
  response: ServerResponse,
  webPort: number
) => {
  const headers = { ...incoming.headers };

  delete headers.host;
  headers["cf-connecting-ip"] = visitorAddress;

  const outgoing = httpRequest(
    {
      headers,
      host: "127.0.0.1",
      method: incoming.method,
      path: incoming.url,
      port: webPort,
    },
    (answer) => {
      response.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(response);
    }
  );

  outgoing.on("error", () => {
    response.writeHead(502);
    response.end();
  });
  incoming.pipe(outgoing);
};

const PortSchema = Schema.Struct({ port: Schema.Int });

/** Serves the site on a free loopback port, and writes its address. */
export const startSite = async (
  webPort: number
): Promise<{ readonly server: Server; readonly url: string }> => {
  const server = createServer((incoming, response) => {
    const { pathname } = new URL(incoming.url ?? "/", "http://127.0.0.1");

    if (pathname.startsWith("/pulse/")) {
      forward(incoming, response, webPort);
    } else {
      serveFile(pathname, response);
    }
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const { port } = Schema.decodeUnknownSync(PortSchema)(server.address(), {
    onExcessProperty: "ignore",
  });

  const url = `http://127.0.0.1:${String(port)}`;

  mkdirSync(path.dirname(siteUrlFile), { recursive: true });
  writeFileSync(siteUrlFile, url);

  return { server, url };
};
