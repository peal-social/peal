import { web } from "@e2e-dev/web";
import type { E2EConfig } from "e2e";

import config from "./e2e.config.ts";

// The web app's measurement in WebKit, Safari's engine, which drives
// history, fetch and storage on its own terms: the same served app as the
// run in Chromium, for the measurement's journey alone.
// Where this run writes, its report and what the stand-in for PostHog
// received, beside the Chromium run's: the journey and the served stand-in
// both read it from the environment.
const output = ".e2e/webkit";

process.env["PEAL_E2E_OUTPUT"] = output;

export default {
  ...config,
  targets: config.targets.map((target) => ({
    ...target,
    app:
      target.app?.command === undefined
        ? target.app
        : {
            ...target.app,
            command: {
              ...target.app.command,
              env: { ...target.app.command.env, PEAL_E2E_OUTPUT: output },
            },
          },
    engine: web({ browser: "webkit", locale: "en-US", timezoneId: "UTC" }),
    name: "webkit",
  })),
  // Its own report beside the Chromium run's, which CI keeps too.
  output,
  tests: "tests/usage-measurement.e2e.ts",
} satisfies E2EConfig;
