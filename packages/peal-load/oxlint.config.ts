import { defineConfig } from "oxlint";

import root from "../../oxlint.config.ts";

// Oxlint lints each file with its nearest config alone, so this extends the
// root config and repeats the properties that extends doesn't carry over.
export default defineConfig({
  env: root.env ?? {},
  extends: [root],
  ignorePatterns: root.ignorePatterns ?? [],
  overrides: [
    {
      // k6 runs these scripts in its own runtime, which loads no package:
      // Effect Schema cannot parse what they read (the run's config, an
      // answer's body), so they check its shape by hand.
      files: ["k6/**/*.ts"],
      rules: {
        "anti-slop/no-runtime-typeof": "off",
        "anti-slop/no-unknown-parameters": "off",
        "typescript/no-unsafe-assignment": "off",
      },
    },
  ],
});
