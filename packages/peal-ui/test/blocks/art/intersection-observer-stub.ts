/**
 * An IntersectionObserver for jsdom, which has none: it reports each target
 * it observes in view, or out of view, once, unless it stopped observing it.
 */
export const intersectionObserverStub = (inView: boolean) =>
  class implements IntersectionObserver {
    readonly root = null;

    readonly rootMargin = "0px";

    readonly scrollMargin = "0px";

    readonly thresholds = [0];

    readonly #report: IntersectionObserverCallback;

    readonly #targets = new Set<Element>();

    constructor(report: IntersectionObserverCallback) {
      this.#report = report;
    }

    observe(target: Element) {
      this.#targets.add(target);

      queueMicrotask(() => {
        if (!this.#targets.has(target)) {
          return;
        }

        const bounds = target.getBoundingClientRect();

        this.#report(
          [
            {
              boundingClientRect: bounds,
              intersectionRatio: inView ? 1 : 0,
              intersectionRect: bounds,
              isIntersecting: inView,
              rootBounds: null,
              target,
              time: 0,
            },
          ],
          this
        );
      });
    }

    unobserve(target: Element) {
      this.#targets.delete(target);
    }

    disconnect() {
      this.#targets.clear();
    }

    takeRecords() {
      return [...this.#targets].map((target) => {
        const bounds = target.getBoundingClientRect();

        return {
          boundingClientRect: bounds,
          intersectionRatio: inView ? 1 : 0,
          intersectionRect: bounds,
          isIntersecting: inView,
          rootBounds: null,
          target,
          time: 0,
        };
      });
    }
  };
