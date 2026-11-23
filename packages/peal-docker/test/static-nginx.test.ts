// The static image's nginx (config/static/default.conf) sends HSTS on the
// site's and the docs' answers, as the web app does, once the edge says the
// reader came over HTTPS. nginx drops a server's add_header lines in a
// location that has add_header lines of its own, so each such location
// repeats it.
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const config = readFileSync(
  path.join(import.meta.dirname, "..", "config", "static", "default.conf"),
  "utf-8"
);

// The web app's value (packages/peal-web/next.config.ts).
const hsts = '"max-age=63072000; includeSubDomains"';

// The blocks that set headers: each server, and each location in one, with
// the lines that are its own (not a nested block's).
const blocksWithHeaders = (): { name: string; own: string[] }[] => {
  const blocks: { name: string; own: string[] }[] = [];
  const open: { name: string; own: string[] }[] = [];

  for (const raw of config.split("\n")) {
    const line = raw.replace(/#.*$/u, "").trim();

    if (line.endsWith("{")) {
      open.push({ name: line.slice(0, -1).trim(), own: [] });
    } else if (line === "}") {
      const closed = open.pop();

      if (closed?.own.some((own) => own.startsWith("add_header ")) === true) {
        blocks.push(closed);
      }
    } else if (line !== "") {
      open.at(-1)?.own.push(line);
    }
  }

  return blocks;
};

describe("the static image's nginx", () => {
  it("sends HSTS only to readers the edge says came over HTTPS", () => {
    expect(config).toContain(
      "map $http_x_forwarded_proto $strict_transport_security {"
    );
    expect(config).toMatch(
      new RegExp(
        `\\n\\s+https\\s+${hsts.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&")};`,
        "u"
      )
    );
    expect(config).toMatch(/\n\s+default\s+"";/u);
    expect(config).not.toContain("preload");
  });

  it("sends it from every block that sets headers", () => {
    const blocks = blocksWithHeaders();

    expect(blocks.map(({ name }) => name)).toContain("server");

    expect(
      blocks
        .filter(
          ({ own }) =>
            !own.includes(
              "add_header Strict-Transport-Security $strict_transport_security always;"
            )
        )
        .map(({ name }) => name)
    ).toStrictEqual([]);
  });
});
