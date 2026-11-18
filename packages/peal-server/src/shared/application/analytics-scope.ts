import { Context, Layer } from "effect";

/**
 * What the rules of product analytics take from the operator's settings,
 * so the application reads no configuration: the environment every event
 * names, and the users and workspaces nothing is sent about, by id.
 */
export class AnalyticsScope extends Context.Service<
  AnalyticsScope,
  {
    readonly environment: string;
    /**
     * Users and workspaces nothing is sent about: an event of an excluded
     * user, or about an excluded workspace, whoever acted, is left out.
     */
    readonly excluded: ReadonlySet<string>;
  }
>()("peal-server/shared/application/AnalyticsScope") {
  /** `test` for an environment, and nobody excluded. */
  static readonly layerTest = Layer.succeed(
    AnalyticsScope,
    AnalyticsScope.of({ environment: "test", excluded: new Set() })
  );
}
