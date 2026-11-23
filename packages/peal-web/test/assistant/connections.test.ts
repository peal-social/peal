import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { AiProviderAddressRefused, TextProviderRefused } from "peal-contract";
import type { AiCapabilityModel, AiProviderConnection } from "peal-contract";

import {
  changeOf,
  connectionErrorKey,
  draftOf,
  isOwnAddress,
  isSandboxAddress,
  isSavable,
  keyNeeded,
  providerChosen,
  sandboxAddressOf,
  sandboxChosen,
  testFailureKey,
  testModelOf,
} from "#assistant/connections.ts";
import {
  modelErrorKey,
  providerChoicesFor,
  startingModelOf,
} from "#assistant/models.ts";

const at = DateTime.makeUnsafe("2026-11-22T09:00:00Z");

const anthropic: AiProviderConnection = {
  baseUrl: "https://api.anthropic.com",
  keySet: true,
  keyUnreadable: false,
  provider: "anthropic",
  updatedAt: at,
};

const compatible: AiProviderConnection = {
  baseUrl: "https://ai.example.com/v1",
  keySet: true,
  keyUnreadable: false,
  provider: "openai-compatible",
  updatedAt: at,
};

const chosen = (
  capability: "image" | "text",
  provider: AiCapabilityModel["provider"],
  model: string | null
): AiCapabilityModel => ({
  capability,
  model,
  provider,
  serverModel: true,
  updatedAt: provider === null ? null : at,
});

describe("a provider's form", () => {
  it("starts at the provider's own address, and sends it only when another is typed", () => {
    const draft = draftOf(null, "openai");

    expect(draft.baseUrl).toBe("https://api.openai.com/v1");
    expect(changeOf({ ...draft, apiKey: " sk-synthetic " })).toStrictEqual({
      apiKey: "sk-synthetic",
    });
    expect(
      changeOf({ ...draft, baseUrl: "https://proxy.example.com/v1" })
    ).toStrictEqual({ baseUrl: "https://proxy.example.com/v1" });
    expect(isOwnAddress("openai", "https://api.openai.com/v1/")).toBeTruthy();
  });

  it("fills in another provider's address when one is picked, and leaves another provider's to type", () => {
    expect(providerChosen(draftOf(null, "openai"), "mistral").baseUrl).toBe(
      "https://api.mistral.ai/v1"
    );
    expect(
      providerChosen(draftOf(null, "openai"), "openai-compatible").baseUrl
    ).toBe("");
    expect(isSavable(draftOf(null, "openai-compatible"), null)).toBeFalsy();
  });

  it("keeps the saved key for the same address only", () => {
    const draft = draftOf(anthropic, "anthropic");

    expect(keyNeeded(draft, anthropic)).toBeNull();
    expect(isSavable(draft, anthropic)).toBeTruthy();
    expect(
      keyNeeded({ ...draft, baseUrl: "https://proxy.example.com" }, anthropic)
    ).toBe("keyAgain");
    expect(keyNeeded(draft, { ...anthropic, keyUnreadable: true })).toBe(
      "keyUnreadable"
    );
    expect(keyNeeded(draft, null)).toBe("noKey");
  });

  it("tests with the text's model, else the catalogue's, and not another provider without one", () => {
    expect(testModelOf("anthropic", [])).toBe("claude-sonnet-5-5");
    expect(
      testModelOf("anthropic", [
        chosen("text", "anthropic", "claude-haiku-5-5"),
      ])
    ).toBe("claude-haiku-5-5");
    expect(testModelOf("openai-compatible", [])).toBeNull();
    expect(
      testModelOf("openai-compatible", [
        chosen("text", "openai-compatible", "synthetic-model"),
      ])
    ).toBe("synthetic-model");
  });

  it("says why a save or a test failed", () => {
    expect(
      connectionErrorKey(new AiProviderAddressRefused({ reason: "notPublic" }))
    ).toBe("notPublic");
    expect(connectionErrorKey({ _tag: "Unexpected" })).toBe("generic");
    expect(
      testFailureKey(
        new TextProviderRefused({ reason: "settingsRefused", status: 401 })
      )
    ).toBe("providerRefused");
  });
});

describe("a use's choice", () => {
  it("offers the connected providers that offer the use", () => {
    expect(providerChoicesFor("text", [compatible, anthropic])).toStrictEqual([
      "anthropic",
      "openai-compatible",
    ]);
    expect(providerChoicesFor("image", [compatible, anthropic])).toStrictEqual([
      "openai-compatible",
    ]);
  });

  it("starts with the model it had there, else the catalogue's first, else none", () => {
    expect(
      startingModelOf("anthropic", "text", {
        model: "claude-haiku-5-5",
        provider: "anthropic",
      })
    ).toBe("claude-haiku-5-5");
    expect(
      startingModelOf("openai", "image", { model: null, provider: null })
    ).toBe("gpt-image-2.6-flare");
    expect(
      startingModelOf("openai-compatible", "text", {
        model: null,
        provider: null,
      })
    ).toBeNull();
  });

  it("says why a choice failed", () => {
    expect(modelErrorKey({ _tag: "Unexpected" })).toBe("generic");
  });
});

describe("Shotstack's sandbox", () => {
  it("starts at production, and sends the sandbox's address only when chosen", () => {
    const fresh = draftOf(null, "shotstack");

    expect(fresh.baseUrl).toBe("https://api.shotstack.io/edit/v1");
    expect(sandboxAddressOf("shotstack")).toBe(
      "https://api.shotstack.io/edit/stage"
    );
    expect(sandboxAddressOf("anthropic")).toBeNull();
    expect(
      changeOf({ ...fresh, apiKey: "synthetic-shotstack-key" })
    ).toStrictEqual({ apiKey: "synthetic-shotstack-key" });
  });

  it("sends the sandbox's address once chosen, and production's never", () => {
    const sandbox = sandboxChosen(draftOf(null, "shotstack"), true);

    expect(isSandboxAddress("shotstack", sandbox.baseUrl)).toBeTruthy();
    expect(changeOf(sandbox)).toStrictEqual({
      baseUrl: "https://api.shotstack.io/edit/stage",
    });
    expect(sandboxChosen(sandbox, false).baseUrl).toBe(
      "https://api.shotstack.io/edit/v1"
    );
  });

  it("knows no model to test Shotstack with, which writes no text", () => {
    expect(testModelOf("shotstack", [])).toBeNull();
  });
});
