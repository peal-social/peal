import { Context, Effect, Layer, Metric, Option, Ref } from "effect";

import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import {
  checkedProperties,
  distinctIdOf,
  userSubject,
  wireProperties,
  workspaceSubject,
} from "#shared/domain/product-event.ts";
import type {
  AnalyticsSubject,
  ProductEvent,
  PropertyValue,
  SafeScalar,
} from "#shared/domain/product-event.ts";

import { AnalyticsActor } from "./analytics-actor.ts";
import { AnalyticsDelivery } from "./analytics-delivery.ts";
import { AnalyticsScope } from "./analytics-scope.ts";

/**
 * Product analytics events, by what became of them: `queued` (handed to
 * the delivery), `skipped` (about someone nothing is sent of), `invalid`
 * (a property that may not leave) here; `sent`, `dropped`, `failed` and
 * `rejected` where they are sent.
 */
export const productAnalyticsEvents = Metric.counter(
  "peal.product_analytics.events",
  {
    description: "Product analytics events, by what became of them",
    incremental: true,
  }
);

/** What became of an event. */
export type EventOutcome =
  | "dropped"
  | "failed"
  | "invalid"
  | "queued"
  | "rejected"
  | "sent"
  | "skipped";

/** Counts `count` events under `outcome`. */
export const countEvents = (outcome: EventOutcome, count = 1) =>
  count === 0
    ? Effect.void
    : Metric.update(
        Metric.withAttributes(productAnalyticsEvents, { outcome }),
        count
      );

/** Who did something, as the caller knows it. */
export interface CapturedActor {
  readonly userId: UserId;
  /** Staff acting as that person: nothing is then sent. */
  readonly impersonated: boolean;
}

/** Something that happened, for product analytics. */
export interface Captured {
  readonly event: ProductEvent;
  /** The workspace the event is about, when it is about one. */
  readonly workspaceId: Option.Option<WorkspaceId>;
  /** The billing account, where the caller already holds it. */
  readonly billingAccountId: Option.Option<string>;
  /**
   * Who did it, when the caller knows and the request may say otherwise or
   * there is no request (a Better Auth hook). None: the request's actor,
   * or else the workspace's service identity.
   */
  readonly actor: Option.Option<CapturedActor>;
}

/** The kinds of group events are linked to. */
export type AnalyticsGroupType = "billing_account" | "workspace";

/** A group's properties: scalars only. */
export type GroupProperties = Readonly<Record<string, SafeScalar>>;

/** A person's properties: `set` replaces, `setOnce` keeps the first. */
export interface PersonProperties {
  readonly set: Readonly<Record<string, SafeScalar>>;
  readonly setOnce: Readonly<Record<string, SafeScalar>>;
}

/** What an erasure removed, whose events product analytics forgets. */
export interface Erased {
  readonly userIds: readonly UserId[];
  readonly workspaceIds: readonly WorkspaceId[];
}

// An event's properties while they are built, before they are checked.
interface OutgoingProperties {
  [key: string]: PropertyValue;
}

// An event left out for a property that may not leave: logged by its name
// and the key, never the value.
const refuse = (name: string, key: string) =>
  countEvents("invalid").pipe(
    Effect.andThen(
      Effect.logWarning(
        "Left out a product analytics event whose property may not leave"
      )
    ),
    Effect.annotateLogs({
      "peal.product_analytics.event": name,
      "peal.product_analytics.key": key,
    })
  );

// A bug here never reaches the caller.
const neverFailing = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(
    Effect.asVoid,
    Effect.catchCause((cause) =>
      Effect.logWarning("Product analytics failed", cause)
    )
  );

// Who acts: the caller's actor, or else the request's.
const actorOf = (captured: Captured) =>
  Option.isSome(captured.actor)
    ? Effect.succeed(
        Option.some({
          impersonated: captured.actor.value.impersonated,
          userId: Option.some(captured.actor.value.userId),
        })
      )
    : Effect.serviceOption(AnalyticsActor).pipe(
        Effect.map(
          Option.map(({ impersonated, userId }) => ({ impersonated, userId }))
        )
      );

// The groups an event is linked to: its workspace, and the billing
// account where the caller holds it.
const groupsOf = (captured: Captured) => {
  const groups: Record<string, string> = {};

  if (Option.isSome(captured.workspaceId)) {
    groups["workspace"] = captured.workspaceId.value;
  }

  if (Option.isSome(captured.billingAccountId)) {
    groups["billing_account"] = captured.billingAccountId.value;
  }

  return groups;
};

// An event's properties, its own and those every event carries.
const capturedProperties = (
  captured: Captured,
  common: OutgoingProperties,
  service: boolean
): OutgoingProperties => {
  const properties: OutgoingProperties = {
    ...wireProperties(captured.event),
    ...common,
    actor_kind: service ? "service" : "user",
  };

  const groups = groupsOf(captured);

  if (Option.isSome(captured.workspaceId)) {
    properties["workspace_id"] = captured.workspaceId.value;
  }

  if (Object.keys(groups).length > 0) {
    properties["$groups"] = groups;
  }

  if (service) {
    properties["$set"] = { kind: "service" };
  }

  return properties;
};

// A person's properties, without an empty object.
const personProperties = (
  common: OutgoingProperties,
  { set, setOnce }: PersonProperties
): OutgoingProperties => {
  const properties: OutgoingProperties = { ...common };

  if (Object.keys(set).length > 0) {
    properties["$set"] = set;
  }

  if (Object.keys(setOnce).length > 0) {
    properties["$set_once"] = setOnce;
  }

  return properties;
};

/**
 * Product analytics: what contexts call when something worth counting
 * happens. It decides who an event is about, leaves out what must not be
 * sent (staff acting as someone, a person who objected, an account or a
 * workspace erased in this process), checks every property against
 * `SafePropertiesSchema` and hands the event to the delivery. Nothing it
 * does fails, dies or waits on the network.
 */
export class ProductAnalytics extends Context.Service<
  ProductAnalytics,
  {
    readonly enabled: boolean;
    readonly capture: (captured: Captured) => Effect.Effect<void>;
    readonly identify: (
      userId: UserId,
      properties: PersonProperties
    ) => Effect.Effect<void>;
    readonly groupIdentify: (
      group: { readonly type: AnalyticsGroupType; readonly key: string },
      properties: GroupProperties,
      as: AnalyticsSubject
    ) => Effect.Effect<void>;
    /** Marks a staff member `internal: true`, once per process per user. */
    readonly markInternal: (userId: UserId) => Effect.Effect<void>;
    /**
     * Forgets these users and these workspaces' service identities: nothing
     * more is sent about them, and the provider deletes them. It may take
     * a while: callers that answer someone fork it.
     */
    readonly forget: (erased: Erased) => Effect.Effect<void>;
  }
>()("peal-server/shared/application/ProductAnalytics") {
  /** Nothing is sent nor kept. */
  static readonly none = Layer.succeed(
    ProductAnalytics,
    ProductAnalytics.of({
      capture: () => Effect.void,
      enabled: false,
      forget: () => Effect.void,
      groupIdentify: () => Effect.void,
      identify: () => Effect.void,
      markInternal: () => Effect.void,
    })
  );

  static readonly layer = Layer.effect(
    ProductAnalytics,
    Effect.gen(function* ProductAnalyticsLive() {
      const delivery = yield* AnalyticsDelivery;
      const { environment, excludedUsers } = yield* AnalyticsScope;

      // Who was erased in this process, and who was marked internal: held
      // by the layer, never the module.
      const forgottenUsers = yield* Ref.make<ReadonlySet<string>>(new Set());

      const forgottenWorkspaces = yield* Ref.make<ReadonlySet<string>>(
        new Set()
      );

      const marked = yield* Ref.make<ReadonlySet<string>>(new Set());

      const common: OutgoingProperties = {
        $geoip_disable: true,
        environment,
      };

      const userLeftOut = (userId: UserId) =>
        excludedUsers.has(userId)
          ? Effect.succeed(true)
          : Ref.get(forgottenUsers).pipe(
              Effect.map((forgotten) => forgotten.has(userId))
            );

      // Whether nothing may be sent about this subject.
      const leftOut = (subject: AnalyticsSubject) =>
        subject._tag === "user"
          ? userLeftOut(subject.userId)
          : Ref.get(forgottenWorkspaces).pipe(
              Effect.map((forgotten) => forgotten.has(subject.workspaceId))
            );

      // Checks the properties, then queues the event, unless nothing may
      // be sent about its subject.
      const deliver = (
        name: string,
        subject: AnalyticsSubject,
        properties: OutgoingProperties
      ) =>
        Effect.gen(function* delivering() {
          if (yield* leftOut(subject)) {
            return yield* countEvents("skipped");
          }

          const checked = checkedProperties(properties);

          return yield* checked._tag === "unsafe"
            ? refuse(name, checked.key)
            : delivery
                .send({
                  distinctId: distinctIdOf(subject),
                  event: name,
                  properties: checked.properties,
                })
                .pipe(Effect.andThen(countEvents("queued")));
        });

      const capture = (captured: Captured) =>
        Effect.gen(function* capturing() {
          const actor = yield* actorOf(captured);

          if (Option.exists(actor, ({ impersonated }) => impersonated)) {
            return yield* countEvents("skipped");
          }

          const userId = actor.pipe(Option.flatMap(({ userId: id }) => id));

          const subject = Option.isSome(userId)
            ? Option.some(userSubject(userId.value))
            : captured.workspaceId.pipe(Option.map(workspaceSubject));

          return yield* Option.match(subject, {
            // An event about nobody: a bug of its caller.
            onNone: () => refuse(captured.event.name, "distinct_id"),
            onSome: (about) =>
              deliver(
                captured.event.name,
                about,
                capturedProperties(captured, common, about._tag === "workspace")
              ),
          });
        });

      const identify = (userId: UserId, properties: PersonProperties) =>
        deliver(
          "$identify",
          userSubject(userId),
          personProperties(common, properties)
        );

      const firstMark = (userId: UserId) =>
        Ref.modify(marked, (already) =>
          already.has(userId)
            ? [false, already]
            : [true, new Set([...already, userId])]
        );

      const forget = ({ userIds, workspaceIds }: Erased) =>
        Effect.gen(function* forgetting() {
          yield* Ref.update(
            forgottenUsers,
            (forgotten) => new Set([...forgotten, ...userIds])
          );

          yield* Ref.update(
            forgottenWorkspaces,
            (forgotten) => new Set([...forgotten, ...workspaceIds])
          );

          const distinctIds = [
            ...userIds.map((id) => distinctIdOf(userSubject(id))),
            ...workspaceIds.map((id) => distinctIdOf(workspaceSubject(id))),
          ];

          yield* distinctIds.length === 0
            ? Effect.void
            : delivery.forget(distinctIds);
        });

      const whenEnabled = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        delivery.enabled ? neverFailing(effect) : Effect.void;

      return ProductAnalytics.of({
        capture: (captured) => whenEnabled(capture(captured)),
        enabled: delivery.enabled,
        forget: (erased) => neverFailing(forget(erased)),
        groupIdentify: (group, properties, as) =>
          whenEnabled(
            deliver("$groupidentify", as, {
              ...common,
              $group_key: group.key,
              $group_set: properties,
              $group_type: group.type,
            })
          ),
        identify: (userId, properties) =>
          whenEnabled(identify(userId, properties)),
        markInternal: (userId) =>
          whenEnabled(
            firstMark(userId).pipe(
              Effect.flatMap((first) =>
                first
                  ? identify(userId, { set: { internal: true }, setOnce: {} })
                  : Effect.void
              )
            )
          ),
      });
    })
  );
}
