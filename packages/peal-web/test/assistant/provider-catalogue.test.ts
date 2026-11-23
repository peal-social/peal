import { describe, expect, it } from "@effect/vitest";
import { AiProviderIdSchema, aiProviders } from "peal-contract/ai-providers";

import {
  capabilityOrder,
  connectable,
  defaultAddressOf,
  isAnotherProvider,
  modelsFor,
  offers,
  providerOrder,
  takesModel,
} from "#assistant/provider-catalogue.ts";

// The settings list every provider of the contract once, at an HTTPS
// address the server would take, with models to start from.
describe("the providers the settings offer", () => {
  it("lists every provider of the contract once, Anthropic first and another provider last", () => {
    expect(providerOrder.toSorted()).toStrictEqual(
      AiProviderIdSchema.literals.toSorted()
    );
    expect(providerOrder[0]).toBe("anthropic");
    expect(providerOrder.at(-1)).toBe("openai-compatible");
    expect(isAnotherProvider("openai-compatible")).toBeTruthy();
  });

  it("reaches each named provider on HTTPS, and offers a model for each use that takes one", () => {
    for (const provider of providerOrder.filter(
      (each) => !isAnotherProvider(each)
    )) {
      const address = defaultAddressOf(provider) ?? "";

      expect(new URL(address).protocol).toBe("https:");
      expect(address.endsWith("/")).toBeFalsy();

      for (const capability of capabilityOrder) {
        expect(modelsFor(provider, capability).length > 0).toBe(
          offers(provider, capability) && takesModel(capability)
        );
      }
    }

    expect(defaultAddressOf("openai-compatible")).toBeNull();
    expect(modelsFor("openai-compatible", "text")).toStrictEqual([]);
  });

  it("offers each use where the catalogue does: text everywhere but ElevenLabs, fal and Shotstack", () => {
    for (const provider of providerOrder) {
      expect(offers(provider, "text")).toBe(
        provider !== "elevenlabs" &&
          provider !== "fal" &&
          provider !== "shotstack"
      );
      expect(offers(provider, "image")).toBe(
        aiProviders[provider].image !== null
      );
      expect(offers(provider, "video")).toBe(
        aiProviders[provider].video !== null
      );
    }

    expect(providerOrder.filter((each) => offers(each, "video"))).toStrictEqual(
      ["google", "xai"]
    );
    expect(modelsFor("xai", "video").length).toBeGreaterThan(0);
    expect(
      providerOrder.filter((each) => offers(each, "transcription"))
    ).toStrictEqual([
      "openai",
      "google",
      "mistral",
      "xai",
      "groq",
      "elevenlabs",
      "fal",
    ]);
    expect(capabilityOrder).toStrictEqual([
      "text",
      "image",
      "video",
      "speech",
      "transcription",
      "composition",
    ]);
  });

  it("composes slide videos with Shotstack alone, which takes no model", () => {
    expect(
      providerOrder.filter((each) => offers(each, "composition"))
    ).toStrictEqual(["shotstack"]);
    expect(takesModel("composition")).toBeFalsy();
    expect(takesModel("video")).toBeTruthy();
    expect(modelsFor("shotstack", "composition")).toStrictEqual([]);
  });

  it("offers to connect only the providers not connected yet", () => {
    expect(connectable(["anthropic", "openai-compatible"])).not.toContain(
      "anthropic"
    );
    expect(connectable(providerOrder)).toStrictEqual([]);
  });
});
