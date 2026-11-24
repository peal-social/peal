import { defineConfig } from "oxlint";
import type { OxlintOverride } from "oxlint";
import drizzle from "ultracite/oxlint/drizzle";
import vitest from "ultracite/oxlint/vitest";

import root from "../../oxlint.config.ts";

// Clean Architecture, enforced. Each bounded context under src/ has four
// layers, and every import between folders goes through `#<context>/<layer>/…`
// (package.json "imports"), so these patterns can tell layers apart. Patterns
// follow .gitignore rules: later lines win, and `!` allows again.

const contexts = [
  "publishing",
  "channels",
  "media",
  "workspace",
  "analytics",
  "billing",
  "notifications",
  "assistant",
  "staff",
  "legal",
  "review",
  "webhooks",
  "activity",
  "engagement",
  "ads",
  "shortlinks",
  "agent",
] as const;

type Kernel = (typeof contexts)[number] | "shared";

type Rules = NonNullable<OxlintOverride["rules"]>;

// The server image ships src/ only, so production code that imported a test
// helper would pass the checks and fail at startup. Every rule below repeats
// this pattern, because an override replaces the options of the ones before.
const testHelpers = {
  group: ["#test/**"],
  message: "Production code never imports test helpers.",
};

// The AI SDK is reached through one seam, the assistant's adapter
// (`src/assistant/infrastructure/ai-sdk/`), which keeps its globals, its
// errors and its keys in hand; everything else talks to effect/ai.
const aiSeam = {
  group: ["/ai", "/ai/**", "@ai-sdk/**"],
  message:
    "Only src/assistant/infrastructure/ai-sdk/ imports the AI SDK: use effect/ai and the adapter there.",
};

// The SDK's hosted gateway sends prompts to its vendor's service: never
// imported, anywhere.
const gatewayMessage =
  "Peal never sends a prompt through the AI SDK's hosted gateway.";

const noGateway = [
  { message: gatewayMessage, name: "@ai-sdk/gateway" },
  {
    importNames: ["gateway", "createGateway"],
    message: gatewayMessage,
    name: "ai",
  },
];

type AiImports = "seam" | "allowed";

const restrict = (
  message: string,
  group: readonly string[],
  ai: AiImports = "seam"
): NonNullable<Rules["no-restricted-imports"]> => [
  "error",
  {
    paths: noGateway,
    patterns: [
      { group: [...group], message },
      testHelpers,
      ...(ai === "seam" ? [aiSeam] : []),
    ],
  },
];

// Domain: entities and rules, built on Effect's core only.
const domain = (context: Kernel) =>
  restrict(
    "The domain imports `effect`, its own domain and the shared domain only. Move adapters to infrastructure.",
    ["*", "!effect", "!./**", `!#${context}/domain/**`, "!#shared/domain/**"]
  );

// Application: use cases and the ports (Context.Service) they need.
const application = (context: Kernel) =>
  restrict(
    "Use cases import `effect`, their context's domain and application, and the shared kernel. Reach outside services through a port.",
    [
      "*",
      "!effect",
      "!./**",
      `!#${context}/domain/**`,
      `!#${context}/application/**`,
      "!#shared/domain/**",
      "!#shared/application/**",
    ]
  );

// Infrastructure: adapters behind the ports. Any package; other contexts only
// through their use cases.
const infrastructure = (context: Kernel, ai: AiImports = "seam") =>
  restrict(
    "Adapters may use any package, their own context, the shared kernel and other contexts' application layer, never another context's internals or an api layer.",
    [
      "*/domain/**",
      "*/infrastructure/**",
      "*/api/**",
      "*/container.ts",
      "?app/**",
      `!#${context}/domain/**`,
      `!#${context}/infrastructure/**`,
      "!#shared/**",
    ],
    ai
  );

// Api: HttpApiBuilder handlers for peal-contract. Use cases come from the
// context's container, never from infrastructure. Of Effect's modules, only
// the core and HTTP: SQL, cluster, workflow and AI go through a use case.
const api = (context: Kernel) =>
  restrict(
    "Handlers import Effect's core and HTTP modules, peal-contract, their context's container, domain and application, and the shared kernel. Reach the database, workflows or AI through a use case.",
    [
      "*",
      "!effect",
      "!effect/http",
      "!effect/http-api",
      "!peal-contract",
      "!./**",
      `!#${context}/container.ts`,
      `!#${context}/domain/**`,
      `!#${context}/application/**`,
      "!#shared/domain/**",
      "!#shared/application/**",
      "!#shared/api/**",
    ]
  );

// The MCP endpoint (src/app/mcp/): a second delivery layer beside the api
// layers, inside the composition root. Its tools answer with the views and
// inputs the HTTP handlers use (`#<context>/api/…`), and reach the database,
// workflows and adapters through a context's use cases, as handlers do. The
// one adapter it reads is the database ping, which the health tool answers
// with, as GET /api/ready does.
const mcp = restrict(
  "MCP tools import Effect's core, AI and HTTP modules, peal-contract, #app, and any context's container, domain, application and api. Reach the database, workflows or adapters through a use case.",
  [
    "*",
    "!effect",
    "!effect/ai",
    "!effect/http",
    "!peal-contract",
    "!peal-contract/rate-card",
    "!./**",
    "!#app/**",
    ...contexts.flatMap((context) => [
      `!#${context}/container.ts`,
      `!#${context}/domain/**`,
      `!#${context}/application/**`,
      `!#${context}/api/**`,
    ]),
    "!#shared/domain/**",
    "!#shared/application/**",
    "!#shared/api/**",
    "!#shared/infrastructure/database-ping.ts",
  ]
);

// The container wires one context's layers together.
const container = (context: Kernel) =>
  restrict("A container wires its own context and the shared kernel only.", [
    "*/domain/**",
    "*/application/**",
    "*/infrastructure/**",
    "*/api/**",
    "*/container.ts",
    "?app/**",
    `!#${context}/**`,
    "!#shared/**",
  ]);

// Time, ids and configuration come from Effect services, so tests control them.
const clockMessage = "Use DateTime or Clock from effect, which tests control.";
const randomMessage = "Take ids and randomness from a port.";
const configMessage = "Read configuration with Config from effect.";
const runtimeMessage = "Runtime APIs belong in infrastructure.";

const pureGlobals: NonNullable<Rules["no-restricted-globals"]> = [
  "error",
  { message: clockMessage, name: "Date" },
  { message: clockMessage, name: "performance" },
  { message: randomMessage, name: "crypto" },
  { message: configMessage, name: "process" },
  { message: runtimeMessage, name: "Bun" },
];

// The same, reached as properties: Effect's own clock bypasses (nowUnsafe
// reads Date.now()), Math.random, and the globals through globalThis.
const pureProperties: NonNullable<Rules["no-restricted-properties"]> = [
  "error",
  ...["nowUnsafe", "isPastUnsafe", "isFutureUnsafe"].map((property) => ({
    message: "Use DateTime.now or Clock, which tests control.",
    object: "DateTime",
    property,
  })),
  { message: randomMessage, object: "Math", property: "random" },
  { message: clockMessage, object: "globalThis", property: "Date" },
  { message: clockMessage, object: "globalThis", property: "performance" },
  { message: randomMessage, object: "globalThis", property: "crypto" },
  { message: configMessage, object: "globalThis", property: "process" },
  { message: runtimeMessage, object: "globalThis", property: "Bun" },
];

const layerOverrides: OxlintOverride[] = (
  ["shared", ...contexts] as const
).flatMap((context) => [
  {
    files: [`src/${context}/domain/**`],
    rules: {
      "no-restricted-globals": pureGlobals,
      "no-restricted-imports": domain(context),
      "no-restricted-properties": pureProperties,
    },
  },
  {
    files: [`src/${context}/application/**`],
    rules: {
      "no-restricted-globals": pureGlobals,
      "no-restricted-imports": application(context),
      "no-restricted-properties": pureProperties,
    },
  },
  {
    files: [`src/${context}/infrastructure/**`],
    rules: { "no-restricted-imports": infrastructure(context) },
  },
  {
    files: [`src/${context}/api/**`],
    rules: { "no-restricted-imports": api(context) },
  },
  {
    files: [`src/${context}/container.ts`],
    rules: { "no-restricted-imports": container(context) },
  },
]);

// Oxlint lints each file with its nearest config alone, so this extends the
// root config and repeats the properties that extends doesn't carry over.
export default defineConfig({
  env: root.env ?? {},
  extends: [root, drizzle, vitest],
  ignorePatterns: root.ignorePatterns ?? [],
  overrides: [
    {
      // Folders import each other through `#…`, which the layer rules read.
      files: ["src/**", "test/**"],
      rules: { "import/no-relative-parent-imports": "error" },
    },
    {
      // The composition root and entry point, which no layer rule covers.
      files: ["src/**"],
      rules: {
        "no-restricted-imports": [
          "error",
          { paths: noGateway, patterns: [testHelpers, aiSeam] },
        ],
      },
    },
    {
      // After src/**, whose options it replaces for the MCP endpoint.
      files: ["src/app/mcp/**"],
      rules: { "no-restricted-imports": mcp },
    },
    {
      // Tests may drive the SDK (its mock models), never its gateway.
      files: ["test/**"],
      rules: { "no-restricted-imports": ["error", { paths: noGateway }] },
    },
    ...layerOverrides,
    {
      // The one seam where the AI SDK is used.
      files: ["src/assistant/infrastructure/ai-sdk/**"],
      rules: {
        "no-restricted-imports": infrastructure("assistant", "allowed"),
      },
    },
  ],
});
