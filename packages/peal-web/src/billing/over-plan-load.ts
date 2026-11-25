import { AsyncResult } from "effect/reactivity";

/**
 * What one of the over-plan screen's lists shows: rows in its place while
 * it loads, why it could not be read, or its rows.
 */
export type ListLoad = "failed" | "loading" | "ready";

/**
 * What one of the lists a member who manages billing chooses among (the
 * channels, the members) shows. They are read with the visitor's cookies,
 * which only the browser sends: read during the server's render, their
 * queries have failed already, while the browser's first render sees them
 * loading. So a list loads before hydration whatever it holds, then until
 * it is read, and again while it is read after a failure (Try again); it
 * says why when it could not be. The rest of the screen needs neither, and
 * shows at once, on the server too.
 */
export const listLoadOf = (
  hydrated: boolean,
  list: AsyncResult.AsyncResult<unknown, unknown>
): ListLoad => {
  if (!hydrated) {
    return "loading";
  }

  if (AsyncResult.isSuccess(list)) {
    return "ready";
  }

  return AsyncResult.isFailure(list) && !list.waiting ? "failed" : "loading";
};
