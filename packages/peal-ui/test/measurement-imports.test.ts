import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const source = path.join(import.meta.dirname, "../src");

const files = readdirSync(source, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile() && /\.(?:ts|tsx)$/u.test(entry.name))
  .map((entry) => path.join(entry.parentPath, entry.name));

describe("posthog-js", () => {
  it("is imported by the site's sdk.ts alone", () => {
    const importers = files
      .filter((file) =>
        /from\s+["']posthog-js|import\(\s*["']posthog-js/u.test(
          readFileSync(file, "utf-8")
        )
      )
      .map((file) => path.relative(source, file));

    expect(importers).toStrictEqual([
      path.join("lib", "site", "measurement", "sdk.ts"),
    ]);
  });
});
