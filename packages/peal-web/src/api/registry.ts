import { constVoid } from "effect/Function";
import { AtomRegistry } from "effect/reactivity";
import type { Atom } from "effect/reactivity";

/**
 * How long a query a render read waits for the commit that would subscribe
 * to it, when that commit never comes (a navigation left before its page
 * showed). Navigations commit well within it.
 */
export const renderHoldMs = 10_000;

/** The app's atom registry, as React reads it. */
export interface RenderRegistry extends AtomRegistry.AtomRegistry {
  /**
   * Holds, from now on, what a render reads until a subscription comes;
   * the function returned stops it. Server rendering never holds: nothing
   * subscribes there.
   */
  readonly holdRenders: () => () => void;
}

interface Hold {
  readonly stop: () => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * The registry React reads, over `registry`: a query a render reads is held
 * until something subscribes to it, as the commit of that render does, or
 * for `holdMs` when nothing does.
 *
 * Next's router renders the page it opens, which reads its queries and sends
 * their requests, before it commits it, once its payload is in. The registry
 * drops a node that nothing subscribes to in a task of its own, which runs
 * in between: it cancelled the request, and the commit asked again (two or
 * three requests for one list). A hold covers that gap alone: once a reader
 * has subscribed, the query goes as its last reader goes, as before, so a
 * page opened again reads it afresh.
 */
export const renderRegistry = (
  registry: AtomRegistry.AtomRegistry,
  holdMs: number = renderHoldMs
): RenderRegistry => {
  const holds = new Map<AtomRegistry.Node<unknown>, Hold>();
  let holding = false;

  const release = (node: AtomRegistry.Node<unknown>) => {
    const hold = holds.get(node);

    if (hold === undefined) {
      return;
    }

    holds.delete(node);
    clearTimeout(hold.timer);
    hold.stop();

    // Nothing subscribed: the node goes, as the registry lets it.
    if (node.canBeRemoved) {
      registry.scheduleNodeRemoval(node);
    }
  };

  // A node nothing listens to yet: the render's own read, before its commit.
  const hold = (node: AtomRegistry.Node<unknown>) => {
    if (!holding || node.listeners.size > 0) {
      return;
    }

    holds.set(node, {
      stop: node.subscribe(constVoid),
      timer: setTimeout(() => {
        release(node);
      }, holdMs),
    });
  };

  const forgetHolds = () => {
    for (const { timer } of holds.values()) {
      clearTimeout(timer);
    }

    holds.clear();
  };

  return {
    [AtomRegistry.TypeId]: AtomRegistry.TypeId,
    dispose: () => {
      forgetHolds();
      registry.dispose();
    },
    ensureNode: <A>(atom: Atom.Atom<A>) => registry.ensureNode(atom),
    get: <A>(atom: Atom.Atom<A>): A => {
      const value = registry.get(atom);

      hold(registry.ensureNode(atom));

      return value;
    },
    getNodes: () => registry.getNodes(),
    holdRenders: () => {
      holding = true;

      return () => {
        holding = false;
      };
    },
    modify: <R, W, A>(
      atom: Atom.Writable<R, W>,
      f: (_: R) => [returnValue: A, nextValue: W]
    ): A => registry.modify(atom, f),
    mount: <A>(atom: Atom.Atom<A>) => {
      const unmount = registry.mount(atom);

      release(registry.ensureNode(atom));

      return unmount;
    },
    get onNodeAdded() {
      return registry.onNodeAdded;
    },
    set onNodeAdded(listener) {
      registry.onNodeAdded = listener;
    },
    get onNodeRemoved() {
      return registry.onNodeRemoved;
    },
    set onNodeRemoved(listener) {
      registry.onNodeRemoved = listener;
    },
    preloadedSerializable: registry.preloadedSerializable,
    refresh: <A>(atom: Atom.Atom<A>) => {
      registry.refresh(atom);
    },
    reset: () => {
      forgetHolds();
      registry.reset();
    },
    scheduleNodeRemoval: (node: AtomRegistry.Node<unknown>) => {
      registry.scheduleNodeRemoval(node);
    },
    scheduler: registry.scheduler,
    schedulerAsync: registry.schedulerAsync,
    set: <R, W>(atom: Atom.Writable<R, W>, value: W) => {
      registry.set(atom, value);
    },
    setSerializable: (key, encoded) => {
      registry.setSerializable(key, encoded);
    },
    subscribe: <A>(
      atom: Atom.Atom<A>,
      f: (_: A) => void,
      options?: { readonly immediate?: boolean }
    ) => {
      const unsubscribe = registry.subscribe(atom, f, options);

      release(registry.ensureNode(atom));

      return unsubscribe;
    },
    update: <R, W>(atom: Atom.Writable<R, W>, f: (_: R) => W) => {
      registry.update(atom, f);
    },
  };
};
