import { describe, expect, it } from "bun:test";

import type { Schema } from "effect";

import { rubyUnionSource, unionDocument } from "./ruby-unions.ts";

/** A member's schema: an object whose `_tag` holds one value. */
const tagged = (tag: string, properties: Schema.JsonObject = {}) => ({
  properties: Object.fromEntries([
    ["_tag", { enum: [tag], type: "string" }],
    ...Object.entries(properties),
  ]),
  required: ["_tag"],
  type: "object",
});

const document = unionDocument({
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
  MediaTooLarge: tagged("mediaTooLarge"),
  MediaTooLargeEncoded: tagged("MediaTooLarge"),
  YouTubeOptions: {
    properties: { platform: { enum: ["youtube"], type: "string" } },
    type: "object",
  },
});

const union = (
  discriminant: string,
  members: readonly (readonly [string, string])[]
) => `# frozen_string_literal: true

module Peal
  module Types
    class Union < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :${discriminant}
${members.map(([className, key]) => `\n      member -> { Peal::Types::${className} }, key: "${key}"`).join("\n")}
    end
  end
end
`;

describe("the Ruby SDK's tagged unions", () => {
  it("reads the discriminant the API sends, and keys each member by its tag", () => {
    expect(
      rubyUnionSource(
        union("type", [
          ["CredentialUser", "USER"],
          ["CredentialAPIKey", "API_KEY"],
        ]),
        document
      )
    ).toBe(
      union("_tag", [
        ["CredentialUser", "user"],
        ["CredentialAPIKey", "apiKey"],
      ])
    );
  });

  it("keeps a discriminant the document does not rename", () => {
    expect(
      rubyUnionSource(
        union("platform", [
          ["YouTubeOptions", "YOUTUBE"],
          ["GoogleBusinessOptions", "GOOGLE_BUSINESS"],
        ]),
        document
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
      rubyUnionSource(
        union("type", [
          ["MediaTooLarge", "MEDIA_TOO_LARGE"],
          ["ForbiddenEncoded", "FORBIDDEN"],
        ]),
        document
      )
    ).toBe(
      union("_tag", [
        ["MediaTooLarge", "mediaTooLarge"],
        ["ForbiddenEncoded", "Forbidden"],
      ])
    );
    expect(
      rubyUnionSource(
        union("type", [["MediaTooLargeEncoded", "MEDIA_TOO_LARGE"]]),
        document
      )
    ).toBe(union("_tag", [["MediaTooLargeEncoded", "MediaTooLarge"]]));
  });

  it("leaves a file that is not a discriminated union as it was", () => {
    const model = `class Channel < Internal::Types::Model\n  field :id, -> { String }\nend\n`;

    const undiscriminated = union("type", [["CredentialUser", "USER"]]).replace(
      "      discriminant :type\n",
      ""
    );

    expect(rubyUnionSource(model, document)).toBe(model);
    expect(rubyUnionSource(undiscriminated, document)).toBe(undiscriminated);
  });

  it("stops on a member the document has no schema for", () => {
    expect(() =>
      rubyUnionSource(union("type", [["CredentialBot", "BOT"]]), document)
    ).toThrow("The Ruby class CredentialBot matches 0 schemas of the document");
  });

  it("stops on a key that is not its member's tag", () => {
    expect(() =>
      rubyUnionSource(union("type", [["CredentialUser", "ADMIN"]]), document)
    ).toThrow("keys CredentialUser, whose _tag is user");
  });

  it("stops on a member without the discriminant", () => {
    expect(() =>
      rubyUnionSource(union("kind", [["YouTubeOptions", "YOUTUBE"]]), document)
    ).toThrow(
      "The schema of YouTubeOptions has no property for the discriminant kind"
    );
  });

  it("stops on a member it cannot read", () => {
    expect(() =>
      rubyUnionSource(
        union("type", [["CredentialUser", "USER"]]).replace(
          "Peal::Types::CredentialUser }",
          "Internal::Types::Hash[String, Object] }"
        ),
        document
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
