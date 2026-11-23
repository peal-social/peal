import { and, eq, notExists } from "drizzle-orm";
import { Effect, Layer, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";

import { ProviderSecrets } from "#assistant/application/ports/provider-secrets.ts";
import type { ProviderUse } from "#assistant/application/ports/provider-secrets.ts";
import { connectionAddressOf } from "#assistant/domain/ai-capability.ts";
import type {
  AiCapability,
  ConnectedProviderId,
} from "#assistant/domain/ai-capability.ts";
import {
  providerOfKind,
  TextProviderIdSchema,
  TextProviderKindSchema,
} from "#assistant/domain/text-provider.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { WorkspaceIdSchema } from "#shared/domain/ids.ts";
import { Drizzle } from "#shared/infrastructure/database.ts";

import {
  capabilityModels,
  imageProviders,
  providerConnections,
  textProviders,
} from "./schema.ts";

const decodeProvider = Schema.decodeUnknownOption(TextProviderIdSchema);

const decodeKind = Schema.decodeUnknownOption(TextProviderKindSchema);

const workspaceIdOf = Schema.decodeUnknownSync(WorkspaceIdSchema);

/** A row of the release before, as this step moves it. */
interface EarlierRow {
  readonly baseUrl: string;
  readonly capability: AiCapability;
  readonly keyId: string;
  readonly model: string;
  readonly provider: ConnectedProviderId;
  readonly sealedKey: string;
  readonly updatedAt: Date;
  /** What its key was sealed for. */
  readonly use: ProviderUse;
  readonly workspaceId: WorkspaceId;
}

/** What one start moved: uses, and uses left where they were. */
interface Moved {
  readonly kept: number;
  readonly moved: number;
}

/**
 * Moves the text and image providers the release before kept
 * (`assistant.text_providers`, `assistant.image_providers`) to connections
 * and a choice for each use, once, when the server starts: a use the
 * workspace has not chosen yet takes its earlier row. The key is opened
 * for its earlier binding and sealed again for the connection's (a key
 * that no longer opens is copied as it is, and stays unreadable). Text
 * first, so when both rows name a provider, the text's address and key
 * are the connection's; an image row of another address then rides the
 * text's connection, but for `openai-compatible`, where another address
 * is another endpoint: that one stays unchosen, its row left in place.
 * The earlier rows stay, read-only, for a roll-back; every later change of
 * a workspace's providers deletes that workspace's. Servers starting
 * together insert nothing twice (`ON CONFLICT DO NOTHING`).
 */
export const moveEarlierProviders = Effect.fn("Assistant.moveEarlierProviders")(
  function* moveEarlierProviders() {
    const db = yield* Drizzle;
    const client = yield* SqlClient.SqlClient;
    const secrets = yield* ProviderSecrets;

    const textRows = yield* db
      .select()
      .from(textProviders)
      .where(
        notExists(
          db
            .select({ capability: capabilityModels.capability })
            .from(capabilityModels)
            .where(
              and(
                eq(capabilityModels.workspaceId, textProviders.workspaceId),
                eq(capabilityModels.capability, "text")
              )
            )
        )
      );

    const imageRows = yield* db
      .select()
      .from(imageProviders)
      .where(
        notExists(
          db
            .select({ capability: capabilityModels.capability })
            .from(capabilityModels)
            .where(
              and(
                eq(capabilityModels.workspaceId, imageProviders.workspaceId),
                eq(capabilityModels.capability, "image")
              )
            )
        )
      );

    const earlier: readonly EarlierRow[] = [
      ...textRows.map((row): EarlierRow => {
        // A row saved before providers had names reads as its kind's.
        const provider = Option.getOrElse(decodeProvider(row.provider), () =>
          providerOfKind(
            Option.getOrElse(decodeKind(row.kind), () => "openai-compatible")
          )
        );

        return {
          ...row,
          capability: "text",
          provider,
          use: "text",
          workspaceId: workspaceIdOf(row.workspaceId),
        };
      }),
      ...imageRows.map((row): EarlierRow => ({
        ...row,
        capability: "image",
        // A row saved before providers had names spoke the OpenAI
        // images API at its address.
        provider: Option.getOrElse(
          decodeProvider(row.provider),
          () => "openai-compatible" as const
        ),
        use: "images",
        workspaceId: workspaceIdOf(row.workspaceId),
      })),
    ];

    const move = Effect.fn("Assistant.moveEarlierProvider")(function* move(
      row: EarlierRow
    ) {
      // The earlier row, locked for the move: an erasure deletes it before
      // the connections, so it either waits for this move and deletes what
      // it made, or went first and leaves nothing to move.
      const earlierTable =
        row.capability === "text" ? textProviders : imageProviders;

      const [still] = yield* db
        .select({ workspaceId: earlierTable.workspaceId })
        .from(earlierTable)
        .where(eq(earlierTable.workspaceId, row.workspaceId))
        .for("update");

      if (still === undefined) {
        return false;
      }

      const address = connectionAddressOf(
        row.provider,
        row.capability,
        row.baseUrl
      );

      const [connected] = yield* db
        .select({ baseUrl: providerConnections.baseUrl })
        .from(providerConnections)
        .where(
          and(
            eq(providerConnections.workspaceId, row.workspaceId),
            eq(providerConnections.provider, row.provider)
          )
        );

      if (connected === undefined) {
        const key = yield* secrets.open(
          row.sealedKey,
          row.workspaceId,
          row.baseUrl,
          row.use
        );

        const sealed = yield* Option.match(key, {
          onNone: () =>
            Effect.succeed({ keyId: row.keyId, sealed: row.sealedKey }),
          onSome: (opened) =>
            secrets
              .seal(opened, row.workspaceId, address, {
                connection: row.provider,
              })
              .pipe(
                Effect.orElseSucceed(() => ({
                  keyId: row.keyId,
                  sealed: row.sealedKey,
                }))
              ),
        });

        yield* db
          .insert(providerConnections)
          .values({
            baseUrl: address,
            createdAt: row.updatedAt,
            keyId: sealed.keyId,
            provider: row.provider,
            sealedKey: sealed.sealed,
            updatedAt: row.updatedAt,
            workspaceId: row.workspaceId,
          })
          .onConflictDoNothing();
      } else if (
        connected.baseUrl !== address &&
        row.provider === "openai-compatible"
      ) {
        return false;
      }

      yield* db
        .insert(capabilityModels)
        .values({
          capability: row.capability,
          model: row.model,
          provider: row.provider,
          updatedAt: row.updatedAt,
          workspaceId: row.workspaceId,
        })
        .onConflictDoNothing();

      return true;
    });

    let moved: Moved = { kept: 0, moved: 0 };

    for (const row of earlier) {
      const done = yield* client.withTransaction(move(row));

      moved = done
        ? { ...moved, moved: moved.moved + 1 }
        : { ...moved, kept: moved.kept + 1 };
    }

    if (earlier.length > 0) {
      yield* Effect.logInfo(
        "Moved the workspaces' earlier text and image providers to connections"
      ).pipe(
        Effect.annotateLogs({
          "peal.assistant.providers_kept": moved.kept,
          "peal.assistant.providers_moved": moved.moved,
        })
      );
    }
  },
  Effect.orDie
);

/** The move, when the assistant starts: before anything reads a use. */
export const MoveEarlierProvidersLive = Layer.effectDiscard(
  moveEarlierProviders()
);
