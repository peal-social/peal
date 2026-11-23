import { describe, expect, it } from "@effect/vitest";

import { providerStatusOf } from "#assistant/infrastructure/ai-sdk/provider-status.ts";

// A wrong key reads as settings to fix, whichever status the provider
// answers it with; any other refusal keeps its status.
describe(providerStatusOf, () => {
  it("reads a 400 that names the key as a 401", () => {
    expect(
      providerStatusOf(
        400,
        '{"code":"invalid-argument","error":"Incorrect API key provided."}'
      )
    ).toBe(401);
    expect(
      providerStatusOf(400, '{"error":{"message":"API key not valid."}}')
    ).toBe(401);
  });

  it("keeps a 400 about the request itself", () => {
    expect(
      providerStatusOf(400, '{"error":"The prompt was refused by policy."}')
    ).toBe(400);
    expect(providerStatusOf(400, undefined)).toBe(400);
  });

  it("keeps every other status", () => {
    expect(providerStatusOf(401, "Incorrect API key provided.")).toBe(401);
    expect(providerStatusOf(422, "api key")).toBe(422);
  });
});
