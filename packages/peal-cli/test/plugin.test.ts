import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "@effect/vitest";
import { Schema } from "effect";

// packages/peal-skills is Peal's plugin, in one folder that each client
// reads in its own format: the Agent Plugins manifest (plugin.json and
// mcp.json, which ChatGPT, Codex, Cursor and Hermes Agent read), Claude's
// (.claude-plugin/plugin.json and .mcp.json) and Cursor's
// (.cursor-plugin/plugin.json). The repository's marketplaces point at the
// folder. This keeps them saying the same thing, and the ChatGPT listing
// inside the limits its directory sets.

const root = path.join(import.meta.dirname, "../../..");

const pluginFolder = "packages/peal-skills";

const contents = (file: string): string =>
  readFileSync(path.join(root, file), "utf-8");

// What every manifest names alike.
const ManifestSchema = Schema.Struct({
  description: Schema.String,
  license: Schema.String,
  name: Schema.String,
  version: Schema.String,
});

const upTo = (length: number) =>
  Schema.String.check(Schema.isMaxLength(length));

const PositiveCaseSchema = Schema.Struct({
  description: Schema.String,
  expected_behavior: Schema.String,
  prompt: Schema.String,
  tools_triggered: Schema.Array(Schema.String),
});

const NegativeCaseSchema = Schema.Struct({
  description: Schema.String,
  prompt: Schema.String,
});

// The limits of OpenAI's plugin submission, for the fields Peal sets.
const AgentPluginSchema = Schema.Struct({
  ...ManifestSchema.fields,
  $schema: Schema.Literal(
    "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json"
  ),
  description: upTo(4000),
  extensions: Schema.Struct({
    "com.openai": Schema.Struct({
      interface: Schema.Struct({
        defaultPrompt: Schema.Array(upTo(128)).check(Schema.isMaxLength(3)),
        developerName: upTo(80),
        displayName: upTo(30),
        logo: Schema.String,
        longDescription: upTo(4000),
        privacyPolicyURL: upTo(1024),
        shortDescription: upTo(30),
        supportURL: upTo(1024),
        termsOfServiceURL: upTo(1024),
        websiteURL: upTo(1024),
      }),
      publication: Schema.Struct({
        translations: Schema.Record(
          Schema.String,
          Schema.Struct({ description: upTo(4000), subtitle: upTo(30) })
        ),
      }),
      review: Schema.Struct({
        test_cases: Schema.Struct({
          negative: Schema.Array(NegativeCaseSchema),
          positive: Schema.Array(PositiveCaseSchema),
        }),
      }),
    }),
  }),
  keywords: Schema.Array(Schema.String).check(Schema.isMaxLength(25)),
});

const CursorPluginSchema = Schema.Struct({
  ...ManifestSchema.fields,
  logo: Schema.String,
  mcpServers: Schema.Record(
    Schema.String,
    Schema.Struct({ url: Schema.String })
  ),
});

const ServersSchema = (type: string) =>
  Schema.Struct({
    mcpServers: Schema.Record(
      Schema.String,
      Schema.Struct({ type: Schema.Literal(type), url: Schema.String })
    ),
  });

const MarketplaceSchema = Schema.Struct({
  plugins: Schema.Array(
    Schema.Struct({ name: Schema.String, source: Schema.String })
  ),
});

const agentPlugin = Schema.decodeUnknownSync(
  Schema.fromJsonString(AgentPluginSchema)
)(contents(`${pluginFolder}/plugin.json`));

const claudePlugin = Schema.decodeUnknownSync(
  Schema.fromJsonString(ManifestSchema)
)(contents(`${pluginFolder}/.claude-plugin/plugin.json`));

const cursorPlugin = Schema.decodeUnknownSync(
  Schema.fromJsonString(CursorPluginSchema)
)(contents(`${pluginFolder}/.cursor-plugin/plugin.json`));

const ownServers = Schema.decodeUnknownSync(
  Schema.fromJsonString(ServersSchema("http"))
);

const agentServers = Schema.decodeUnknownSync(
  Schema.fromJsonString(ServersSchema("streamable-http"))
);

const marketplace = Schema.decodeUnknownSync(
  Schema.fromJsonString(MarketplaceSchema)
);

const openai = agentPlugin.extensions["com.openai"];

// Peal Cloud's endpoint, which the listings connect to.
const endpoint = "https://app.peal.social/api/mcp";

// What every manifest must say alike.
const shared = ({
  description,
  license,
  name,
  version,
}: typeof ManifestSchema.Type) => ({ description, license, name, version });

// Each server a manifest connects to, and its address.
const urls = (servers: Readonly<Record<string, { readonly url: string }>>) =>
  Object.entries(servers).map(([name, { url }]) => [name, url]);

// Each plugin a marketplace lists, and the folder it reads it from.
const listed = (file: string) =>
  marketplace(contents(file)).plugins.map(({ name, source }) => [
    name,
    path.normalize(source),
  ]);

describe("Peal's plugin", () => {
  it("has the same name, version, description and licence in every manifest", () => {
    expect(shared(claudePlugin)).toStrictEqual(shared(agentPlugin));
    expect(shared(cursorPlugin)).toStrictEqual(shared(agentPlugin));
    expect(agentPlugin.license).toBe("Apache-2.0");
  });

  it("connects every client to Peal Cloud's MCP endpoint, and to nothing else", () => {
    const expected = [["peal", endpoint]];

    expect(
      urls(agentServers(contents(`${pluginFolder}/mcp.json`)).mcpServers)
    ).toStrictEqual(expected);
    expect(
      urls(ownServers(contents(`${pluginFolder}/.mcp.json`)).mcpServers)
    ).toStrictEqual(expected);
    expect(urls(cursorPlugin.mcpServers)).toStrictEqual(expected);
  });

  it("is what both of the repository's marketplaces list", () => {
    const expected = [["peal", path.normalize(pluginFolder)]];

    expect(listed(".claude-plugin/marketplace.json")).toStrictEqual(expected);
    expect(listed(".cursor-plugin/marketplace.json")).toStrictEqual(expected);
  });

  it("gives ChatGPT's review five cases that use Peal and three that do not", () => {
    expect(openai.review.test_cases.positive).toHaveLength(5);
    expect(openai.review.test_cases.negative).toHaveLength(3);
  });

  it("links only to files the plugin holds", () => {
    for (const logo of [openai.interface.logo, cursorPlugin.logo]) {
      expect(() =>
        readFileSync(path.join(root, pluginFolder, logo))
      ).not.toThrow();
    }
  });
});
