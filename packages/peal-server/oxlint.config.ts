import { defineConfig } from "oxlint";
import type { OxlintOverride } from "oxlint";
import drizzle from "ultracite/oxlint/drizzle";
import vitest from "ultracite/oxlint/vitest";

import root from "../../oxlint.config.ts";
import type { Module } from "./test/lint-modules.ts";
import { modules as moduleMap } from "./test/lint-modules.ts";

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

// The modules each context keeps apart, by its name.
const modules: Partial<Record<Kernel, Readonly<Record<string, Module>>>> =
  moduleMap;

// Every module of the context but those `open` names (the map, with what a
// module is, is in test/lint-modules.ts), by any alias or relative path
// through the module's folder (`./feeds/x.ts`, `././feeds/x.ts`,
// `./sub/../feeds/x.ts`, `#publishing/application/../application/feeds/x.ts`):
// each layer rule refuses them last.
const moduleWalls = (context: Kernel, open: readonly string[] = []) =>
  Object.keys(modules[context] ?? {}).flatMap((name) =>
    open.includes(name)
      ? []
      : [
          `#${context}/*/${name}/**`,
          `#${context}/**/${name}/**`,
          `./${name}/**`,
          `./**/${name}/**`,
        ]
  );

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

// Added to the layer's own message, which may be the cause instead.
const wallMessage =
  "; and a module's folder is imported only by its own files, the container and the seams test/lint-modules.ts names, never by another module (move the code into the module, or name the seam there with its reason).";

// The walls go last in the layer's own group: a negation in any pattern lets
// an import through, so a pattern of their own would not refuse what the
// layer allows. Their sentence follows the layer's, so it reads as one more
// rule of the layer, not as the one broken.
const restrict = (
  message: string,
  group: readonly string[],
  ai: AiImports = "seam",
  walls: readonly string[] = []
): NonNullable<Rules["no-restricted-imports"]> => [
  "error",
  {
    paths: noGateway,
    patterns: [
      {
        group: [...group, ...walls],
        message:
          walls.length > 0
            ? `${message.replace(/\.$/u, "")}${wallMessage}`
            : message,
      },
      testHelpers,
      ...(ai === "seam" ? [aiSeam] : []),
    ],
  },
];

// Domain: entities and rules, built on Effect's core only.
const domain = (context: Kernel, open: readonly string[] = []) =>
  restrict(
    "The domain imports `effect`, its own domain and the shared domain only. Move adapters to infrastructure.",
    ["*", "!effect", "!./**", `!#${context}/domain/**`, "!#shared/domain/**"],
    "seam",
    moduleWalls(context, open)
  );

// Application: use cases and the ports (Context.Service) they need.
const application = (context: Kernel, open: readonly string[] = []) =>
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
    ],
    "seam",
    moduleWalls(context, open)
  );

// Infrastructure: adapters behind the ports. Any package; other contexts only
// through their use cases.
const infrastructure = (
  context: Kernel,
  open: readonly string[] = [],
  ai: AiImports = "seam"
) =>
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
    ai,
    moduleWalls(context, open)
  );

// Api: HttpApiBuilder handlers for peal-contract. Use cases come from the
// context's container, never from infrastructure. Of Effect's modules, only
// the core and HTTP: SQL, cluster, workflow and AI go through a use case. A
// handler in a module's folder reaches the layer's other files by alias.
const api = (context: Kernel, open: readonly string[] = []) =>
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
      `!#${context}/api/**`,
      "!#shared/domain/**",
      "!#shared/application/**",
      "!#shared/api/**",
    ],
    "seam",
    moduleWalls(context, open)
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

const layers = ["domain", "application", "infrastructure", "api"] as const;

type Layer = (typeof layers)[number];

// A layer's rules, for files that may import the modules `open` names. The
// domain and application repeat the globals and properties with their
// imports, as each override below states its layer's rules whole.
const layerRules = (
  context: Kernel,
  layer: Layer,
  open: readonly string[] = []
): Rules => {
  switch (layer) {
    case "domain": {
      return {
        "no-restricted-globals": pureGlobals,
        "no-restricted-imports": domain(context, open),
        "no-restricted-properties": pureProperties,
      };
    }

    case "application": {
      return {
        "no-restricted-globals": pureGlobals,
        "no-restricted-imports": application(context, open),
        "no-restricted-properties": pureProperties,
      };
    }

    case "infrastructure": {
      return { "no-restricted-imports": infrastructure(context, open) };
    }

    case "api": {
      return { "no-restricted-imports": api(context, open) };
    }

    default: {
      return layer;
    }
  }
};

const layerOverrides: OxlintOverride[] = (
  ["shared", ...contexts] as const
).flatMap((context) => [
  ...layers.map((layer) => ({
    files: [`src/${context}/${layer}/**`],
    rules: layerRules(context, layer),
  })),
  {
    files: [`src/${context}/container.ts`],
    rules: { "no-restricted-imports": container(context) },
  },
]);

// The layer a seam belongs to, from its path: `src/<context>/<layer>/…`.
const layerOf = (file: string): Layer => {
  const folder = file.split("/").at(2);
  const layer = layers.find((name) => name === folder);

  if (layer === undefined) {
    throw new Error(`A seam is a file of a layer, not ${file}`);
  }

  return layer;
};

// After the layers' own: each module's files, which may import their own
// module, then each seam, which may import the modules that name it.
const moduleOverrides: OxlintOverride[] = (
  ["shared", ...contexts] as const
).flatMap((context) => {
  const named = modules[context] ?? {};
  const names = Object.keys(named);

  const own = names.flatMap((name) =>
    layers.map((layer) => ({
      files: [`src/${context}/${layer}/${name}/**`],
      rules: layerRules(context, layer, [name]),
    }))
  );

  const seams = [
    ...new Set(Object.values(named).flatMap(({ seams: files }) => files)),
  ].map((file) => ({
    files: [file],
    rules: layerRules(
      context,
      layerOf(file),
      names.filter((name) => named[name]?.seams.includes(file) === true)
    ),
  }));

  return [...own, ...seams];
});

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
    ...moduleOverrides,
    {
      // The one seam where the AI SDK is used.
      files: ["src/assistant/infrastructure/ai-sdk/**"],
      rules: {
        "no-restricted-imports": infrastructure("assistant", [], "allowed"),
      },
    },
  ],
});
