import { Context, DateTime, Effect, Layer, Option, Schema } from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import { newId } from "#shared/application/ids.ts";
import type { Ids } from "#shared/application/ids.ts";
import { ChannelIdSchema, WorkspaceIdSchema } from "#shared/domain/ids.ts";
import type { WorkspaceId } from "#shared/domain/ids.ts";
import { MissingPermission } from "#shared/domain/missing-permission.ts";
import type { CustomerWorkspace } from "#workspace/domain/customer-workspace.ts";
import { creationKeyLifetime } from "#workspace/domain/idempotency.ts";
import { MissingPartnerScope } from "#workspace/domain/missing-partner-scope.ts";
import type { PartnerKeyPrincipal } from "#workspace/domain/partner-key-principal.ts";

import type { AccountConnectedThere } from "./account-connected-there.ts";
import { AccountStore } from "./account-store.ts";
import { ChannelMover } from "./channel-mover.ts";
import type { MovedChannel } from "./channel-mover.ts";
import { CreationKeyReused } from "./creation-key-reused.ts";
import { CustomerChannelNotFound } from "./customer-channel-not-found.ts";
import { CustomerWorkspaceNotFound } from "./customer-workspace-not-found.ts";
import { CustomerWorkspaces } from "./customer-workspaces.ts";
import type { CreationKeyUse, KeyedCreation } from "./customer-workspaces.ts";
import { MoveKeyClaimed } from "./move-key-claimed.ts";
import type { WorkspaceBusy } from "./workspace-busy.ts";

const decodeWorkspaceId = Schema.decodeUnknownOption(WorkspaceIdSchema);

// What a key moves with: taking the channel out of one workspace, and
// connecting it in the other.
const movingPermissions = ["channel:disconnect", "channel:connect"] as const;

/** A channel to move, as a partner's server asks. */
export interface ChannelMoveRequest {
  readonly channelId: string;
  readonly from: string;
  /**
   * The partner's own key for the request: sent again within
   * `creationKeyLifetime`, the same request answers the channel the first
   * moved, as it now stands, and moves nothing.
   */
  readonly idempotencyKey: Option.Option<string>;
  readonly to: string;
}

/** A channel moved: as it stands where it went, and the two workspaces. */
export interface ChannelMoved {
  readonly channel: MovedChannel;
  readonly from: WorkspaceId;
  /**
   * How many of the posts of the workspace it left still had a target on
   * the channel to go out, which fail there.
   */
  readonly postsLeft: number;
  /** Whether the answer is an earlier request's, sent again. */
  readonly replayed: boolean;
  readonly to: WorkspaceId;
}

export type ChannelMoveFailure =
  | AccountConnectedThere
  | CreationKeyReused
  | CustomerChannelNotFound
  | CustomerWorkspaceNotFound
  | DatabaseError
  | MissingPartnerScope
  | MissingPermission
  | WorkspaceBusy;

/**
 * Moves a channel between two workspaces one partner owns, for its key:
 * a customer's account that belongs with another of its customers. Both
 * share the partner's plan, so the pool holds as many accounts after as
 * before. The channels context decides what the move does
 * (`ChannelMoves`); this decides who may, and between which workspaces.
 *
 * Needs the scope `workspaces:write`, and the key's permissions
 * `channel:disconnect` and `channel:connect`. Only workspaces the key's
 * partner owns: its home workspace and anyone else's read as ones that do
 * not exist. Both stay locked from the check to the move (their rows, the
 * smaller id first), so an offboarding of either waits for the move, or
 * the move finds the workspace gone, and never adds a channel to a
 * workspace being erased.
 */
export class MoveCustomerChannel extends Context.Service<
  MoveCustomerChannel,
  {
    readonly move: (
      key: PartnerKeyPrincipal,
      request: ChannelMoveRequest
    ) => Effect.Effect<ChannelMoved, ChannelMoveFailure>;
  }
>()("peal-server/workspace/application/MoveCustomerChannel") {
  static readonly layer = Layer.effect(
    MoveCustomerChannel,
    Effect.gen(function* MoveCustomerChannelLive() {
      const workspaces = yield* CustomerWorkspaces;
      const accounts = yield* AccountStore;
      const mover = yield* ChannelMover;
      const ports = yield* Effect.context<Ids>();

      // The workspace, while the key's partner owns it.
      const ownedBy = Effect.fn("MoveCustomerChannel.ownedBy")(
        function* ownedBy(key: PartnerKeyPrincipal, requested: string) {
          const id = decodeWorkspaceId(requested);

          const owned = Option.isSome(id)
            ? yield* workspaces.ofPartner(key.partnerId, id.value)
            : Option.none<CustomerWorkspace>();

          return Option.isSome(owned)
            ? owned.value
            : yield* new CustomerWorkspaceNotFound();
        }
      );

      // Both workspaces locked, then the partner's still: in the move's
      // transaction, as an offboarding locks the one it erases first.
      const stillOwned = (
        key: PartnerKeyPrincipal,
        workspaceIds: readonly WorkspaceId[]
      ) =>
        Effect.forEach(
          workspaceIds.toSorted(),
          (workspaceId) =>
            accounts
              .workspace(workspaceId)
              .pipe(Effect.andThen(ownedBy(key, workspaceId))),
          { discard: true }
        );

      const move = Effect.fn("MoveCustomerChannel.move")(function* move(
        key: PartnerKeyPrincipal,
        request: ChannelMoveRequest
      ) {
        yield* key.scopes.includes("workspaces:write")
          ? Effect.void
          : Effect.fail(new MissingPartnerScope({ scope: "workspaces:write" }));

        const missing = movingPermissions.find(
          (permission) => !key.permissions.includes(permission)
        );

        yield* missing === undefined
          ? Effect.void
          : Effect.fail(new MissingPermission({ permission: missing }));

        const from = yield* ownedBy(key, request.from);
        const now = yield* DateTime.now;
        const since = DateTime.subtractDuration(now, creationKeyLifetime);

        // The request as its key keeps it, apart from any creation's.
        const keyed = request.idempotencyKey.pipe(
          Option.map((idempotencyKey): KeyedCreation => ({
            fingerprint: JSON.stringify({
              channelId: request.channelId,
              from: request.from,
              move: true,
              to: request.to,
            }),
            key: idempotencyKey,
          }))
        );

        // The channel an earlier request with the key moved, as it now
        // stands where it went.
        const replayOf = Effect.fn("MoveCustomerChannel.replayOf")(
          function* replayOf(use: CreationKeyUse) {
            if (!use.sameRequest || Option.isNone(use.channelId)) {
              return yield* new CreationKeyReused();
            }

            const there = yield* mover.current(
              use.workspaceId,
              use.channelId.value
            );

            if (Option.isNone(there)) {
              return yield* new CustomerChannelNotFound();
            }

            const replayed: ChannelMoved = {
              channel: there.value,
              from: from.id,
              postsLeft: yield* mover.postsLeft(from.id, request.channelId),
              replayed: true,
              to: use.workspaceId,
            };

            return replayed;
          }
        );

        if (Option.isSome(keyed)) {
          const used = yield* workspaces.keyUse(
            key.partnerId,
            keyed.value,
            since
          );

          if (Option.isSome(used)) {
            return yield* replayOf(used.value);
          }
        }

        const to = yield* ownedBy(key, request.to);
        const as = yield* newId(ChannelIdSchema);

        // Kept in the move's transaction: a move and its key commit
        // together, and two requests with one key move once.
        const claimed = Option.match(keyed, {
          onNone: () => Effect.void,
          onSome: (creation) =>
            workspaces
              .claimKey(
                key.partnerId,
                creation,
                { at: now, channelId: as, workspaceId: to.id },
                since
              )
              .pipe(
                Effect.flatMap(
                  Option.match({
                    onNone: () => Effect.void,
                    onSome: (use) => Effect.fail(new MoveKeyClaimed(use)),
                  })
                )
              ),
        });

        return yield* mover
          .move({
            as,
            channelId: request.channelId,
            from: from.id,
            inside: stillOwned(key, [...new Set([from.id, to.id])]).pipe(
              Effect.andThen(claimed)
            ),
            to: to.id,
          })
          .pipe(
            Effect.map(({ channel, postsLeft }): ChannelMoved => ({
              channel,
              from: from.id,
              postsLeft,
              replayed: false,
              to: to.id,
            })),
            Effect.catchTag("MoveKeyClaimed", (use) =>
              replayOf({
                channelId: use.channelId,
                sameRequest: use.sameRequest,
                workspaceId: use.workspaceId,
              })
            )
          );
      }, Effect.provideContext(ports));

      return MoveCustomerChannel.of({ move });
    })
  );
}
