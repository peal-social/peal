import { AsyncResult } from "effect/reactivity";

/** What the over-plan screen shows: loading, why it could not, or itself. */
export type OverPlanLoad = "failed" | "loading" | "ready";

interface OverPlanReads {
  /** Whether the member orders a plan and chooses what stays. */
  readonly canManage: boolean;
  readonly channels: AsyncResult.AsyncResult<unknown, unknown>;
  /** Whether the page has hydrated. */
  readonly hydrated: boolean;
  readonly members: AsyncResult.AsyncResult<unknown, unknown>;
}

/**
 * What the over-plan screen shows. A member who manages billing chooses
 * among the channels and the members, which are read with the visitor's
 * cookies, which only the browser sends: read during the server's render,
 * their queries have failed already, while the browser's first render
 * sees them loading. So the screen loads before hydration whatever they
 * hold, then until both are read, and says why when either could not be.
 * The other members read who can fix it, which needs neither: they get
 * the screen at once, on the server too.
 */
export const overPlanLoadOf = ({
  canManage,
  channels,
  hydrated,
  members,
}: OverPlanReads): OverPlanLoad => {
  if (!canManage) {
    return "ready";
  }

  if (!hydrated) {
    return "loading";
  }

  if (AsyncResult.isFailure(channels) || AsyncResult.isFailure(members)) {
    return "failed";
  }

  return AsyncResult.isSuccess(channels) && AsyncResult.isSuccess(members)
    ? "ready"
    : "loading";
};
