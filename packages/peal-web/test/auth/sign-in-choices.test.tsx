import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "@effect/vitest";

import { lastSignInOf, methodsOf } from "#auth/last-sign-in.ts";
import { needsPassword } from "#auth/password-state.ts";
import { SetPasswordView } from "#components/account/set-password.tsx";
import { googleMarkPaths } from "#components/auth/google-mark.tsx";
import { SignInChoicesView } from "#components/auth/sign-in-choices.tsx";
import { SignUpTerms } from "#components/auth/sign-up-terms.tsx";

import { ignore, render } from "../two-step/render.tsx";

// sha256 of Google's file, downloaded from
// https://developers.google.com/static/identity/images/branding_guideline_sample_lt_sq_sl.svg
// on 2026-11-16.
const googleAssetDigest =
  "4e5ead045e381e934bcfc37bbb36297fbb28060cc1023947909df392f14b271d";

const providers = [
  { id: "google", name: "Google" },
  { id: "oidc", name: "Example Corp" },
] as const;

const choices = (last: "email" | "google" | "oidc" | null) => (
  <SignInChoicesView
    error={null}
    last={last}
    pending={false}
    providers={providers}
    onChoose={ignore}
    onEmail={ignore}
  />
);

describe("the ways to sign in", () => {
  it("offer each provider, then email, the first as the main action", async () => {
    const html = await render("en", choices(null));

    expect(html.match(/<button/gu)).toHaveLength(3);
    expect(html.indexOf("Continue with Google")).toBeLessThan(
      html.indexOf("Continue with Example Corp")
    );
    expect(html.indexOf("Continue with Example Corp")).toBeLessThan(
      html.indexOf("Continue with email")
    );
    expect(html).not.toContain("last time");
  });

  it("put the way used last first, saying so", async () => {
    const html = await render("en", choices("email"));

    expect(html.indexOf("Continue with email")).toBeLessThan(
      html.indexOf("Continue with Google")
    );
    expect(html).toContain("You used email to sign in last time");
  });

  it("name a provider used last by its name", async () => {
    const html = await render("en", choices("oidc"));

    expect(html).toContain("You used Example Corp to sign in last time");
  });

  it("show Google's own mark, and lucide's key for the other", async () => {
    const html = await render("en", choices(null));

    expect(html).toContain('viewBox="10 10 20 20"');
    expect(html.match(/<path d="M/gu)?.length).toBeGreaterThanOrEqual(4);
    expect(html).not.toContain("<image");
    expect(html).toContain("lucide-key-round");
  });

  it("speak French", async () => {
    const html = await render(
      "fr",
      <SignInChoicesView
        error="PROVIDER_TWO_STEP_PASSWORD"
        last="google"
        pending={false}
        providers={[{ id: "google", name: "Google" }]}
        onChoose={ignore}
        onEmail={ignore}
      />
    );

    expect(html).toContain("Continuer avec Google");
    expect(html).toContain("Continuer avec l’e-mail");
    expect(html).toContain(
      "Vous avez utilisé Google lors de votre dernière connexion"
    );
    expect(html).toContain(
      "Ce compte a la validation en deux étapes. Connectez-vous avec votre mot de passe et votre code."
    );
  });
});

describe(methodsOf, () => {
  it("leaves out a way the server no longer offers", () => {
    expect(methodsOf([], "google")).toStrictEqual(["email"]);
  });

  it("reads only a way it knows from the cookie", () => {
    expect(lastSignInOf("google")).toBe("google");
    expect(lastSignInOf("passkey")).toBeNull();
    expect(lastSignInOf(undefined)).toBeNull();
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

  it("draws the file's G, path for path and colour for colour", () => {
    const fromFile = [
      ...asset()
        .toString("utf-8")
        .matchAll(/<path d="(?<d>[^"]+)" fill="(?<fill>[^"]+)"\/>/gu),
    ].map(({ groups }) => ({ d: groups?.["d"], fill: groups?.["fill"] }));

    expect(googleMarkPaths).toStrictEqual(fromFile);
  });
});

const terms = "https://peal.example.test/terms";
const privacy = "https://peal.example.test/privacy";
const dpa = "https://peal.example.test/dpa";

const textOf = (html: string) => html.replaceAll(/<[^>]+>/gu, "");

describe("the sign-up's terms line", () => {
  it.each([
    [null, null, "By signing up, you agree to the terms of service."],
    [
      privacy,
      null,
      "By signing up, you agree to the terms of service and the privacy policy.",
    ],
    [
      null,
      dpa,
      "By signing up, you agree to the terms of service and the data processing agreement.",
    ],
    [
      privacy,
      dpa,
      "By signing up, you agree to the terms of service, the privacy policy and the data processing agreement.",
    ],
  ])(
    "names the documents the server links (%s, %s)",
    async (privacyUrl, dpaUrl, sentence) => {
      const html = await render(
        "en",
        <SignUpTerms termsUrl={terms} privacyUrl={privacyUrl} dpaUrl={dpaUrl} />
      );

      expect(textOf(html)).toBe(sentence);
      expect(html).toContain(`href="${terms}"`);
    }
  );

  it("speaks French", async () => {
    const html = await render(
      "fr",
      <SignUpTerms termsUrl={null} privacyUrl={privacy} dpaUrl={dpa} />
    );

    expect(textOf(html)).toBe(
      "En vous inscrivant, vous acceptez les conditions d’utilisation, la politique de confidentialité et l’accord de traitement des données."
    );
    expect(html).toContain(`href="${dpa}"`);
  });
});
