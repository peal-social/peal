import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

import { PealTools } from "#app/mcp/tools.ts";

// Peal's plugin (packages/peal-skills/plugin.json) gives ChatGPT's review
// prompts, each with the tools a reviewer should see it call: a tool
// renamed or removed here would fail that review, so each must be one the
// endpoint offers.

const PluginSchema = Schema.Struct({
  extensions: Schema.Struct({
    "com.openai": Schema.Struct({
      review: Schema.Struct({
        test_cases: Schema.Struct({
          positive: Schema.Array(
            Schema.Struct({ tools_triggered: Schema.Array(Schema.String) })
          ),
        }),
      }),
    }),
  }),
});

const plugin = Schema.decodeUnknownSync(PluginSchema)(
  JSON.parse(
    readFileSync(
      path.join(import.meta.dirname, "../../../peal-skills/plugin.json"),
      "utf-8"
    )
  )
);

describe("the plugin's review cases", () => {
  it("name only tools the endpoint offers", () => {
    const offered = new Set(Object.keys(PealTools.tools));

    const named = plugin.extensions[
      "com.openai"
    ].review.test_cases.positive.flatMap(
      ({ tools_triggered }) => tools_triggered
    );

    expect(named.filter((name) => !offered.has(name))).toStrictEqual([]);
    expect(named.length).toBeGreaterThan(0);
  });
});
