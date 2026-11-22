import { describe, expect, it } from "@effect/vitest";

import {
  advertised,
  siblingConflicts,
} from "#agent/infrastructure/advertised-schema.ts";

const uuid =
  "^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

describe("the schema a tool is advertised with", () => {
  it("drops an allOf member's key its object sets, everywhere, and keeps the rest", () => {
    const refused = {
      properties: {
        options: {
          items: {
            properties: {
              thumbnailMediaId: {
                allOf: [{ pattern: "^[^A-Z]*$" }],
                pattern: uuid,
                type: "string",
              },
            },
            type: "object",
          },
          type: "array",
        },
        title: {
          allOf: [{ maxLength: 100 }, { pattern: "^[^A-Z]*$" }],
          pattern: "^.+$",
          type: "string",
        },
      },
      type: "object",
    };

    expect(siblingConflicts(refused)).toStrictEqual([
      "$.properties.options.items.properties.thumbnailMediaId.allOf[0].pattern",
      "$.properties.title.allOf[1].pattern",
    ]);

    expect(advertised(refused)).toStrictEqual({
      properties: {
        options: {
          items: {
            properties: {
              thumbnailMediaId: { pattern: uuid, type: "string" },
            },
            type: "object",
          },
          type: "array",
        },
        title: {
          allOf: [{ maxLength: 100 }],
          pattern: "^.+$",
          type: "string",
        },
      },
      type: "object",
    });

    expect(siblingConflicts(advertised(refused))).toStrictEqual([]);
  });
});
