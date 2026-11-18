import { Context, Effect, Layer, Metric, Option, Ref, Schedule } from "effect";

import type { UserId, WorkspaceId } from "#shared/domain/ids.ts";
import {
  checkedProperties,
  distinctIdOf,
  isDeclaredEvent,
  isDeclaredGroup,
  isDeclaredPerson,
  userSubject,
  wireProperties,
  workspaceSubject,
} from "#shared/domain/product-event.ts";
import type {
  AnalyticsSubject,
  GroupPropertiesInput,
  PersonPropertiesInput,
  ProductEvent,
  PropertyValue,
} from "#shared/domain/product-event.ts";

import { AnalyticsActor } from "./analytics-actor.ts";
import { AnalyticsDelivery } from "./analytics-delivery.ts";
import { AnalyticsErasures } from "./analytics-erasures.ts";
import { AnalyticsScope } from "./analytics-scope.ts";
import type { DatabaseError } from "./database-error.ts";

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

/**
 * Deletions of persons at the provider, by what became of them:
 * `requested` (the provider took them), `manual` (no key to delete with:
 * logged for the operator), `failed` (its attempts ran out: logged).
 */
export const productAnalyticsErasures = Metric.counter(
  "peal.product_analytics.erasures",
  {
    description: "Deletions of persons at PostHog, by outcome",
    incremental: true,
  }
);

/** Counts a deletion of persons under `outcome`. */
export const countErasure = (outcome: "failed" | "manual" | "requested") =>
  Metric.update(
    Metric.withAttributes(productAnalyticsErasures, { outcome }),
    1
  );

/**
 * Logs and counts a deletion of persons the provider never confirmed, for
 * the operator to make by hand: ids only, as `peal.erasure` logs them.
 */
export const erasureGivenUp = (distinctIds: readonly string[]) =>
  countErasure("failed").pipe(
    Effect.andThen(
      Effect.logError(
        "PostHog did not delete the persons of an erasure: delete them there by hand"
      )
    ),
    Effect.annotateLogs({
      distinctIds: distinctIds.join(","),
      "event.name": "peal.erasure.analytics_failed",
    })
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
  /**
   * Sent as the workspace's service identity, whoever the request is: for
   * what comes from stored data rather than a person acting now (a
   * Stripe event naming the member who once subscribed), whose user may
   * have been erased since.
   */
  readonly asWorkspace: boolean;
}

/** The kinds of group events are linked to. */
export type AnalyticsGroupType = "billing_account" | "workspace";

/** A group's properties, as `GroupPropertiesSchema` declares them. */
export type GroupProperties = GroupPropertiesInput;

/** A person's properties: `set` replaces, `setOnce` keeps the first. */
export interface PersonProperties {
  readonly set: PersonPropertiesInput;
  readonly setOnce: PersonPropertiesInput;
}

/** What an erasure removed, whose events product analytics forgets. */
export interface Erased {
  readonly userIds: readonly UserId[];
  readonly workspaceIds: readonly WorkspaceId[];
}

/** The ids an erasure's persons go by at the provider. */
export const distinctIdsOf = ({ userIds, workspaceIds }: Erased) => [
  ...userIds.map((id) => distinctIdOf(userSubject(id))),
  ...workspaceIds.map((id) => distinctIdOf(workspaceSubject(id))),
];

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

// Who acts: the caller's actor, or else the request's; nobody for what
// comes from stored data.
const actorOf = (captured: Captured) => {
  if (captured.asWorkspace) {
    return Effect.succeed(Option.none());
  }

  return Option.isSome(captured.actor)
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
};

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

// The web app's session a person's event joins: the request's, when the
// request is that same person's own (never for a service identity).
const sessionOf = (subject: AnalyticsSubject) =>
  subject._tag === "user"
    ? Effect.serviceOption(AnalyticsActor).pipe(
        Effect.map(
          Option.flatMap(({ impersonated, sessionId, userId }) =>
            !impersonated &&
            Option.exists(userId, (id) => id === subject.userId)
              ? sessionId
              : Option.none()
          )
        )
      )
    : Effect.succeed(Option.none<string>());

// An event's properties, its own and those every event carries.
const capturedProperties = (
  captured: Captured,
  common: OutgoingProperties,
  service: boolean,
  session: Option.Option<string>
): OutgoingProperties => {
  const properties: OutgoingProperties = {
    ...wireProperties(captured.event),
    ...common,
    actor_kind: service ? "service" : "user",
  };

  if (Option.isSome(session)) {
    properties["$session_id"] = session.value;
  }

  const groups = groupsOf(captured);

  if (Option.isSome(captured.workspaceId)) {
    properties["workspace_id"] = captured.workspaceId.value;
  }

  // Beside the group, for a project without group analytics.
  if (Option.isSome(captured.billingAccountId)) {
    properties["billing_account_id"] = captured.billingAccountId.value;
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

const nothingErased = ({ userIds, workspaceIds }: Erased) =>
  userIds.length === 0 && workspaceIds.length === 0;

// A deletion made at once, for a command that waits for it: a few tries,
// then given up and logged.
const deletionRetry = {
  schedule: Schedule.exponential("500 millis"),
  times: 3,
};

/**
 * Product analytics: what contexts call when something worth counting
 * happens. It decides who an event is about, leaves out what must not be
 * sent (staff acting as someone, a user or workspace the operator
 * excluded, an account or a workspace erased in this process), refuses an
 * event with a key the catalogue does not declare, checks every property
 * against `SafePropertiesSchema` and hands the event to the delivery.
 * Nothing it does fails, dies or waits on the network.
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
     * Starts the durable deletion of an erasure's persons at the
     * provider, inside the erasure's transaction, so it commits with it,
     * or not at all: a start the database refuses fails the erasure, which
     * is tried again, and nothing is left to delete by hand.
     */
    readonly erase: (
      key: string,
      erased: Erased
    ) => Effect.Effect<void, DatabaseError>;
    /**
     * Nothing more is sent about these users and workspaces, in this
     * process: called once their erasure committed.
     */
    readonly forget: (erased: Erased) => Effect.Effect<void>;
    /**
     * Forgets them, then deletes them at the provider and waits for it:
     * for a command (the replay of erasures). Never fails: a deletion the
     * provider never confirms is logged.
     */
    readonly eraseNow: (erased: Erased) => Effect.Effect<void>;
  }
>()("peal-server/shared/application/ProductAnalytics") {
  /** Nothing is sent nor kept. */
  static readonly none = Layer.succeed(
    ProductAnalytics,
    ProductAnalytics.of({
      capture: () => Effect.void,
      enabled: false,
      erase: () => Effect.void,
      eraseNow: () => Effect.void,
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
      const erasures = yield* AnalyticsErasures;
      const { environment, excluded } = yield* AnalyticsScope;

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
        excluded.has(userId)
          ? Effect.succeed(true)
          : Ref.get(forgottenUsers).pipe(
              Effect.map((forgotten) => forgotten.has(userId))
            );

      const workspaceLeftOut = (workspaceId: string) =>
        excluded.has(workspaceId)
          ? Effect.succeed(true)
          : Ref.get(forgottenWorkspaces).pipe(
              Effect.map((forgotten) => forgotten.has(workspaceId))
            );

      // Whether nothing may be sent about this subject.
      const leftOut = (subject: AnalyticsSubject) =>
        subject._tag === "user"
          ? userLeftOut(subject.userId)
          : workspaceLeftOut(subject.workspaceId);

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
          // An event the catalogue does not declare as it is, an extra key
          // included, never leaves.
          if (!isDeclaredEvent(captured.event)) {
            return yield* refuse(captured.event.name, "properties");
          }

          // An excluded or erased workspace sends nothing, whoever acted.
          if (
            Option.isSome(captured.workspaceId) &&
            (yield* workspaceLeftOut(captured.workspaceId.value))
          ) {
            return yield* countEvents("skipped");
          }

          const actor = yield* actorOf(captured);

          if (Option.exists(actor, ({ impersonated }) => impersonated)) {
            return yield* countEvents("skipped");
          }

          const userId = actor.pipe(Option.flatMap(({ userId: id }) => id));

          const subject = Option.isSome(userId)
            ? Option.some(userSubject(userId.value))
            : captured.workspaceId.pipe(Option.map(workspaceSubject));

          if (Option.isNone(subject)) {
            // An event about nobody: a bug of its caller.
            return yield* refuse(captured.event.name, "distinct_id");
          }

          const about = subject.value;

          return yield* deliver(
            captured.event.name,
            about,
            capturedProperties(
              captured,
              common,
              about._tag === "workspace",
              yield* sessionOf(about)
            )
          );
        });

      const identify = (userId: UserId, properties: PersonProperties) =>
        isDeclaredPerson(properties.set) && isDeclaredPerson(properties.setOnce)
          ? deliver(
              "$identify",
              userSubject(userId),
              personProperties(common, properties)
            )
          : refuse("$identify", "$set");

      const groupIdentify = (
        group: { readonly type: AnalyticsGroupType; readonly key: string },
        properties: GroupProperties,
        as: AnalyticsSubject
      ) =>
        Effect.gen(function* identifyingGroup() {
          if (!isDeclaredGroup(properties)) {
            return yield* refuse("$groupidentify", "$group_set");
          }

          // The group of an excluded or erased workspace is left alone.
          if (
            group.type === "workspace" &&
            (yield* workspaceLeftOut(group.key))
          ) {
            return yield* countEvents("skipped");
          }

          return yield* deliver("$groupidentify", as, {
            ...common,
            $group_key: group.key,
            $group_set: properties,
            $group_type: group.type,
          });
        });

      const firstMark = (userId: UserId) =>
        Ref.modify(marked, (already) =>
          already.has(userId)
            ? [false, already]
            : [true, new Set([...already, userId])]
        );

      const forget = ({ userIds, workspaceIds }: Erased) =>
        Ref.update(
          forgottenUsers,
          (forgotten) => new Set([...forgotten, ...userIds])
        ).pipe(
          Effect.andThen(
            Ref.update(
              forgottenWorkspaces,
              (forgotten) => new Set([...forgotten, ...workspaceIds])
            )
          )
        );

      const erase = (key: string, erased: Erased) =>
        delivery.enabled && !nothingErased(erased)
          ? erasures.start({ ...erased, key })
          : Effect.void;

      const eraseNow = (erased: Erased) =>
        Effect.gen(function* erasingNow() {
          yield* forget(erased);

          const distinctIds = distinctIdsOf(erased);

          yield* delivery.purge(distinctIds);

          yield* delivery.forget(distinctIds).pipe(
            Effect.retry(deletionRetry),
            Effect.catchTag("AnalyticsErasureFailed", () =>
              erasureGivenUp(distinctIds)
            )
          );
        });

      const whenEnabled = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
        delivery.enabled ? neverFailing(effect) : Effect.void;

      return ProductAnalytics.of({
        capture: (captured) => whenEnabled(capture(captured)),
        enabled: delivery.enabled,
        erase,
        eraseNow: (erased) =>
          nothingErased(erased) ? Effect.void : whenEnabled(eraseNow(erased)),
        forget: (erased) => neverFailing(forget(erased)),
        groupIdentify: (group, properties, as) =>
          whenEnabled(groupIdentify(group, properties, as)),
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
