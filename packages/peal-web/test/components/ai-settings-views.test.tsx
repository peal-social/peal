import { describe, expect, it } from "@effect/vitest";
import { DateTime } from "effect";
import { NextIntlClientProvider } from "next-intl";
import type { AiProviderConnection } from "peal-contract";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { draftOf } from "#assistant/connections.ts";
import type { ConnectionDraft } from "#assistant/connections.ts";
import {
  ConnectionFormView,
  ConnectionRowView,
} from "#components/assistant/connection-views.tsx";
import type { TestState } from "#components/assistant/connection-views.tsx";
import { ModelRowView } from "#components/assistant/model-row-views.tsx";
import type { ModelChoice } from "#components/assistant/model-row-views.tsx";
import { loadMessages } from "#i18n/messages.ts";

const at = DateTime.makeUnsafe("2026-11-22T09:00:00Z");

const anthropic: AiProviderConnection = {
  baseUrl: "https://api.anthropic.com",
  keySet: true,
  keyUnreadable: false,
  provider: "anthropic",
  updatedAt: at,
};

const shotstack: AiProviderConnection = {
  baseUrl: "https://api.shotstack.io/edit/stage",
  keySet: true,
  keyUnreadable: false,
  provider: "shotstack",
  updatedAt: at,
};

const ignore = () => {
  // A view under test changes nothing.
};

const ignoreModel = async () => await Promise.resolve(false);

const inLocale = async (locale: "en" | "fr", children: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider
      locale={locale}
      messages={await loadMessages(locale)}
      timeZone="UTC"
    >
      {children}
    </NextIntlClientProvider>
  );

const form = async ({
  draft,
  locale = "en",
  options = null,
  saved,
  test = { _tag: "idle" },
  testable = true,
}: {
  readonly draft?: ConnectionDraft;
  readonly locale?: "en" | "fr";
  readonly options?: readonly AiProviderConnection["provider"][] | null;
  readonly saved: AiProviderConnection | null;
  readonly test?: TestState;
  readonly testable?: boolean;
}) =>
  await inLocale(
    locale,
    <ConnectionFormView
      draft={draft ?? draftOf(saved, saved?.provider ?? "anthropic")}
      error={null}
      options={options}
      removing={false}
      saved={saved}
      saving={false}
      test={test}
      testable={testable}
      testing={false}
      onChange={ignore}
      onRemove={ignore}
      onSave={ignore}
      onTest={ignore}
    />
  );

const row = async (
  choice: ModelChoice,
  serverModel: boolean,
  providers = ["anthropic" as const]
) =>
  await inLocale(
    "en",
    <ModelRowView
      busy={false}
      capability="text"
      chosen={choice}
      providers={providers}
      serverModel={serverModel}
      onModel={ignoreModel}
      onProvider={ignore}
    />
  );

describe("the providers section", () => {
  it("names a connected provider and says its key is saved", async () => {
    const own = await inLocale(
      "en",
      <ConnectionRowView connection={anthropic}>
        <form aria-label="The provider's form" />
      </ConnectionRowView>
    );

    expect(own).toContain("Anthropic");
    expect(own).toContain("Key saved");
    expect(own).toContain("At its own address.");
    expect(own).toContain(">Edit<");
    // The form waits in the dialog until Edit opens it.
    expect(own).not.toContain("The provider&#x27;s form");
  });

  it("says where a provider is reached when not at its own address, and a key it cannot read", async () => {
    const proxied = await inLocale(
      "fr",
      <ConnectionRowView
        connection={{
          ...anthropic,
          baseUrl: "https://proxy.example.com",
          keyUnreadable: true,
        }}
      >
        {null}
      </ConnectionRowView>
    );

    expect(proxied).toContain("À proxy.example.com.");
    expect(proxied).toContain("Clé illisible");
  });

  it("asks for the provider and the key of a new one, its address under Advanced", async () => {
    const html = await form({ options: ["anthropic", "openai"], saved: null });

    expect(html).toContain("Provider");
    expect(html).toContain("Key");
    expect(html).toContain("Advanced");
    expect(html).not.toContain(">Remove<");
    expect(html).not.toContain(">Test<");
  });

  it("asks another provider for its address up front", async () => {
    const html = await form({
      draft: draftOf(null, "openai-compatible"),
      options: ["openai-compatible"],
      saved: null,
    });

    expect(html).toContain("/chat/completions and /images/generations");
    expect(html).not.toContain("Advanced");
  });

  it("offers Test and Remove for a saved one, never its key, and says how the test went", async () => {
    const html = await form({ saved: anthropic, test: { _tag: "passed" } });

    expect(html).toContain(">Test<");
    expect(html).toContain(">Remove<");
    expect(html).toContain("A key is saved");
    expect(html).toContain("The provider answered");
  });

  it("offers no Test where Peal knows no model, and says why a test failed", async () => {
    const untestable = await form({ saved: anthropic, testable: false });

    expect(untestable).not.toContain(">Test<");

    const failed = await form({
      locale: "fr",
      saved: anthropic,
      test: { _tag: "failed", key: "providerRefused" },
    });

    expect(failed).toContain("Votre fournisseur a refusé ses réglages");
  });
});

describe("the models section", () => {
  it("offers the server's model while none is chosen, where the server has one", async () => {
    const html = await row({ model: null, provider: null }, true);

    expect(html).toContain("Text");
    expect(html).toContain("This server&#x27;s model");
    expect(html).not.toContain("Model for Text");
  });

  it("says off where the server has no model, and to connect a provider when none offers the use", async () => {
    const html = await row({ model: null, provider: null }, false, []);

    expect(html).toContain("Off");
    expect(html).toContain("Connect a provider above that offers it.");
  });

  it("shows a suggested model in its select", async () => {
    const suggested = await row(
      { model: "claude-sonnet-5-5", provider: "anthropic" },
      true
    );

    expect(suggested).toContain("Anthropic");
    expect(suggested).toContain("claude-sonnet-5-5");
    expect(suggested).not.toContain("Model name for Text");
  });

  it("shows a model the catalogue does not suggest in its field", async () => {
    const typed = await row(
      { model: "synthetic-model", provider: "anthropic" },
      true
    );

    expect(typed).toContain("Another model…");
    expect(typed).toContain("Model name for Text");
    expect(typed).toContain("synthetic-model");
  });

  it("has a row for videos, on a provider that makes them, never the server's", async () => {
    const video = await inLocale(
      "fr",
      <ModelRowView
        busy={false}
        capability="video"
        chosen={{ model: "grok-imagine-video-1.5", provider: "xai" }}
        providers={["google", "xai"]}
        serverModel={false}
        onModel={ignoreModel}
        onProvider={ignore}
      />
    );

    expect(video).toContain("Vidéo");
    expect(video).toContain("Crée des vidéos dans la médiathèque");
    expect(video).toContain("xAI");
    expect(video).toContain("grok-imagine-video-1.5");
    expect(video).not.toContain("Le modèle de ce serveur");
  });

  it("has a row for slide videos, its provider alone, never a model", async () => {
    const slides = await inLocale(
      "en",
      <ModelRowView
        busy={false}
        capability="composition"
        chosen={{ model: "edit", provider: "shotstack" }}
        providers={["shotstack"]}
        serverModel={false}
        onModel={ignoreModel}
        onProvider={ignore}
      />
    );

    expect(slides).toContain("Slide videos");
    expect(slides).toContain("Shotstack");
    expect(slides).not.toContain("Another model");
    expect(slides).not.toContain("edit");
  });

  it("offers Shotstack's production first, its sandbox under Advanced, not an address", async () => {
    const fresh = await form({
      draft: draftOf(null, "shotstack"),
      options: ["shotstack"],
      saved: null,
      testable: false,
    });

    expect(fresh).toContain("Advanced");
    expect(fresh).toContain("Production");
    expect(fresh).toContain("credits");
    expect(fresh).not.toContain('name="baseUrl"');
  });

  it("names Shotstack's sandbox, and offers it no Test", async () => {
    const sandbox = await form({ saved: shotstack, testable: false });

    expect(sandbox).toContain("Sandbox (watermarked)");
    expect(sandbox).not.toContain(">Test<");

    const listed = await inLocale(
      "fr",
      <ConnectionRowView connection={shotstack}>{null}</ConnectionRowView>
    );

    expect(listed).toContain("bac à sable");
  });
});
