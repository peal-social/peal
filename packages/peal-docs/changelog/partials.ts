// The Changelog page's releases, as the partials its pages include:
// docs/_changelog/<locale>.mdx (ignored by Git), which blume.config.ts
// writes from the history each time Blume loads it, so every build, check
// and dev server, the images' included, shows the history of the commit it
// runs on. A partial is rewritten only when it changes, so `blume dev` does
// not reload for nothing.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import type { History } from "./history.ts";
import { docsFolder, loadHistory } from "./load.ts";
import { changelogPage, locales } from "./render.ts";

export const partialsFolder = path.join(docsFolder, "docs", "_changelog");

/** Writes each language's partial for the history, or the docs' own. */
export const writeChangelogPartials = (
  history: History = loadHistory()
): void => {
  mkdirSync(partialsFolder, { recursive: true });

  for (const locale of locales) {
    const file = path.join(partialsFolder, `${locale}.mdx`);
    const content = `${changelogPage(history, locale)}\n`;

    if (!existsSync(file) || readFileSync(file, "utf-8") !== content) {
      writeFileSync(file, content);
    }
  }
};
