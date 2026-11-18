import { Context, Layer } from "effect";

import type { UserId } from "#shared/domain/ids.ts";

/**
 * What the rules of product analytics take from the operator's settings,
 * so the application reads no configuration: the environment every event
 * names, and the users nothing is sent about.
 */
export class AnalyticsScope extends Context.Service<
  AnalyticsScope,
  {
    readonly environment: string;
    readonly excludedUsers: ReadonlySet<UserId>;
  }
>()("peal-server/shared/application/AnalyticsScope") {
  /** `test` for an environment, and nobody excluded. */
  static readonly layerTest = Layer.succeed(
    AnalyticsScope,
    AnalyticsScope.of({ environment: "test", excludedUsers: new Set() })
  );
}
