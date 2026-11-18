import { Context } from "effect";
import type { Option } from "effect";

import type { UserId } from "#shared/domain/ids.ts";

/**
 * Who the request being handled acts as, for product analytics: the
 * authentication middlewares provide it. Read with
 * `Effect.serviceOption(AnalyticsActor)`: a job, a Better Auth hook and a
 * test that serves handlers alone have none.
 */
export class AnalyticsActor extends Context.Service<
  AnalyticsActor,
  {
    /** The person acting, none for a key. */
    readonly userId: Option.Option<UserId>;
    /** Whether staff act as that person: nothing is then sent. */
    readonly impersonated: boolean;
  }
>()("peal-server/shared/application/AnalyticsActor") {}
