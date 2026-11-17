import type { CodeDemoTab } from "peal-ui/components/code-demo";

// The home page's demo: one post sent now to two channels and answered once
// each has its result, as the docs' "Publish now and wait for the outcome"
// shows it, through each way in. The ids are made up and read as such; the
// shapes are the contract's (POST …/posts/send, the MCP tool create_post,
// the TypeScript SDK's posts.send).

const workspace = "0190f3a0-0000-7000-8000-00000000a001";

const channels = [
  "0190f3a0-0000-7000-8000-00000000c001",
  "0190f3a0-0000-7000-8000-00000000c002",
];

const idempotencyKey = "5f0c2b7e-3d1a-4e58-9a6b-2c4d8e1f7a90";

const text =
  "Our spring catalogue is out. Read it at https://example.com/spring";

const response = JSON.stringify(
  {
    id: "0190f3a0-0000-7000-8000-00000000b001",
    outcome: "published",
    status: "finished",
    targets: channels.map((channelId, index) => ({
      channelId,
      failureReason: null,
      id: `0190f3a0-0000-7000-8000-00000000d00${index + 1}`,
      permalink: `https://social.example/@peal_example/11551234567890${index + 1}`,
      publishedAt: `2026-11-16T08:00:0${index + 2}.000Z`,
      status: "published",
    })),
  },
  null,
  2
);

const curl = `curl -X POST "https://app.peal.social/api/workspaces/${workspace}/posts/send?wait=30" \\
  -H "Authorization: Bearer $PEAL_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: ${idempotencyKey}" \\
  -d '{
    "channelIds": [
      "${channels[0] ?? ""}",
      "${channels[1] ?? ""}"
    ],
    "content": {
      "text": "${text}",
      "media": [],
      "overrides": []
    },
    "when": { "_tag": "now" }
  }'`;

const cli = `export PEAL_API_URL="https://app.peal.social"
export PEAL_API_KEY="peal_…"
export PEAL_WORKSPACE="${workspace}"

peal post "${text}" \\
  --channels ${channels.join(",")} \\
  --now --wait 30 \\
  --idempotency-key ${idempotencyKey}`;

const mcp = JSON.stringify(
  {
    arguments: {
      channelIds: channels,
      content: { media: [], overrides: [], text },
      idempotencyKey,
      waitSeconds: 30,
      when: { _tag: "now" },
    },
    name: "create_post",
  },
  null,
  2
);

const sdk = `import { PealClient } from "peal-sdk";

const peal = new PealClient({
  token: process.env.PEAL_API_KEY,
  baseUrl: "https://app.peal.social",
});

const post = await peal.posts.send({
  workspaceId: "${workspace}",
  wait: "30",
  "idempotency-key": "${idempotencyKey}",
  channelIds: [
    "${channels[0] ?? ""}",
    "${channels[1] ?? ""}",
  ],
  content: {
    text: "${text}",
    media: [],
    overrides: [],
  },
  when: { _tag: "now" },
});`;

/** The demo's tabs: API, command line, MCP and SDK, with one answer. */
export const demoTabs: readonly CodeDemoTab[] = [
  {
    icon: "braces",
    label: "API",
    request: { code: curl, label: "curl" },
    response: { code: response, label: ".json" },
    value: "api",
  },
  {
    icon: "terminal",
    label: "CLI",
    request: { code: cli, label: "peal" },
    response: { code: response, label: ".json" },
    value: "cli",
  },
  {
    icon: "bot",
    label: "MCP",
    request: { code: mcp, label: "tools/call" },
    response: { code: response, label: ".json" },
    value: "mcp",
  },
  {
    icon: "package",
    label: "SDK",
    request: { code: sdk, label: "typescript" },
    response: { code: response, label: ".json" },
    value: "sdk",
  },
];
