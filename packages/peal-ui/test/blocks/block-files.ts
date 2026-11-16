// The blocks' files, for the tests that hold every block to a rule: each
// as its slug, the path under src/blocks without `.tsx`, such as
// `blueprint/section`.
import { readdirSync } from "node:fs";
import path from "node:path";

export const blocksRoot = path.join(import.meta.dirname, "../../src/blocks");

export const blockSlugs: readonly string[] = readdirSync(blocksRoot, {
  recursive: true,
})
  .map(String)
  .filter((file) => file.endsWith(".tsx"))
  .map((file) =>
    file
      .replace(/\.tsx$/u, "")
      .split(path.sep)
      .join("/")
  )
  .toSorted();
