// Schedules POSTS posts for the instant AT (on the minute), one channel
// each, round the run's channels, as fast as VUS clients can. Run by
// `scripts/burst.ts`, which then watches them go out.
//
//   AT=2026-11-27T05:00:00Z POSTS=1229 k6 run k6/schedule-burst.ts
import { check } from "k6";
import exec from "k6/execution";
import http from "k6/http";
import { Counter } from "k6/metrics";
import type { Options } from "k6/options";

import { bases, config } from "./run-config.ts";

const at = __ENV["AT"] ?? "";
const posts = Number(__ENV["POSTS"] ?? "1229");

const channels = config.workspaces.flatMap((workspace) =>
  workspace.channelIds.map((channelId) => ({
    apiKey: workspace.apiKey,
    channelId,
  }))
);

export const options: Options = {
  scenarios: {
    schedule: {
      executor: "shared-iterations",
      iterations: posts,
      maxDuration: "10m",
      vus: Number(__ENV["VUS"] ?? "50"),
    },
  },
  summaryTrendStats: ["avg", "med", "p(95)", "p(99)", "max"],
  thresholds: { checks: ["rate==1"] },
};

const created = new Counter("posts_created");

export default function schedule() {
  const n = exec.scenario.iterationInTest;
  const target = channels[n % channels.length];
  const base = bases[n % bases.length];

  if (target === undefined || base === undefined || at === "") {
    throw new Error("Run scripts/setup.ts first, and give AT");
  }

  const response = http.post(
    `${base}/api/v1/posts`,
    JSON.stringify({
      channelIds: [target.channelId],
      content: {
        media: [],
        overrides: [],
        text: `Doors open at midnight, deal ${n} ${crypto.randomUUID()}`,
      },
      when: { _tag: "at", at, timeZone: "America/New_York" },
    }),
    {
      headers: {
        authorization: `Bearer ${target.apiKey}`,
        "content-type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      tags: { name: "POST /posts" },
    }
  );

  if (check(response, { created: (answer) => answer.status === 201 })) {
    created.add(1);
  }
}
