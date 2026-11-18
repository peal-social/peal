import { defineConfig } from "oxlint";
import astro from "ultracite/oxlint/astro";
import react from "ultracite/oxlint/react";

import root from "../../oxlint.config.ts";

// Oxlint lints each file with its nearest config alone, so this extends the
// root config and repeats the properties that extends doesn't carry over.
export default defineConfig({
  env: root.env ?? {},
  extends: [root, astro, react],
  // EmDash writes emdash-env.d.ts from the database's schema.
  ignorePatterns: [...(root.ignorePatterns ?? []), "emdash-env.d.ts"],
});
