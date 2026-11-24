import { describe, expect, it } from "@effect/vitest";

import { toolCatalogue } from "#app/mcp/catalogue.ts";
import { FeedTools } from "#app/mcp/feeds-tools.ts";

// The feeds' tools as the catalogue lists them: a feed of drafts takes the
// scope that writes, as its use cases check; one on a queue takes
// post:schedule as well, which each tool's description says.

describe("the feeds' tools", () => {
  it("take workspace:write, the preview included, which spends a read", () => {
    const feedTools = new Set(Object.keys(FeedTools.tools));

    const scopes = Object.fromEntries(
      toolCatalogue()
        .filter(({ name }) => feedTools.has(name))
        .map(({ area, changes, name, scope }) => [name, [area, scope, changes]])
    );

    expect(scopes).toStrictEqual({
      create_feed: ["automations", "workspace:write", true],
      delete_feed: ["automations", "workspace:write", true],
      get_feed: ["automations", "workspace:read", false],
      list_feeds: ["automations", "workspace:read", false],
      preview_feed: ["automations", "workspace:write", true],
      update_feed: ["automations", "workspace:write", true],
    });
  });
});
