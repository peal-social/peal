import { Atom, AtomRegistry } from "effect/reactivity";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderHoldMs, renderRegistry } from "#api/registry.ts";

// React renders a page the router opens before it commits it, and commits
// it once the page's payload is in: a query read during that render (its
// request sent) is subscribed to later. The registry drops a node nothing
// subscribes to in a task of its own, which can run in between. Each build
// of the query below is one request.
const setUp = () => {
  const tasks: (() => void)[] = [];
  let builds = 0;

  const query = Atom.make(() => {
    builds += 1;

    return builds;
  });

  const inner = AtomRegistry.make({
    scheduleTask: (task) => {
      tasks.push(task);

      return () => {
        tasks.splice(tasks.indexOf(task), 1);
      };
    },
  });

  // The registry's own tasks, as React's scheduler runs them when idle.
  const runTasks = () => {
    for (const task of tasks.splice(0)) {
      task();
    }
  };

  return { builds: () => builds, inner, query, runTasks };
};

describe("the app's atom registry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks a query a render read once, when its commit comes after the registry's tasks", () => {
    const { builds, inner, query, runTasks } = setUp();
    const registry = renderRegistry(inner);

    registry.holdRenders();

    // The render reads the query, the registry's tasks run, the commit
    // subscribes.
    expect(registry.get(query)).toBe(1);
    runTasks();

    const unsubscribe = registry.subscribe(query, () => {
      // The component's update.
    });

    expect(registry.get(query)).toBe(1);
    expect(builds()).toBe(1);

    unsubscribe();
    registry.dispose();
  });

  it("asked it again before, as the registry dropped it before the commit", () => {
    const { builds, inner, query, runTasks } = setUp();

    inner.get(query);
    runTasks();

    const unmount = inner.mount(query);

    expect(builds()).toBe(2);

    unmount();
    inner.dispose();
  });

  it("reads a query again once its last reader has gone, as a page opened again does", () => {
    const { builds, inner, query, runTasks } = setUp();
    const registry = renderRegistry(inner);

    registry.holdRenders();

    registry.get(query);

    const unmount = registry.mount(query);

    runTasks();

    // The page closes, then opens again.
    unmount();
    runTasks();

    expect(registry.get(query)).toBe(2);
    expect(builds()).toBe(2);

    registry.dispose();
  });

  it("lets a query go when the render that read it never commits", () => {
    const { builds, inner, query, runTasks } = setUp();
    const registry = renderRegistry(inner);

    registry.holdRenders();

    registry.get(query);
    runTasks();
    vi.advanceTimersByTime(renderHoldMs - 1);
    runTasks();

    // Still held: a commit now would read the first answer.
    expect(registry.get(query)).toBe(1);

    vi.advanceTimersByTime(1);
    runTasks();

    expect(registry.get(query)).toBe(2);
    expect(builds()).toBe(2);

    registry.dispose();
  });

  it("reads a held query again when it is refreshed, as its keys changing does", () => {
    const { builds, inner, query } = setUp();
    const registry = renderRegistry(inner);

    registry.holdRenders();

    registry.get(query);
    registry.refresh(query);

    // Held, it is read again at once, before any commit asks for it.
    expect(builds()).toBe(2);

    registry.dispose();
  });

  it("holds nothing while it does not hold renders, as on the server", () => {
    const { builds, inner, query, runTasks } = setUp();
    const registry = renderRegistry(inner);
    const stopHolding = registry.holdRenders();

    stopHolding();

    registry.get(query);
    runTasks();
    registry.get(query);

    expect(builds()).toBe(2);

    registry.dispose();
  });

  it("is a registry the library recognizes", () => {
    const { inner } = setUp();
    const registry = renderRegistry(inner);

    expect(AtomRegistry.isAtomRegistry(registry)).toBeTruthy();

    registry.dispose();
  });
});
