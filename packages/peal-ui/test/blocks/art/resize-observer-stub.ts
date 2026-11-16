/** A ResizeObserver for jsdom, which has none and lays nothing out. */
export class ResizeObserverStub implements ResizeObserver {
  readonly #targets = new Set<Element>();

  observe(target: Element) {
    this.#targets.add(target);
  }

  unobserve(target: Element) {
    this.#targets.delete(target);
  }

  disconnect() {
    this.#targets.clear();
  }
}
