import { describe, expect, it } from "@effect/vitest";
import { Atom, AtomRegistry } from "effect/reactivity";

import { registryOptions } from "#api/registry.ts";

// React renders a page it navigates to before it commits it, and commits
// only once the page's payload is in: a query read during that render
// (its request sent) is mounted later. The registry removes an atom nobody
// mounted in a task of its own, which can run between the two.
const readThenMount = (
  options: Parameters<typeof AtomRegistry.make>[0]
): number => {
  const tasks: (() => void)[] = [];
  let builds = 0;

  const query = Atom.make(() => {
    builds += 1;

    return builds;
  });

  const registry = AtomRegistry.make({
    ...options,
    scheduleTask: (task) => {
      tasks.push(task);

      return () => {
        tasks.splice(tasks.indexOf(task), 1);
      };
    },
  });

  // The render reads the query.
  registry.get(query);

  // The registry's own tasks run before the commit.
  for (const task of tasks.splice(0)) {
    task();
  }

  // The commit mounts it.
  const unmount = registry.mount(query);

  unmount();
  registry.dispose();

  return builds;
};

describe("the app's atom registry", () => {
  it("asks a query read during a render once, when its commit comes after", () => {
    expect(readThenMount(registryOptions)).toBe(1);
  });

  it("would ask it twice without an idle time", () => {
    expect(readThenMount({})).toBe(2);
  });
});
