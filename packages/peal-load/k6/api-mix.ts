// The public API under Black Friday-scale traffic: a mix of reads, checks
// and scheduled posts, each VU on one workspace's key, at a rate k6 holds
// whatever the answers' times (an arrival rate).
//
//   PROFILE=blackfriday k6 run k6/api-mix.ts
//
// Profiles: `smoke` (20/s), `steps` (RATE_STEP/s more every 45 s, six
// steps, to find the knee), `blackfriday` (842/s for 3 minutes, a busy
// day's rate, then 2,070/s for 3, its busiest second), `flat` (RATE/s for
// DURATION).
import { check } from "k6";
import exec from "k6/execution";
import http from "k6/http";
import type { RefinedResponse, ResponseType } from "k6/http";
import { Counter, Trend } from "k6/metrics";
import type { Options } from "k6/options";

import { bases, config } from "./run-config.ts";

const step = Number(__ENV["RATE_STEP"] ?? "100");
const rate = Number(__ENV["RATE"] ?? "300");

const profiles = {
  blackfriday: [
    { duration: "30s", target: 200 },
    { duration: "30s", target: 842 },
    { duration: "3m", target: 842 },
    { duration: "30s", target: 2070 },
    { duration: "3m", target: 2070 },
    { duration: "20s", target: 0 },
  ],
  flat: [
    { duration: "15s", target: rate },
    { duration: __ENV["DURATION"] ?? "60s", target: rate },
  ],
  smoke: [
    { duration: "10s", target: 20 },
    { duration: "20s", target: 20 },
  ],
  steps: [1, 2, 3, 4, 5, 6].flatMap((n) => [
    { duration: "5s", target: n * step },
    { duration: "40s", target: n * step },
  ]),
};

type Profile = keyof typeof profiles;

const isProfile = (name: string): name is Profile => name in profiles;

const profile = __ENV["PROFILE"] ?? "smoke";

if (!isProfile(profile)) {
  throw new Error(`No profile ${profile}: ${Object.keys(profiles).join(", ")}`);
}

export const options: Options = {
  scenarios: {
    api: {
      executor: "ramping-arrival-rate",
      maxVUs: 4000,
      preAllocatedVUs: 600,
      stages: profiles[profile],
      startRate: 20,
      timeUnit: "1s",
    },
  },
  summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "p(99)", "max"],
  thresholds: {
    // A busy day's share of requests without a server error, 99.961%.
    "checks{kind:no5xx}": ["rate>0.99961"],
    // And its median answer, 64 ms.
    http_req_duration: ["med<64"],
  },
};

const serverErrors = new Counter("server_errors");
const rateLimited = new Counter("rate_limited");

const routes = {
  channels: new Trend("t_channels", true),
  create: new Trend("t_create_post", true),
  credential: new Trend("t_credential", true),
  get: new Trend("t_get_post", true),
  list: new Trend("t_list_posts", true),
  validate: new Trend("t_validate", true),
};

type Route = keyof typeof routes;

// The posts this VU made, to read back.
const mine: string[] = [];

const pick = <A>(list: readonly A[]): A => {
  const chosen = list[Math.floor(Math.random() * list.length)];

  if (chosen === undefined) {
    throw new Error("Nothing to pick from");
  }

  return chosen;
};

const idOf = (body: unknown): string | undefined =>
  typeof body === "object" &&
  body !== null &&
  "id" in body &&
  typeof body.id === "string"
    ? body.id
    : undefined;

// A post scheduled in the weeks ahead, as most posts are.
const later = () => {
  const at = new Date(Date.now() + (7 + Math.random() * 21) * 86_400_000);

  at.setUTCSeconds(0, 0);

  return at.toISOString();
};

export default function apiMix() {
  const workspace =
    config.workspaces[exec.vu.idInTest % config.workspaces.length];

  const base = bases[exec.vu.idInTest % bases.length];

  if (workspace === undefined || base === undefined) {
    throw new Error("Run scripts/setup.ts first");
  }

  const headers = {
    authorization: `Bearer ${workspace.apiKey}`,
    "content-type": "application/json",
  };

  const roll = Math.random();
  let route: Route;
  let response: RefinedResponse<ResponseType | undefined>;

  if (roll < 0.35) {
    route = "list";
    response = http.get(`${base}/api/v1/posts?limit=20`, {
      headers,
      tags: { name: "GET /posts" },
    });
  } else if (roll < 0.5 && mine.length > 0) {
    route = "get";
    response = http.get(`${base}/api/v1/posts/${pick(mine)}`, {
      headers,
      tags: { name: "GET /posts/:id" },
    });
  } else if (roll < 0.68) {
    route = "channels";
    response = http.get(`${base}/api/v1/channels`, {
      headers,
      tags: { name: "GET /channels" },
    });
  } else if (roll < 0.78) {
    route = "credential";
    response = http.get(`${base}/api/v1/credential`, {
      headers,
      tags: { name: "GET /credential" },
    });
  } else if (roll < 0.83) {
    route = "validate";
    response = http.post(
      `${base}/api/v1/posts/validate`,
      JSON.stringify({
        channelIds: [pick(workspace.channelIds)],
        content: {
          media: [],
          overrides: [],
          text: `Checking ${crypto.randomUUID()}`,
        },
      }),
      { headers, tags: { name: "POST /posts/validate" } }
    );
  } else {
    route = "create";
    response = http.post(
      `${base}/api/v1/posts`,
      JSON.stringify({
        channelIds: [pick(workspace.channelIds)],
        content: {
          media: [],
          overrides: [],
          text: `Doors open at midnight ${crypto.randomUUID()}`,
        },
        when: { _tag: "at", at: later(), timeZone: "Europe/Paris" },
      }),
      {
        headers: { ...headers, "idempotency-key": crypto.randomUUID() },
        tags: { name: "POST /posts" },
      }
    );

    const id = response.status === 201 ? idOf(response.json()) : undefined;

    if (id !== undefined && mine.length < 200) {
      mine.push(id);
    }
  }

  routes[route].add(response.timings.duration);

  if (response.status === 0 || response.status >= 500) {
    serverErrors.add(1, { route, status: String(response.status) });
  }

  if (response.status === 429) {
    rateLimited.add(1);
  }

  check(
    response,
    { "no 5xx": (answer) => answer.status > 0 && answer.status < 500 },
    { kind: "no5xx" }
  );
}
