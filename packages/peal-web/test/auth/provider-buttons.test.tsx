import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "@effect/vitest";

import { needsPassword } from "#auth/password-state.ts";
import { SetPasswordView } from "#components/account/set-password.tsx";
import { ProviderButtonsView } from "#components/auth/provider-buttons.tsx";

import { ignore, render } from "../two-step/render.tsx";

// sha256 of Google's file, downloaded from
// https://developers.google.com/static/identity/images/branding_guideline_sample_lt_sq_sl.svg
// on 2026-11-16.
const googleAssetDigest =
  "4e5ead045e381e934bcfc37bbb36297fbb28060cc1023947909df392f14b271d";

describe("the sign-in providers' buttons", () => {
  it("show one outline button per provider, then the form's divider", async () => {
    const html = await render(
      "en",
      <ProviderButtonsView
        error={null}
        pending={false}
        providers={[
          { id: "google", name: "Google" },
          { id: "oidc", name: "Example Corp" },
        ]}
        onChoose={ignore}
      />
    );

    expect(html).toContain("Continue with Google");
    expect(html).toContain("Continue with Example Corp");
    expect(html.match(/<button/gu)).toHaveLength(2);
    expect(html).toContain(">or<");
  });

  it("show Google's own mark, and lucide's key for the other", async () => {
    const html = await render(
      "en",
      <ProviderButtonsView
        error={null}
        pending={false}
        providers={[
          { id: "google", name: "Google" },
          { id: "oidc", name: "Example Corp" },
        ]}
        onChoose={ignore}
      />
    );

    expect(html).toMatch(/<image href="[^"]+" width="40" height="40">/u);
    expect(html).toContain('viewBox="10 10 20 20"');
    expect(html).toContain("lucide-key-round");
  });

  it("show nothing on a server without providers", async () => {
    await expect(
      render(
        "en",
        <ProviderButtonsView
          error={null}
          pending={false}
          providers={[]}
          onChoose={ignore}
        />
      )
    ).resolves.toBe("");
  });

  it("speak French", async () => {
    const html = await render(
      "fr",
      <ProviderButtonsView
        error="PROVIDER_TWO_STEP_PASSWORD"
        pending={false}
        providers={[{ id: "google", name: "Google" }]}
        onChoose={ignore}
      />
    );

    expect(html).toContain("Continuer avec Google");
    expect(html).toContain(
      "Ce compte a la validation en deux étapes. Connectez-vous avec votre mot de passe et votre code."
    );
  });
});

describe("an account without a password", () => {
  it.each([
    [false, true],
    [true, false],
    [undefined, false],
  ])("hasPassword %s asks to set one: %s", (hasPassword, expected) => {
    expect(
      needsPassword(hasPassword === undefined ? {} : { hasPassword })
    ).toBe(expected);
  });

  it("offers the link, then says where it went", async () => {
    const offered = await render(
      "en",
      <SetPasswordView
        captcha={null}
        error={null}
        lead="Why"
        pending={false}
        ready
        sentTo={null}
        onSend={ignore}
      />
    );

    const sent = await render(
      "en",
      <SetPasswordView
        captcha={null}
        error={null}
        lead="Why"
        pending={false}
        ready
        sentTo="ada@example.test"
        onSend={ignore}
      />
    );

    expect(offered).toContain("Email me a link");
    expect(sent).toContain("We sent a link to ada@example.test");
    expect(sent).not.toContain("Email me a link");
  });
});

// Google's own asset, as its branding guidelines publish it: the icon-only
// light button (branding_guideline_sample_lt_sq_sl.svg), byte for byte.
const asset = () =>
  readFileSync(
    fileURLToPath(
      new URL("../../src/components/auth/google-g.svg", import.meta.url)
    )
  );

describe("Google's mark", () => {
  it("is Google's file, unedited", () => {
    expect(createHash("sha256").update(asset()).digest("hex")).toBe(
      googleAssetDigest
    );
  });

  it("draws with paths alone, which every browser renders", () => {
    expect(asset().toString("utf-8")).not.toContain("foreignObject");
  });
});
