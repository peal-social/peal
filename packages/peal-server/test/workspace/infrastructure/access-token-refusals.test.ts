import { describe, expect, it } from "@effect/vitest";

import {
  invalidTokenReasons,
  invalidTokenRefusal,
  invalidTokenTexts,
} from "#workspace/infrastructure/auth/access-tokens.ts";

// Better Auth's challenge builder answers a 401 with `invalid_token` whose
// description names DPoP with a `DPoP` challenge, which carries no
// `resource_metadata`: a client told so could no longer find where to sign
// in. Every refusal of a credential that was sent keeps the Bearer
// challenge that names the resource's metadata.

const resource = "https://peal.example/api/mcp";

describe(invalidTokenRefusal, () => {
  it.each(invalidTokenReasons)(
    "answers %s with a Bearer challenge that names the resource's metadata",
    (reason) => {
      const refusal = invalidTokenRefusal(reason, resource);

      expect(refusal._tag).toBe("InvalidAccessToken");

      const challenge =
        refusal._tag === "InvalidAccessToken" ? refusal.challenge : "";

      expect(challenge).toMatch(/^Bearer /u);
      expect(challenge).toContain('error="invalid_token"');
      expect(challenge).toContain(
        'resource_metadata="https://peal.example/.well-known/oauth-protected-resource/api/mcp"'
      );
    }
  );

  it("never names DPoP in the words of a credential that was refused", () => {
    for (const reason of invalidTokenReasons) {
      expect(invalidTokenTexts[reason]).not.toContain("DPoP");
    }
  });
});
