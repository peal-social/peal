import { describe, expect, it } from "bun:test";
import path from "node:path";

import { Schema } from "effect";

// The SDKs' document, which `nx run peal-sdk:spec` writes before these
// tests, beside the contract's it comes from.
const read = async (file: string) =>
  Schema.decodeUnknownSync(Schema.fromJsonString(Schema.JsonObject))(
    await Bun.file(file).text()
  );

const root = path.join(import.meta.dirname, "..", "..");

// What the test reads of an operation: its parameters, by place and name.
const PathsSchema = Schema.Record(
  Schema.String,
  Schema.Record(
    Schema.String,
    Schema.Struct({
      parameters: Schema.optionalKey(
        Schema.Array(Schema.Struct({ in: Schema.String, name: Schema.String }))
      ),
    })
  )
);

// The headers each operation of a document takes, by name.
const headersOf = (document: Schema.JsonObject) =>
  Object.values(Schema.decodeUnknownSync(PathsSchema)(document["paths"]))
    .flatMap((item) => Object.values(item))
    .map(({ parameters = [] }) =>
      parameters
        .filter((parameter) => parameter.in === "header")
        .map(({ name }) => name.toLowerCase())
    );

describe("the SDKs' document", () => {
  it("leaves out the events webhooks send, which the contract's lists", async () => {
    const contract = await read(
      path.join(root, "peal-contract", "openapi.json")
    );

    const sdks = await read(path.join(root, "peal-sdk", "openapi.json"));

    expect(Object.keys(contract)).toContain("webhooks");
    expect(Object.keys(sdks)).not.toContain("webhooks");
  });

  it("names the workspace once, on the client, never as an argument of a method", async () => {
    const contract = await read(
      path.join(root, "peal-contract", "openapi.json")
    );

    const sdks = await read(path.join(root, "peal-sdk", "openapi.json"));

    expect(
      headersOf(contract).filter((names) => names.includes("peal-workspace"))
        .length
    ).toBeGreaterThan(100);
    expect(headersOf(sdks).flat()).not.toContain("peal-workspace");
    expect(sdks["x-fern-global-headers"]).toContainEqual({
      header: "Peal-Workspace",
      name: "workspace",
      optional: true,
    });
  });
});
