// The app's own requests to Peal's API name the web app's measured session
// only while the measurement names one, and nothing otherwise.
import { describe, expect, it } from "@effect/vitest";
import { HttpClientRequest } from "effect/http";

import { addressedFrom } from "#api/client.ts";
import { nameSessionWith } from "#measurement/session-header.ts";

const address = addressedFrom("http://localhost:3001");

const sessionId = "019a7b2c-0000-7000-8000-000000000003";

describe(addressedFrom, () => {
  it("names no session while the measurement names none", () => {
    const request = address(HttpClientRequest.get("/api/me"));

    expect(request.url).toBe("http://localhost:3001/api/me");
    expect(request.headers).not.toHaveProperty("x-posthog-session-id");
  });

  it("names the session the measurement names, and none once it stops", () => {
    const stop = nameSessionWith(() => sessionId);

    expect(
      address(HttpClientRequest.get("/api/me")).headers["x-posthog-session-id"]
    ).toBe(sessionId);

    stop();

    expect(
      address(HttpClientRequest.get("/api/me")).headers
    ).not.toHaveProperty("x-posthog-session-id");
  });

  it("names no session the measurement gives as empty", () => {
    const stop = nameSessionWith(() => "");

    expect(
      address(HttpClientRequest.get("/api/me")).headers
    ).not.toHaveProperty("x-posthog-session-id");

    stop();
  });
});
