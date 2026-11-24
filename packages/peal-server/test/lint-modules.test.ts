import { existsSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";

import { modules } from "#test/lint-modules.ts";

// The lint rules wall each module off by its folders' names and open each
// seam by its path: a module or a seam renamed without its entry would
// leave walls that refuse nothing, and nothing would say so.

const server = path.join(import.meta.dirname, "..");

const layers = ["domain", "application", "infrastructure", "api"];

const isFolder = (folder: string) =>
  existsSync(folder) && statSync(folder).isDirectory();

const isFile = (file: string) => existsSync(file) && statSync(file).isFile();

const entries = Object.entries(modules).flatMap(([context, named]) =>
  Object.entries(named).map(([name, { seams }]) => ({ context, name, seams }))
);

describe("the modules the lint rules keep apart", () => {
  it("are named", () => {
    expect(entries.length).toBeGreaterThan(0);
  });

  it.each(entries)(
    "$context's $name has a folder in one of its layers at least",
    ({ context, name }) => {
      const found = layers.some((layer) =>
        isFolder(path.join(server, "src", context, layer, name))
      );

      expect(found).toBeTruthy();
    }
  );

  it.each(entries)(
    "$context's $name names seams that are files of its context",
    ({ context, seams }) => {
      for (const seam of seams) {
        expect(seam.startsWith(`src/${context}/`)).toBeTruthy();
        expect(isFile(path.join(server, seam))).toBeTruthy();
      }
    }
  );
});
