import { Effect } from "effect";
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

// A query refused (a 401 near a session's end, a 403, a 429): its answer
// comes once the registry's tasks run, `sync` when it comes at once.
const refused = (count: () => void, sync = false) =>
  Atom.make(
    Effect.sync(count).pipe(
      Effect.andThen(sync ? Effect.void : Effect.yieldNow),
      Effect.andThen(Effect.fail("refused"))
    )
  );

// What a registry of the library holds that the app's never reads, so the
// wrapper leaves it out: its own workings, not the registry's interface.
const workings = [
  "atomHasTtl",
  "constructor",
  "createNode",
  "defaultIdleTTL",
  "destroyNode",
  "dispatcher",
  "disposed",
  "invalidateAtom",
  "nodeTimeoutBucket",
  "nodes",
  "removeIdleNode",
  "removeNode",
  "removeNodeTimeout",
  "scheduleAtomRemoval",
  "setNodeTimeout",
  "sweepBucket",
  "timeoutBuckets",
  "timeoutResolution",
];

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

  it("reads a query again when its page opens again before the registry let it go", () => {
    const { builds, inner, query, runTasks } = setUp();
    const registry = renderRegistry(inner);

    registry.holdRenders();

    registry.get(query);

    const unsubscribe = registry.subscribe(query, () => {
      // The component's update.
    });

    runTasks();

    // The page closes, and opens again before the registry's task has
    // dropped the query: the new render reads the old node, then the task
    // runs before the commit, as on a page that was never held.
    unsubscribe();
    registry.get(query);
    runTasks();

    const unmount = registry.mount(query);

    expect(registry.get(query)).toBe(2);
    expect(builds()).toBe(2);

    unmount();
    registry.dispose();
  });

  it("lets a refusal go as soon as it comes, so the commit asks again", () => {
    const { inner, runTasks } = setUp();
    const registry = renderRegistry(inner);
    let asked = 0;

    const query = refused(() => {
      asked += 1;
    });

    registry.holdRenders();

    registry.get(query);
    // The answer comes, a refusal, then the registry drops the query.
    runTasks();
    runTasks();

    expect(vi.getTimerCount()).toBe(0);

    const unmount = registry.mount(query);

    expect(asked).toBe(2);

    unmount();
    registry.dispose();
  });

  it("holds no refusal that came with the read", () => {
    const { inner, runTasks } = setUp();
    const registry = renderRegistry(inner);
    let asked = 0;

    const query = refused(() => {
      asked += 1;
    }, true);

    registry.holdRenders();

    registry.get(query);

    expect(vi.getTimerCount()).toBe(0);

    runTasks();
    registry.get(query);

    expect(asked).toBe(2);

    registry.dispose();
  });

  it("holds again after Strict Mode's second effect, as the provider's effect runs twice", () => {
    const { builds, inner, query, runTasks } = setUp();
    const registry = renderRegistry(inner);

    registry.holdRenders()();
    registry.holdRenders();

    registry.get(query);
    runTasks();

    const unmount = registry.mount(query);

    expect(builds()).toBe(1);

    unmount();
    registry.dispose();
  });

  it("lets every hold go, its timer cleared, when the provider unmounts", () => {
    const { builds, inner, query, runTasks } = setUp();
    const registry = renderRegistry(inner);
    const stopHolding = registry.holdRenders();

    registry.get(query);
    stopHolding();

    expect(vi.getTimerCount()).toBe(0);

    runTasks();
    registry.get(query);

    expect(builds()).toBe(2);

    registry.dispose();
  });

  it("leaves alone what a commit subscribed before holding began", () => {
    // Children's effects run before their provider's: on the first commit,
    // the page subscribes before the registry holds anything.
    const { builds, inner, query, runTasks } = setUp();
    const registry = renderRegistry(inner);

    registry.get(query);

    const unmount = registry.mount(query);

    registry.holdRenders();
    runTasks();
    unmount();
    runTasks();

    expect(vi.getTimerCount()).toBe(0);
    expect(registry.get(query)).toBe(2);
    expect(builds()).toBe(2);

    registry.dispose();
  });

  it("passes on every member of the library's registry", () => {
    const { inner } = setUp();
    const registry = renderRegistry(inner);

    const members = [
      ...Object.keys(inner),
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(inner)),
    ];

    // A member a new version adds fails here until the wrapper passes it on
    // or it joins the workings above.
    expect(
      members.filter(
        (member) => !(member in registry) && !workings.includes(member)
      )
    ).toStrictEqual([]);
    expect(
      workings.filter((member) => !members.includes(member))
    ).toStrictEqual([]);

    registry.dispose();
  });

  it("is a registry the library recognizes", () => {
    const { inner } = setUp();
    const registry = renderRegistry(inner);

    expect(AtomRegistry.isAtomRegistry(registry)).toBeTruthy();

    registry.dispose();
  });
});
