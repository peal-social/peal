import { web } from "@e2e-dev/web";
import type { E2EConfig } from "e2e";

import config from "./e2e.config.ts";

// The web app's measurement in WebKit, Safari's engine, which drives
// history, fetch and storage on its own terms: the same served app as the
// run in Chromium, for the measurement's journey alone.
export default {
  ...config,
  targets: config.targets.map((target) => ({
    ...target,
    engine: web({ browser: "webkit", locale: "en-US", timezoneId: "UTC" }),
    name: "webkit",
  })),
  // Its own report beside the Chromium run's, which CI keeps too.
  output: ".e2e/webkit",
  tests: "tests/usage-measurement.e2e.ts",
} satisfies E2EConfig;
