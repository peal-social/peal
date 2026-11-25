import { defineConfig } from "oxlint";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import shadcn from "ultracite/oxlint/shadcn";
import vitest from "ultracite/oxlint/vitest";

import root from "../../oxlint.config.ts";

// Every way out of the app signs out through `useSignOut`, which forgets
// the person and loads the next page anew (AGENTS.md): nothing else ends
// the session or forgets the support conversation.
const signOutMessage =
  "Sign out through useSignOut (#auth/use-sign-out.ts), which forgets the person and loads the next page anew.";

// Oxlint lints each file with its nearest config alone, so this extends the
// root config and repeats the properties that extends doesn't carry over.
export default defineConfig({
  env: root.env ?? {},
  extends: [root, react, next, shadcn, vitest],
  ignorePatterns: root.ignorePatterns ?? [],
  jsPlugins: shadcn.jsPlugins ?? [],
  overrides: [
    {
      files: ["src/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            paths: [
              {
                importNames: ["forgetConversation"],
                message: signOutMessage,
                name: "peal-ui/lib/support/crisp",
              },
            ],
          },
        ],
        "no-restricted-properties": [
          "error",
          {
            message: signOutMessage,
            object: "authClient",
            property: "signOut",
          },
        ],
      },
    },
    {
      // The one sign-out: the root's no-restricted-imports names nothing,
      // and no-restricted-properties is off there.
      files: ["src/auth/use-sign-out.ts"],
      rules: {
        "no-restricted-imports": "off",
        "no-restricted-properties": "off",
      },
    },
  ],
  // Screens use peal-ui's components and theme: the shadcn rules check class
  // names against them. Oxlint does not merge settings from extended configs.
  settings: {
    shadcn: { themeImports: ["^peal-ui/"], ui: "peal-ui/components" },
  },
});
