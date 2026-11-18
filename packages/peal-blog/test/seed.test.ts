// The seed sets up an empty database's schema: one posts collection with
// the fields the pages read, comments off, and no content.
import { readFileSync } from "node:fs";
import path from "node:path";

import { Schema } from "effect";
import { validateSeed } from "emdash";
import { describe, expect, it } from "vitest";

const SeedSchema = Schema.Struct({
  collections: Schema.Array(
    Schema.Struct({
      commentsEnabled: Schema.Boolean,
      fields: Schema.Array(
        Schema.Struct({ slug: Schema.String, type: Schema.String })
      ),
      slug: Schema.String,
      urlPattern: Schema.String,
    })
  ),
  taxonomies: Schema.Array(Schema.Struct({ name: Schema.String })),
});

const raw: unknown = JSON.parse(
  readFileSync(path.join(import.meta.dirname, "../seed/seed.json"), "utf-8")
);

const seed = Schema.decodeUnknownSync(SeedSchema)(raw, {
  onExcessProperty: "ignore",
});

describe("the seed", () => {
  it("is valid for EmDash", () => {
    expect(validateSeed(raw)).toMatchObject({ valid: true });
  });

  it("has the posts collection the pages read, at the base's root", () => {
    expect(seed.collections.map((collection) => collection.slug)).toStrictEqual(
      ["posts"]
    );

    const [posts] = seed.collections;

    expect(posts?.urlPattern).toBe("/{slug}");
    expect(posts?.commentsEnabled).toBe(false);
    expect(
      Object.fromEntries(
        posts?.fields.map((field) => [field.slug, field.type]) ?? []
      )
    ).toStrictEqual({
      body: "portableText",
      cover: "image",
      excerpt: "text",
      title: "string",
    });
  });

  it("has tags and no content", () => {
    expect(seed.taxonomies.map((taxonomy) => taxonomy.name)).toStrictEqual([
      "tag",
    ]);
    expect(raw).not.toHaveProperty("content");
  });
});
