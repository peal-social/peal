import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { afterAll, beforeAll, describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

// The lint rules keep the AI SDK behind one seam, the assistant's adapter in
// `src/assistant/infrastructure/ai-sdk/`. Their patterns follow .gitignore
// rules, where a name without a slash matches at any depth, so a guard that
// looks right can refuse nothing (`/ai`) or too much (`ai`, which also
// refuses `effect/unstable/ai`). This lints a tree of files at the server's
// paths, through the server's own config, with the pinned oxlint.

const server = path.join(import.meta.dirname, "..");

const oxlint = path.join(server, "..", "..", "node_modules", ".bin", "oxlint");

const seamHelp = "Only src/assistant/infrastructure/ai-sdk/";

const gatewayHelp = "hosted gateway";

// The AI SDK, every way a file can reach it.
const sdk = [
  `import { generateText } from "ai";`,
  `import type { LanguageModel } from "ai";`,
  `export { streamText } from "ai";`,
  `export const load = () => import("ai");`,
  `import { MockLanguageModelV4 } from "ai/test";`,
  `import { createStreamableUI } from "ai/rsc";`,
  `import { anthropic } from "@ai-sdk/anthropic";`,
];

// Never the AI SDK, though each ends in `ai`.
const notSdk = [
  `import { Tool } from "effect/ai";`,
  `import { Prompt } from "effect/unstable/ai";`,
  `import { one } from "./ai.ts";`,
  `import { two } from "./helpers/ai.ts";`,
  `import { three } from "./ai/index.ts";`,
  `import { four } from "#shared/domain/ai.ts";`,
  `import { five } from "#shared/domain/ai/index.ts";`,
];

// Refused everywhere, tests included.
const gateway = [
  `import { gateway } from "ai";`,
  `import { createGateway } from "@ai-sdk/gateway";`,
];

const lines = [...sdk, ...notSdk, ...gateway];

// Where the SDK is refused: each layer of a context, a module's folder and
// one of its seams, a container, the shared kernel, the composition root,
// the MCP endpoint and the entry point.
const refusing = [
  "src/publishing/domain/probe.ts",
  "src/publishing/application/probe.ts",
  "src/publishing/infrastructure/probe.ts",
  "src/publishing/api/probe.ts",
  "src/publishing/infrastructure/feeds/probe.ts",
  "src/publishing/application/feeds/probe.ts",
  "src/publishing/infrastructure/crons.ts",
  "src/publishing/container.ts",
  "src/assistant/infrastructure/probe.ts",
  "src/shared/infrastructure/probe.ts",
  "src/app/probe.ts",
  "src/app/mcp/probe.ts",
  "src/main.ts",
];

// Where it is not: the seam, and tests, which drive its mock models.
const allowing = [
  "src/assistant/infrastructure/ai-sdk/probe.ts",
  "test/assistant/probe.test.ts",
];

const ReportSchema = Schema.Struct({
  diagnostics: Schema.Array(
    Schema.Struct({
      code: Schema.optional(Schema.String),
      filename: Schema.String,
      help: Schema.optional(Schema.String),
      labels: Schema.Array(
        Schema.Struct({ span: Schema.Struct({ line: Schema.Number }) })
      ),
    })
  ),
});

const decodeReport = Schema.decodeUnknownSync(
  Schema.fromJsonString(ReportSchema)
);

type Kind = "seam" | "gateway" | "other";

const kindOf = (help: string): Kind => {
  if (help.includes(seamHelp)) {
    return "seam";
  }

  return help.includes(gatewayHelp) ? "gateway" : "other";
};

interface Linted {
  /** What the rule said of each line, by file relative to the tree. */
  readonly found: ReadonlyMap<string, ReadonlyMap<string, ReadonlySet<Kind>>>;
  /** The files oxlint could not read, whose imports it never checked. */
  readonly unread: readonly string[];
}

// Writes every file at its path in the tree and lints them in one run.
const lint = (tree: string): Linted => {
  // Overrides match paths from their config's folder, so the tree gets a
  // config of its own that is the server's.
  writeFileSync(
    path.join(tree, "oxlint.config.ts"),
    `export { default } from ${JSON.stringify(pathToFileURL(path.join(server, "oxlint.config.ts")).href)};\n`
  );

  for (const file of [...refusing, ...allowing]) {
    mkdirSync(path.dirname(path.join(tree, file)), { recursive: true });
    writeFileSync(path.join(tree, file), `${lines.join("\n")}\n`);
  }

  // From the server's folder, where oxlint finds its type-aware linter.
  const run = spawnSync(
    oxlint,
    ["--format", "json", "-c", path.join(tree, "oxlint.config.ts"), tree],
    { cwd: server, encoding: "utf-8", maxBuffer: 16 * 1024 * 1024 }
  );

  if (run.error !== undefined) {
    throw run.error;
  }

  const found = new Map<string, Map<string, Set<Kind>>>();
  const unread: string[] = [];

  for (const diagnostic of decodeReport(run.stdout).diagnostics) {
    const file = path.relative(tree, diagnostic.filename);
    const line = lines[(diagnostic.labels[0]?.span.line ?? 0) - 1];

    // A file that does not parse gets diagnostics without a rule.
    if (diagnostic.code === undefined) {
      unread.push(file);
    } else if (
      diagnostic.code === "eslint(no-restricted-imports)" &&
      line !== undefined
    ) {
      const byLine = found.get(file) ?? new Map<string, Set<Kind>>();
      const kinds = byLine.get(line) ?? new Set<Kind>();

      kinds.add(kindOf(diagnostic.help ?? ""));
      byLine.set(line, kinds);
      found.set(file, byLine);
    }
  }

  return { found, unread };
};

describe("the AI SDK's seam in the lint rules", () => {
  let tree = "";
  let linted: Linted = { found: new Map(), unread: [] };

  const kindsOf = (file: string, line: string): ReadonlySet<Kind> =>
    linted.found.get(file)?.get(line) ?? new Set();

  beforeAll(() => {
    // Real, as oxlint names files (macOS's temporary folder is a link).
    tree = realpathSync(mkdtempSync(path.join(tmpdir(), "peal-lint-ai-seam-")));
    linted = lint(tree);
  });

  afterAll(() => {
    rmSync(tree, { force: true, recursive: true });
  });

  it("reads every file", () => {
    expect(linted.found.size).toBeGreaterThan(0);
    expect(linted.unread).toStrictEqual([]);
  });

  describe.each(refusing)("%s", (file) => {
    it.each(sdk)("refuses %s", (line) => {
      expect(kindsOf(file, line).has("seam")).toBeTruthy();
    });

    it.each(notSdk)("does not take %s for the SDK", (line) => {
      expect(kindsOf(file, line).has("seam")).toBeFalsy();
    });
  });

  describe.each(allowing)("%s", (file) => {
    it.each(sdk)("allows %s", (line) => {
      expect([...kindsOf(file, line)]).toStrictEqual([]);
    });
  });

  describe.each([...refusing, ...allowing])("%s", (file) => {
    it.each(gateway)("refuses the gateway, %s", (line) => {
      expect(kindsOf(file, line).has("gateway")).toBeTruthy();
    });
  });
});
