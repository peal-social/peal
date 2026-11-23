import {
  Context,
  DateTime,
  Duration,
  Effect,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";

import type { DatabaseError } from "#shared/application/database-error.ts";
import { newId } from "#shared/application/ids.ts";
import type { Ids } from "#shared/application/ids.ts";
import type { Actor, Permission } from "#shared/domain/access.ts";
import { authorize } from "#shared/domain/authorize.ts";
import type { UserId } from "#shared/domain/ids.ts";
import type { MissingPermission } from "#shared/domain/missing-permission.ts";
import { PartnerKeyIdSchema } from "#workspace/domain/partner-id.ts";
import { PartnerKeyPrincipal } from "#workspace/domain/partner-key-principal.ts";
import {
  distinctScopes,
  grantableToPartnerKey,
  PartnerKey,
  partnerKeyBeyondMaker,
  partnerKeyPrefix,
} from "#workspace/domain/partner-key.ts";
import type { PartnerScope } from "#workspace/domain/partner-key.ts";
import type { PermissionNotGrantable } from "#workspace/domain/permission-not-grantable.ts";
import { inPerson } from "#workspace/domain/person-required.ts";
import type { PersonRequired } from "#workspace/domain/person-required.ts";

import type { KeyMaker } from "./api-keys.ts";
import type { DirectoryUnavailable } from "./directory-unavailable.ts";
import { PartnerKeyNotFound } from "./partner-key-not-found.ts";
import { PartnerKeyTokens } from "./partner-key-tokens.ts";
import { PartnerNotFound } from "./partner-not-found.ts";
import { PartnerStore } from "./partner-store.ts";
import { WorkspacePeople } from "./workspace-people.ts";

const decodeKeyId = Schema.decodeUnknownOption(PartnerKeyIdSchema);

/** What a member asks of a new partner key. */
export interface NewPartnerKey {
  readonly expiresInDays: Option.Option<number>;
  readonly name: string;
  readonly permissions: readonly Permission[];
  readonly scopes: readonly PartnerScope[];
}

/**
 * A key as the list shows it: with its maker while they are a member of
 * the home workspace.
 */
export interface ListedPartnerKey {
  readonly maker: Option.Option<KeyMaker>;
  readonly partnerKey: PartnerKey;
}

/** A new key: shown once, here. */
export interface CreatedPartnerKey extends ListedPartnerKey {
  readonly key: Redacted.Redacted;
}

/**
 * A partner's keys, which its home workspace's people manage, and the
 * check of a key a request sends.
 *
 * | Use case | Needs                                |
 * | -------- | ------------------------------------ |
 * | list     | partner:read                         |
 * | create   | partner:manage, the member in person |
 * | revoke   | partner:manage                       |
 *
 * A key is created by a person, never by a key or an application, so one
 * leaked credential cannot mint others that outlive it; anyone who manages
 * the account may revoke one, a key of the workspace included, as revoking
 * only ever takes access away.
 */
export class PartnerKeys extends Context.Service<
  PartnerKeys,
  {
    readonly list: (
      actor: Actor
    ) => Effect.Effect<
      readonly ListedPartnerKey[],
      DatabaseError | DirectoryUnavailable | MissingPermission | PartnerNotFound
    >;
    readonly create: (
      actor: Actor,
      key: NewPartnerKey
    ) => Effect.Effect<
      CreatedPartnerKey,
      | DatabaseError
      | DirectoryUnavailable
      | MissingPermission
      | PartnerNotFound
      | PermissionNotGrantable
      | PersonRequired
    >;
    readonly revoke: (
      actor: Actor,
      partnerKeyId: string
    ) => Effect.Effect<
      void,
      DatabaseError | MissingPermission | PartnerKeyNotFound | PartnerNotFound
    >;
    /**
     * Whose key a request sent, if it is a partner's, not expired, of an
     * account that still exists.
     */
    readonly verify: (
      token: Redacted.Redacted
    ) => Effect.Effect<Option.Option<PartnerKeyPrincipal>, DatabaseError>;
  }
>()("peal-server/workspace/application/PartnerKeys") {
  static readonly layer = Layer.effect(
    PartnerKeys,
    Effect.gen(function* PartnerKeysLive() {
      const partners = yield* PartnerStore;
      const tokens = yield* PartnerKeyTokens;
      const ports = yield* Effect.context<Ids>();
      const people = yield* WorkspacePeople;

      // Each key's maker, named as the home workspace's members are: none
      // once they are no longer one.
      const makersIn = (actor: Actor, keys: readonly PartnerKey[]) =>
        Effect.gen(function* makers() {
          const names = keys.every(({ createdBy }) => Option.isNone(createdBy))
            ? new Map<UserId, string>()
            : new Map(
                (yield* people.members(actor.workspaceId)).map(
                  ({ name, userId }) => [userId, name] as const
                )
              );

          return keys.map((partnerKey): ListedPartnerKey => ({
            maker: partnerKey.createdBy.pipe(
              Option.flatMap((id) =>
                Option.fromUndefinedOr(names.get(id)).pipe(
                  Option.map((name) => ({ id, name }))
                )
              )
            ),
            partnerKey,
          }));
        });

      const partnerOf = (actor: Actor) =>
        partners.ofWorkspace(actor.workspaceId).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new PartnerNotFound()),
              onSome: Effect.succeed,
            })
          )
        );

      const list = Effect.fn("PartnerKeys.list")(function* list(actor: Actor) {
        yield* Effect.fromResult(authorize(actor, "partner:read"));

        const partner = yield* partnerOf(actor);

        return yield* makersIn(actor, yield* partners.keys(partner.id));
      });

      const create = Effect.fn("PartnerKeys.create")(function* create(
        actor: Actor,
        key: NewPartnerKey
      ) {
        yield* Effect.fromResult(authorize(actor, "partner:manage"));
        const userId = yield* Effect.fromResult(inPerson(actor));

        const permissions = yield* Effect.fromResult(
          grantableToPartnerKey(key.permissions)
        );

        const partner = yield* partnerOf(actor);
        const now = yield* DateTime.now;
        const issued = yield* tokens.issue;

        const partnerKey = new PartnerKey({
          createdAt: now,
          createdBy: Option.some(userId),
          expiresAt: key.expiresInDays.pipe(
            Option.map((days) => DateTime.addDuration(now, Duration.days(days)))
          ),
          id: yield* newId(PartnerKeyIdSchema),
          name: key.name,
          partnerId: partner.id,
          permissions,
          scopes: distinctScopes(key.scopes),
          start: issued.start,
        });

        yield* partners.addKey(partnerKey, issued.digest, userId);

        const [listed] = yield* makersIn(actor, [partnerKey]);

        const created: CreatedPartnerKey = {
          key: issued.token,
          maker: listed?.maker ?? Option.none(),
          partnerKey,
        };

        return created;
      }, Effect.provideContext(ports));

      const revoke = Effect.fn("PartnerKeys.revoke")(function* revoke(
        actor: Actor,
        partnerKeyId: string
      ) {
        yield* Effect.fromResult(authorize(actor, "partner:manage"));

        const partner = yield* partnerOf(actor);
        const id = decodeKeyId(partnerKeyId);

        const removed = Option.isSome(id)
          ? yield* partners.removeKey(partner.id, id.value)
          : false;

        yield* removed
          ? Effect.void
          : Effect.fail(new PartnerKeyNotFound({ partnerKeyId }));
      });

      const verify = Effect.fn("PartnerKeys.verify")(function* verify(
        token: Redacted.Redacted
      ) {
        if (!Redacted.value(token).startsWith(partnerKeyPrefix)) {
          return Option.none<PartnerKeyPrincipal>();
        }

        const found = yield* partners.keyByDigest(
          yield* tokens.digestOf(token)
        );

        const now = yield* DateTime.now;

        // A key past its maker's standing in the home workspace, as one
        // made while that standing changed may be: refused, and revoked
        // as far as it goes. A key with no recorded maker is not asked.
        const outgrown = found.pipe(
          Option.filter(
            ({ key, makerRole }) =>
              Option.isSome(key.createdBy) && partnerKeyBeyondMaker(makerRole)
          )
        );

        if (Option.isSome(outgrown)) {
          const { key } = outgrown.value;

          yield* partners
            .removeKey(key.partnerId, key.id)
            .pipe(
              Effect.catchCause((cause) =>
                Effect.logWarning(
                  "Revoking a partner key past its maker's standing failed",
                  cause
                )
              )
            );

          return Option.none<PartnerKeyPrincipal>();
        }

        return found.pipe(
          Option.map(({ key }) => key),
          Option.filter(({ expiresAt }) =>
            Option.match(expiresAt, {
              onNone: () => true,
              onSome: (at) => DateTime.isLessThan(now, at),
            })
          ),
          Option.map(
            (valid) =>
              new PartnerKeyPrincipal({
                partnerId: valid.partnerId,
                partnerKeyId: valid.id,
                permissions: valid.permissions,
                scopes: valid.scopes,
              })
          )
        );
      });

      return PartnerKeys.of({ create, list, revoke, verify });
    })
  );
}
