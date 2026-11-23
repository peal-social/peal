import { DateTime, Effect, Option, Order, Redacted } from "effect";

import { CapabilityNotOffered } from "#assistant/application/capability-not-offered.ts";
import { CapabilityModels } from "#assistant/application/ports/capability-models.ts";
import { ProviderAddressCheck } from "#assistant/application/ports/provider-address-check.ts";
import { ProviderConnections } from "#assistant/application/ports/provider-connections.ts";
import type { StoredConnection } from "#assistant/application/ports/provider-connections.ts";
import { ProviderKeyRequired } from "#assistant/application/provider-key-required.ts";
import { ProviderNotConnected } from "#assistant/application/provider-not-connected.ts";
import { TestModelRequired } from "#assistant/application/test-model-required.ts";
import { askOwnProvider } from "#assistant/application/use-cases/own-suggestion.ts";
import { testPlan } from "#assistant/application/use-cases/text-provider-settings.ts";
import {
  asTextProvider,
  capabilityAddressOf,
  connectionAddresses,
  ConnectedProviderIdSchema,
  firstTextModels,
  fixedAddressesOf,
  fixedAddressProviders,
} from "#assistant/domain/ai-capability.ts";
import type { ConnectedProviderId } from "#assistant/domain/ai-capability.ts";
import {
  checkProviderKey,
  checkProviderModel,
  ProviderAddressSchema,
} from "#assistant/domain/image-provider.ts";
import type { ProviderAddress } from "#assistant/domain/image-provider.ts";
import { ProviderAddressRejected } from "#assistant/domain/provider-address-rejected.ts";
import { ProviderConnectionSettings } from "#assistant/domain/provider-connection.ts";
import { acceptText, TextAnswerSchema } from "#assistant/domain/suggestion.ts";
import {
  kindOfProvider,
  TextProviderSettings,
} from "#assistant/domain/text-provider.ts";
import type { Actor } from "#shared/domain/access.ts";

/** A connected provider as its members read it: never its key. */
export interface ConnectionView {
  readonly baseUrl: ProviderAddress;
  /** A key is stored; it is never shown again. */
  readonly keySet: true;
  /** The stored key no longer decrypts: type it again. */
  readonly keyUnreadable: boolean;
  readonly provider: ConnectedProviderId;
  readonly updatedAt: DateTime.Utc;
}

/** What a member saves for a provider: its address, and its key if typed. */
export interface ConnectionChange {
  /** Left out, the stored key is kept, when the address stays the same. */
  readonly apiKey?: string;
  /** Left out, the provider's own address; `openai-compatible` has none. */
  readonly baseUrl?: string;
}

const viewOf = ({
  keyUnreadable,
  settings,
}: StoredConnection): ConnectionView => ({
  baseUrl: settings.baseUrl,
  keySet: true,
  keyUnreadable,
  provider: settings.provider,
  updatedAt: settings.updatedAt,
});

// The catalogue's order, which clients list providers in.
const catalogueOrder: readonly ConnectedProviderId[] =
  ConnectedProviderIdSchema.literals;

const byCatalogue: Order.Order<ConnectionView> = Order.mapInput(
  Order.Number,
  ({ provider }: ConnectionView) => catalogueOrder.indexOf(provider)
);

/** The providers the actor's workspace connected, without their keys. */
export const listConnections = Effect.fn("ProviderSettings.list")(
  function* listConnections(actor: Actor) {
    const stored = yield* ProviderConnections.use((connections) =>
      connections.list(actor.workspaceId)
    );

    return stored.map(viewOf).toSorted(byCatalogue);
  }
);

/**
 * Connects a provider, or changes its address or key: the address checked
 * (the domain's rules, then the outbound guard, once now), the key
 * required unless the workspace has one stored for this provider that
 * opens and the address stays exactly the same, in which case it is
 * kept, sealed again: a key never follows a changed path or host. The
 * uses it serves stay on it. The provider is not called.
 */
export const connectProvider = Effect.fn("ProviderSettings.connect")(
  function* connectProvider(
    actor: Actor,
    provider: ConnectedProviderId,
    change: ConnectionChange
  ) {
    const { workspaceId } = actor;
    const connections = yield* ProviderConnections;

    const own = connectionAddresses[provider];

    // A provider reached at its own address alone takes no other (but a
    // composition service's sandbox): its package would send the key
    // there whatever the address kept.
    if (
      fixedAddressProviders.has(provider) &&
      change.baseUrl !== undefined &&
      !fixedAddressesOf(provider).includes(change.baseUrl.replace(/\/+$/u, ""))
    ) {
      return yield* new ProviderAddressRejected({ reason: "fixedAddress" });
    }

    // An address left out is the provider's own; one without any is
    // refused as malformed.
    const baseUrl = yield* ProviderAddressCheck.use((addresses) =>
      addresses.check(change.baseUrl ?? own ?? "")
    );

    const key =
      change.apiKey === undefined
        ? yield* connections.open(workspaceId, provider).pipe(
            Effect.map((stored) =>
              stored.pipe(
                Option.filter(({ settings }) => settings.baseUrl === baseUrl),
                Option.flatMap(({ apiKey }) => apiKey)
              )
            ),
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.fail(new ProviderKeyRequired()),
                onSome: Effect.succeed,
              })
            )
          )
        : Redacted.make(
            yield* Effect.fromResult(checkProviderKey(change.apiKey))
          );

    const settings = new ProviderConnectionSettings({
      baseUrl,
      provider,
      updatedAt: yield* DateTime.now,
    });

    yield* connections.save(workspaceId, settings, key);

    return viewOf({ keyUnreadable: false, settings });
  }
);

/**
 * Removes a provider, its key and the uses it served: the server's model
 * works for them again, if it has one. Nothing to remove is no failure.
 */
export const disconnectProvider = Effect.fn("ProviderSettings.disconnect")(
  function* disconnectProvider(actor: Actor, provider: ConnectedProviderId) {
    yield* ProviderConnections.use((connections) =>
      connections.remove(actor.workspaceId, provider)
    );
  }
);

/**
 * Sends a connected provider one short request for text, as a member's
 * would go, to tell whether it works: with the model asked, else the one
 * the workspace's text is written with when this provider writes it,
 * else the first the catalogue suggests. It counts as one of the day's
 * requests to the workspace's own providers, and nothing of Peal's.
 */
export const testProvider = Effect.fn("ProviderSettings.test")(
  function* testProvider(
    actor: Actor,
    provider: ConnectedProviderId,
    asked: { readonly model?: string }
  ) {
    const writer = asTextProvider(provider);

    if (writer === null) {
      return yield* new CapabilityNotOffered();
    }

    const connection = yield* ProviderConnections.use((connections) =>
      connections.open(actor.workspaceId, provider)
    );

    if (Option.isNone(connection)) {
      return yield* new ProviderNotConnected();
    }

    const text = (yield* CapabilityModels.use((models) =>
      models.list(actor.workspaceId)
    )).find((each) => each.capability === "text" && each.provider === provider);

    const named = asked.model ?? text?.model ?? firstTextModels[provider];

    if (named === null) {
      return yield* new TestModelRequired();
    }

    const model = yield* Effect.fromResult(checkProviderModel(named));
    const { apiKey, settings } = connection.value;

    const answer = yield* askOwnProvider(
      actor,
      {
        apiKey,
        settings: new TextProviderSettings({
          baseUrl: ProviderAddressSchema.make(
            capabilityAddressOf(provider, "text", settings.baseUrl)
          ),
          kind: kindOfProvider(writer),
          model,
          provider: writer,
          updatedAt: settings.updatedAt,
        }),
      },
      testPlan.prompt,
      TextAnswerSchema
    );

    return yield* Effect.fromResult(acceptText(answer)).pipe(Effect.asVoid);
  }
);
