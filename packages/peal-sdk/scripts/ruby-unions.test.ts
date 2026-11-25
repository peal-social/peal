import { describe, expect, it } from "bun:test";

import type { Schema } from "effect";

import {
  rubyString,
  rubyUnion,
  unionBodyOperations,
  unionDocument,
} from "./ruby-unions.ts";

/** A member's schema: an object whose `_tag` holds one value. */
const tagged = (tag: string, properties: Schema.JsonObject = {}) => ({
  properties: Object.fromEntries([
    ["_tag", { enum: [tag], type: "string" }],
    ...Object.entries(properties),
  ]),
  required: ["_tag"],
  type: "object",
});

const schemas = {
  Credential: {
    discriminator: {
      mapping: {
        apiKey: "#/components/schemas/CredentialApiKey",
        user: "#/components/schemas/CredentialUser",
      },
      propertyName: "_tag",
      "x-fern-property-name": "type",
    },
    oneOf: [
      { $ref: "#/components/schemas/CredentialUser" },
      { $ref: "#/components/schemas/CredentialApiKey" },
    ],
  },
  CredentialApiKey: tagged("apiKey", { name: { type: "string" } }),
  CredentialUser: tagged("user"),
  ForbiddenEncoded: tagged("Forbidden"),
  GoogleBusinessOptions: {
    properties: { platform: { enum: ["googleBusiness"], type: "string" } },
    type: "object",
  },
  Interpolated: tagged("say#{hi}"),
  MediaTooLarge: tagged("mediaTooLarge"),
  MediaTooLargeEncoded: tagged("MediaTooLarge"),
  Redelivery: {
    anyOf: [
      { $ref: "#/components/schemas/RedeliveryByIds" },
      { properties: { since: { type: "string" } }, type: "object" },
    ],
  },
  RedeliveryByIds: {
    properties: { deliveryIds: { items: { type: "string" }, type: "array" } },
    type: "object",
  },
  Scalar: { anyOf: [{ type: "number" }, { type: "string" }] },
  YouTubeOptions: {
    properties: { platform: { enum: ["youtube"], type: "string" } },
    type: "object",
  },
};

const document = unionDocument(schemas);

const file = (
  header: string,
  members: readonly string[]
) => `# frozen_string_literal: true

module Peal
  module Types
    class Union < Internal::Types::Model
      extend Peal::Internal::Types::Union
${header}${members.map((member) => `\n      member -> { ${member}`).join("\n")}
    end
  end
end
`;

const union = (
  discriminant: string,
  members: readonly (readonly [string, string])[]
) =>
  file(
    `\n      discriminant :${discriminant}\n`,
    members.map(
      ([className, key]) =>
        `Peal::Types::${className} }, key: ${key.startsWith("'") ? key : `"${key}"`}`
    )
  );

const rewritten = (source: string) => rubyUnion(source, document).source;

describe("the Ruby SDK's tagged unions", () => {
  it("reads the discriminant the API sends, and keys each member by its tag", () => {
    expect(
      rubyUnion(
        union("type", [
          ["CredentialUser", "USER"],
          ["CredentialAPIKey", "API_KEY"],
        ]),
        document
      )
    ).toEqual({
      modelUnion: "Union",
      source: union("_tag", [
        ["CredentialUser", "user"],
        ["CredentialAPIKey", "apiKey"],
      ]),
    });
  });

  it("keeps a discriminant the document does not rename", () => {
    expect(
      rewritten(
        union("platform", [
          ["YouTubeOptions", "YOUTUBE"],
          ["GoogleBusinessOptions", "GOOGLE_BUSINESS"],
        ])
      )
    ).toBe(
      union("platform", [
        ["YouTubeOptions", "youtube"],
        ["GoogleBusinessOptions", "googleBusiness"],
      ])
    );
  });

  it("tells apart tags that differ by their case alone, by their member", () => {
    expect(
      rewritten(
        union("type", [
          ["MediaTooLarge", "MEDIA_TOO_LARGE"],
          ["ForbiddenEncoded", "FORBIDDEN"],
        ])
      )
    ).toBe(
      union("_tag", [
        ["MediaTooLarge", "mediaTooLarge"],
        ["ForbiddenEncoded", "Forbidden"],
      ])
    );
    expect(
      rewritten(union("type", [["MediaTooLargeEncoded", "MEDIA_TOO_LARGE"]]))
    ).toBe(union("_tag", [["MediaTooLargeEncoded", "MediaTooLarge"]]));
  });

  it("writes a tag that Ruby would interpolate in single quotes", () => {
    expect(rewritten(union("type", [["Interpolated", "SAY_HI"]]))).toBe(
      union("_tag", [["Interpolated", "'say#{hi}'"]])
    );
  });

  it("leaves a model as it was", () => {
    const model = `class Channel < Internal::Types::Model\n  field :id, -> { String }\nend\n`;

    expect(rubyUnion(model, document)).toEqual({
      modelUnion: undefined,
      source: model,
    });
  });

  it("leaves an undiscriminated union as it was, and names it when its members are models", () => {
    const models = file("", [
      "Peal::Types::WebhookRedeliveryByIDs }",
      "Peal::Types::WebhookRedeliveryOfFailed }",
    ]);

    const scalars = file("", [
      "Internal::Types::Boolean }",
      "Float }",
      "Peal::Types::NonFiniteNumber }",
    ]);

    expect(rubyUnion(models, document)).toEqual({
      modelUnion: "Union",
      source: models,
    });
    expect(rubyUnion(scalars, document)).toEqual({
      modelUnion: undefined,
      source: scalars,
    });
  });

  it("stops on a discriminant written in another form", () => {
    const source = union("type", [["CredentialUser", "USER"]]);

    for (const form of ['discriminant "type"', "discriminant(:type)"]) {
      expect(() =>
        rewritten(source.replace("discriminant :type", form))
      ).toThrow("has a discriminant this script cannot read");
    }
  });

  it("stops on an extend line written in another form", () => {
    expect(() =>
      rewritten(
        union("type", [["CredentialUser", "USER"]]).replace(
          "extend Peal::Internal::Types::Union",
          "extend Peal::Internal::Types::Union # tagged"
        )
      )
    ).toThrow("is not in the form this script reads");
  });

  it("stops on keyed members without a discriminant", () => {
    expect(() =>
      rewritten(
        union("type", [["CredentialUser", "USER"]]).replace(
          "      discriminant :type\n",
          ""
        )
      )
    ).toThrow("has no discriminant and a member this script cannot read");
  });

  it("stops on a member the document has no schema for", () => {
    expect(() => rewritten(union("type", [["CredentialBot", "BOT"]]))).toThrow(
      "The Ruby class CredentialBot matches 0 schemas of the document"
    );
  });

  it("stops on a key that is not its member's tag", () => {
    expect(() =>
      rewritten(union("type", [["CredentialUser", "ADMIN"]]))
    ).toThrow("keys CredentialUser, whose _tag is user");
  });

  it("stops on a member without the discriminant", () => {
    expect(() =>
      rewritten(union("kind", [["YouTubeOptions", "YOUTUBE"]]))
    ).toThrow(
      "The schema of YouTubeOptions has no property for the discriminant kind"
    );
  });

  it("stops on a member it cannot read", () => {
    expect(() =>
      rewritten(
        union("type", [["CredentialUser", "USER"]]).replace(
          "Peal::Types::CredentialUser }",
          "Internal::Types::Hash[String, Object] }"
        )
      )
    ).toThrow("has members this script cannot read");
  });

  it("refuses a document that gives one name to two properties", () => {
    expect(() =>
      unionDocument({
        Left: {
          discriminator: {
            propertyName: "_tag",
            "x-fern-property-name": "type",
          },
        },
        Right: {
          discriminator: {
            propertyName: "kind",
            "x-fern-property-name": "type",
          },
        },
      })
    ).toThrow("The document names both _tag and kind type");
  });
});

describe("Ruby strings", () => {
  it("quotes plain text as the generator does", () => {
    expect(rubyString("apiKey")).toBe('"apiKey"');
  });

  it("quotes anything else so that nothing interpolates", () => {
    expect(rubyString("a#{b}")).toBe("'a#{b}'");
    expect(rubyString("#$x #@y")).toBe("'#$x #@y'");
    expect(rubyString("it's \\")).toBe("'it\\'s \\\\'");
  });
});

/** An operation that takes this JSON body. */
const body = (schema: Schema.Json, operationId: string) => ({
  operationId,
  requestBody: { content: { "application/json": { schema } } },
});

describe("the operations whose body is a union", () => {
  it("lists those whose JSON body is a union of objects", () => {
    expect(
      unionBodyOperations(
        {
          "/credential": { get: { operationId: "credential.get" } },
          "/redeliver": {
            parameters: [],
            post: body(
              { $ref: "#/components/schemas/Redelivery" },
              "webhooks.redeliverMany"
            ),
          },
          "/scalar": {
            put: body({ $ref: "#/components/schemas/Scalar" }, "scalar.set"),
          },
          "/user": {
            post: body(
              { $ref: "#/components/schemas/CredentialUser" },
              "users.create"
            ),
          },
          "/who": {
            post: body({ $ref: "#/components/schemas/Credential" }, "who.ask"),
          },
        },
        schemas
      )
    ).toEqual(["webhooks.redeliverMany", "who.ask"]);
  });
});
