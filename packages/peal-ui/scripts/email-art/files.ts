import { readFileSync } from "node:fs";
import path from "node:path";

import type { ArtSources } from "./art";

const packages = path.join(import.meta.dirname, "../../..");

/** Where peal-emails keeps its art. */
export const assetsFolder = path.join(packages, "peal-emails/src/assets");

/** What the art is drawn from, read from the repository. */
export const artSources = (): ArtSources => ({
  mark: readFileSync(path.join(packages, "peal-web/src/app/icon.svg"), "utf-8"),
  tokens: readFileSync(
    path.join(packages, "peal-ui/src/styles/tokens.css"),
    "utf-8"
  ),
});
