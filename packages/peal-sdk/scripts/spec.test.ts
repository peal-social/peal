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
        Schema.Array(
          Schema.Struct({
            in: Schema.String,
            name: Schema.String,
            required: Schema.optionalKey(Schema.Boolean),
          })
        )
      ),
    })
  )
);

// The headers some operation of a document requires, by name.
const requiredHeadersOf = (document: Schema.JsonObject) =>
  Object.values(Schema.decodeUnknownSync(PathsSchema)(document["paths"]))
    .flatMap((item) => Object.values(item))
    .flatMap(({ parameters = [] }) =>
      parameters
        .filter(
          (parameter) =>
            parameter.in === "header" && parameter.required === true
        )
        .map(({ name }) => name.toLowerCase())
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

// What the test reads of an operation: its id and its SDK names.
const NamedPathsSchema = Schema.Record(
  Schema.String,
  Schema.Record(
    Schema.String,
    Schema.Struct({
      operationId: Schema.String,
      "x-fern-sdk-group-name": Schema.Union([
        Schema.String,
        Schema.Array(Schema.String),
      ]),
      "x-fern-sdk-method-name": Schema.String,
    })
  )
);

// Each operation of the SDKs' document: its id, its namespace's segments
// and its method.
const namesOf = (document: Schema.JsonObject) =>
  Object.values(
    Schema.decodeUnknownSync(NamedPathsSchema)(document["paths"])
  ).flatMap((item) =>
    Object.values(item).map((operation) => ({
      id: operation.operationId,
      method: operation["x-fern-sdk-method-name"],
      namespace: [operation["x-fern-sdk-group-name"]].flat(),
    }))
  );

describe("the SDKs' namespaces", () => {
  it("nests a namespace of several segments, its method the id's last", async () => {
    const sdks = await read(path.join(root, "peal-sdk", "openapi.json"));
    const names = namesOf(sdks);

    expect(names.find(({ id }) => id === "inbox.messages.send")).toEqual({
      id: "inbox.messages.send",
      method: "send",
      namespace: ["inbox", "messages"],
    });
    expect(names.find(({ id }) => id === "posts.schedule")).toEqual({
      id: "posts.schedule",
      method: "schedule",
      namespace: ["posts"],
    });
    // The health checks' ids name no group: their tag does.
    expect(names.find(({ id }) => id === "health")).toEqual({
      id: "health",
      method: "health",
      namespace: ["system"],
    });
  });

  it("keeps each namespace's last segment its own, as Rust names a client by it", async () => {
    const sdks = await read(path.join(root, "peal-sdk", "openapi.json"));

    const namespaces = new Set(
      namesOf(sdks).map(({ namespace }) => namespace.join("."))
    );

    const lasts = [...namespaces].map((name) => name.split(".").at(-1));

    expect(lasts.filter((last, at) => lasts.indexOf(last) !== at)).toEqual([]);
    expect(lasts).not.toContain("peal");
  });

  it("gives no method a sibling namespace's name", async () => {
    const sdks = await read(path.join(root, "peal-sdk", "openapi.json"));
    const names = namesOf(sdks);

    const namespaces = new Set(
      names.flatMap(({ namespace }) =>
        namespace.map((_, at) => namespace.slice(0, at + 1).join("."))
      )
    );

    expect(
      names
        .map(({ method, namespace }) => [...namespace, method].join("."))
        .filter((name) => namespaces.has(name))
    ).toEqual([]);
  });

  it("leaves out the groups only a person's own session calls", async () => {
    const sdks = await read(path.join(root, "peal-sdk", "openapi.json"));
    const ids = namesOf(sdks).map(({ id }) => id);

    for (const id of [
      "me.account.export",
      "me.connectedApps.list",
      "me.browserAnalytics.setConsent",
      "workspace.delete",
      "workspace.billingActions.order",
    ]) {
      expect(ids).not.toContain(id);
    }

    expect(ids).toContain("workspace.members.list");
    expect(ids).toContain("me.get");
  });
});

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
    // Optional everywhere: the script stops on one that requires it.
    expect(requiredHeadersOf(contract)).not.toContain("peal-workspace");
    expect(headersOf(sdks).flat()).not.toContain("peal-workspace");
    expect(sdks["x-fern-global-headers"]).toContainEqual({
      header: "Peal-Workspace",
      name: "workspace",
      optional: true,
    });
  });
});
