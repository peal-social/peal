// The history the docs show: the file release.yml writes, which holds the
// release it deploys; without it, Git's tags; without them (a shallow clone,
// CI's, or a build without the repository's Git), none, and the page says
// that nothing has been released yet.
import path from "node:path";
import { fileURLToPath } from "node:url";

import { historyFromFile } from "./file.ts";
import { historyFromGit } from "./history.ts";
import type { History } from "./history.ts";

/** packages/peal-docs. */
export const docsFolder = fileURLToPath(new URL("..", import.meta.url));

export const historyFilePath = path.join(docsFolder, "changelog.json");

export const loadHistory = (): History =>
  historyFromFile(historyFilePath) ?? historyFromGit(docsFolder);
