import { assert, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpServer } from "effect/http";
import { HttpApiTest } from "effect/http-api";
import { Api, forWorkspace } from "peal-contract";
import type { Member } from "peal-contract";

import { AssistantApiLive } from "#assistant/container.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import {
  assistantTest,
  DatabaseTest,
  FakeOwnWritingModel,
  freshWorkspace,
} from "#test/assistant/support.ts";
import { memberOf } from "#test/channels/support.ts";
import { securityTest } from "#workspace/api/security.ts";
import { permissionsFor } from "#workspace/domain/roles.ts";

// The workspace's connected providers and its model for each use, on
// their real use cases, Postgres, the synthetic keyring and the real
// outbound guard on a static resolver (`providerHosts`), with a fake
// provider behind them that no request leaves; and the deprecated text
// and image provider endpoints, read on them.

const syntheticKey = "synthetic-workspace-provider-key";

const clientAs = (member: Member) =>
  HttpApiTest.groups(Api, ["assistant"]).pipe(
    Effect.provide(
      Layer.mergeAll(
        AssistantApiLive.pipe(Layer.provideMerge(securityTest(member))),
        HttpServer.layerServices
      )
    )
  );

const as = (workspaceId: WorkspaceId, role: string) =>
  clientAs(memberOf(workspaceId, permissionsFor(role)));

const refusalOf = <A, E extends { readonly _tag: string }>(
  effect: Effect.Effect<A, E>
) => effect.pipe(Effect.flip);

layer(DatabaseTest, { timeout: "60 seconds" })(
  "the workspace's providers and models endpoints",
  (it) => {
    it.effect("lets owners and admins change them, and nobody else", () =>
      Effect.gen(function* roles() {
        const workspaceId = yield* freshWorkspace;
        const headers = forWorkspace(workspaceId);
        const openai = { provider: "openai" as const };
        const text = { capability: "text" as const };

        for (const role of ["editor", "contributor", "viewer"]) {
          const client = yield* as(workspaceId, role);

          const refusals = yield* Effect.all([
            refusalOf(client.assistant.providers({ headers })),
            refusalOf(
              client.assistant.connectProvider({
                headers,
                params: openai,
                payload: { apiKey: syntheticKey },
              })
            ),
            refusalOf(
              client.assistant.disconnectProvider({ headers, params: openai })
            ),
            refusalOf(
              client.assistant.testProvider({
                headers,
                params: openai,
                payload: {},
              })
            ),
            refusalOf(client.assistant.models({ headers })),
            refusalOf(
              client.assistant.setModel({
                headers,
                params: text,
                payload: { model: "gpt-6.2-sol", provider: "openai" },
              })
            ),
            refusalOf(client.assistant.unsetModel({ headers, params: text })),
          ]);

          assert.deepStrictEqual(
            refusals.map((refusal) => refusal._tag),
            Array.from({ length: 7 }, () => "Forbidden")
          );
        }
      }).pipe(Effect.provide(assistantTest()))
    );

    it.effect(
      "connects a provider at its own address, keeps its key for that address only, and never answers it",
      () =>
        Effect.gen(function* connects() {
          const workspaceId = yield* freshWorkspace;
          const headers = forWorkspace(workspaceId);
          const admin = yield* as(workspaceId, "admin");
          const openai = { provider: "openai" as const };

          assert.strictEqual(
            (yield* refusalOf(
              admin.assistant.connectProvider({
                headers,
                params: openai,
                payload: {},
              })
            ))._tag,
            "AiProviderKeyRequired"
          );

          const saved = yield* admin.assistant.connectProvider({
            headers,
            params: openai,
            payload: { apiKey: syntheticKey },
          });

          assert.deepInclude(saved, {
            baseUrl: "https://api.openai.com/v1",
            keySet: true,
            keyUnreadable: false,
            provider: "openai",
          });

          // The same address keeps the key; another asks for it again.
          yield* admin.assistant.connectProvider({
            headers,
            params: openai,
            payload: {},
          });
          assert.strictEqual(
            (yield* refusalOf(
              admin.assistant.connectProvider({
                headers,
                params: openai,
                payload: { baseUrl: "https://images.example.com/v1" },
              })
            ))._tag,
            "AiProviderKeyRequired"
          );

          const refused = yield* refusalOf(
            admin.assistant.connectProvider({
              headers,
              params: { provider: "openai-compatible" },
              payload: { apiKey: syntheticKey },
            })
          );

          assert.deepInclude(refused, {
            _tag: "AiProviderAddressRefused",
            reason: "malformed",
          });

          yield* admin.assistant.connectProvider({
            headers,
            params: { provider: "anthropic" },
            payload: { apiKey: syntheticKey },
          });

          const listed = yield* admin.assistant.providers({ headers });

          // In the catalogue's order.
          assert.deepStrictEqual(
            listed.providers.map(({ provider }) => provider),
            ["anthropic", "openai"]
          );
          assert.notInclude(JSON.stringify(listed), syntheticKey);
        }).pipe(Effect.provide(assistantTest()))
    );

    it.effect(
      "chooses a model on a connected provider that offers the use, and says who writes",
      () =>
        Effect.gen(function* chooses() {
          const workspaceId = yield* freshWorkspace;
          const headers = forWorkspace(workspaceId);
          const admin = yield* as(workspaceId, "admin");

          const before = yield* admin.assistant.models({ headers });

          assert.deepStrictEqual(
            before.models.map(({ capability, provider, serverModel }) => ({
              capability,
              provider,
              serverModel,
            })),
            [
              { capability: "text", provider: null, serverModel: true },
              { capability: "image", provider: null, serverModel: false },
              // Only a workspace's own provider makes videos, voice-overs and
              // transcripts.
              { capability: "video", provider: null, serverModel: false },
              { capability: "speech", provider: null, serverModel: false },
              {
                capability: "transcription",
                provider: null,
                serverModel: false,
              },
              {
                capability: "composition",
                provider: null,
                serverModel: false,
              },
            ]
          );

          assert.strictEqual(
            (yield* refusalOf(
              admin.assistant.setModel({
                headers,
                params: { capability: "text" },
                payload: { model: "gpt-6.2-sol", provider: "openai" },
              })
            ))._tag,
            "AiProviderNotConnected"
          );

          yield* admin.assistant.connectProvider({
            headers,
            params: { provider: "anthropic" },
            payload: { apiKey: syntheticKey },
          });

          assert.strictEqual(
            (yield* refusalOf(
              admin.assistant.setModel({
                headers,
                params: { capability: "image" },
                payload: { model: "claude-sonnet-5-5", provider: "anthropic" },
              })
            ))._tag,
            "AiCapabilityNotOffered"
          );

          const chosen = yield* admin.assistant.setModel({
            headers,
            params: { capability: "text" },
            payload: { model: "claude-sonnet-5-5", provider: "anthropic" },
          });

          assert.deepInclude(chosen, {
            capability: "text",
            model: "claude-sonnet-5-5",
            provider: "anthropic",
            serverModel: true,
          });
          assert.strictEqual(
            (yield* admin.assistant.status({ headers })).source,
            "workspace"
          );

          // The deprecated endpoint reads the same choice.
          assert.deepInclude(
            (yield* admin.assistant.textProvider({ headers })).provider,
            {
              baseUrl: "https://api.anthropic.com",
              kind: "anthropic",
              model: "claude-sonnet-5-5",
              provider: "anthropic",
            }
          );

          yield* admin.assistant.unsetModel({
            headers,
            params: { capability: "text" },
          });

          assert.strictEqual(
            (yield* admin.assistant.status({ headers })).source,
            "server"
          );
          // The provider stays connected.
          assert.strictEqual(
            (yield* admin.assistant.providers({ headers })).providers.length,
            1
          );
        }).pipe(Effect.provide(assistantTest()))
    );

    it.effect("disconnects a provider and unsets the uses on it", () =>
      Effect.gen(function* disconnects() {
        const workspaceId = yield* freshWorkspace;
        const headers = forWorkspace(workspaceId);
        const admin = yield* as(workspaceId, "admin");
        const openai = { provider: "openai" as const };

        yield* admin.assistant.connectProvider({
          headers,
          params: openai,
          payload: { apiKey: syntheticKey },
        });
        yield* admin.assistant.setModel({
          headers,
          params: { capability: "image" },
          payload: { model: "gpt-image-2.6-flare", provider: "openai" },
        });

        assert.strictEqual(
          (yield* admin.assistant.imageProvider({ headers })).provider
            ?.provider,
          "openai"
        );

        yield* admin.assistant.disconnectProvider({ headers, params: openai });
        // Nothing left to remove is no failure.
        yield* admin.assistant.disconnectProvider({ headers, params: openai });

        const after = yield* admin.assistant.models({ headers });

        assert.isTrue(after.models.every(({ provider }) => provider === null));
        assert.isNull(
          (yield* admin.assistant.imageProvider({ headers })).provider
        );
      }).pipe(Effect.provide(assistantTest()))
    );

    it.effect(
      "tests a provider with the text's model, or the catalogue's, or the one asked",
      () =>
        Effect.gen(function* tests() {
          const workspaceId = yield* freshWorkspace;
          const headers = forWorkspace(workspaceId);
          const admin = yield* as(workspaceId, "admin");
          const anthropic = { provider: "anthropic" as const };

          const compatible = { provider: "openai-compatible" as const };

          assert.strictEqual(
            (yield* refusalOf(
              admin.assistant.testProvider({
                headers,
                params: anthropic,
                payload: {},
              })
            ))._tag,
            "AiProviderNotConnected"
          );

          yield* admin.assistant.connectProvider({
            headers,
            params: anthropic,
            payload: { apiKey: syntheticKey },
          });
          yield* FakeOwnWritingModel.use((model) =>
            model.replyWith({ _tag: "answer", value: { text: "It works." } })
          );
          yield* admin.assistant.testProvider({
            headers,
            params: anthropic,
            payload: {},
          });

          yield* admin.assistant.connectProvider({
            headers,
            params: compatible,
            payload: {
              apiKey: syntheticKey,
              baseUrl: "https://images.example.com/v1",
            },
          });

          // Another provider has no model Peal knows of.
          assert.strictEqual(
            (yield* refusalOf(
              admin.assistant.testProvider({
                headers,
                params: compatible,
                payload: {},
              })
            ))._tag,
            "AiModelRequired"
          );

          yield* FakeOwnWritingModel.use((model) =>
            model.replyWith({ _tag: "settingsRefused", status: 401 })
          );

          assert.deepInclude(
            yield* refusalOf(
              admin.assistant.testProvider({
                headers,
                params: compatible,
                payload: { model: "synthetic-text-model" },
              })
            ),
            {
              _tag: "TextProviderRefused",
              reason: "settingsRefused",
              status: 401,
            }
          );
        }).pipe(Effect.provide(assistantTest()))
    );

    it.effect(
      "keeps the deprecated text and image endpoints on the connections",
      () =>
        Effect.gen(function* deprecated() {
          const workspaceId = yield* freshWorkspace;
          const headers = forWorkspace(workspaceId);
          const admin = yield* as(workspaceId, "admin");

          yield* admin.assistant.setTextProvider({
            headers,
            payload: {
              apiKey: syntheticKey,
              baseUrl: "https://images.example.com/v1",
              model: "synthetic-text-model",
              provider: "openai-compatible",
            },
          });
          // The same endpoint for images is the same connection.
          yield* admin.assistant.setImageProvider({
            headers,
            payload: {
              apiKey: syntheticKey,
              baseUrl: "https://images.example.com/v1",
              model: "synthetic-image-model",
              provider: "openai-compatible",
            },
          });

          const listed = yield* admin.assistant.providers({ headers });

          assert.deepStrictEqual(
            listed.providers.map(({ baseUrl, provider }) => ({
              baseUrl,
              provider,
            })),
            [
              {
                baseUrl: "https://images.example.com/v1",
                provider: "openai-compatible",
              },
            ]
          );

          // Removing the text keeps the connection the images are on.
          yield* admin.assistant.removeTextProvider({ headers });

          assert.strictEqual(
            (yield* admin.assistant.providers({ headers })).providers.length,
            1
          );

          yield* admin.assistant.removeImageProvider({ headers });

          assert.deepStrictEqual(
            (yield* admin.assistant.providers({ headers })).providers,
            []
          );
        }).pipe(Effect.provide(assistantTest()))
    );
  }
);
