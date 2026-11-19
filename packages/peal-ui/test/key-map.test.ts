import { describe, expect, it } from "vitest";

import {
  registrationsOf,
  sequenceWaitMs,
  waitingAt,
} from "../src/hooks/use-key-map";

describe(registrationsOf, () => {
  it("registers each first key of a sequence once, then every binding", () => {
    expect(registrationsOf(["g c", "g p", "c"])).toStrictEqual([
      { key: "g", kind: "prefix" },
      { binding: 0, key: "c", kind: "second", prefix: "g" },
      { binding: 1, key: "p", kind: "second", prefix: "g" },
      { binding: 2, key: "c", kind: "single" },
    ]);
  });

  it("refuses a key that both starts a sequence and runs alone", () => {
    expect(() => registrationsOf(["g c", "g"])).toThrow(/starts a sequence/u);
  });

  it("registers nothing for no binding", () => {
    expect(registrationsOf([])).toStrictEqual([]);
  });
});

describe(waitingAt, () => {
  const pending = { key: "g", since: 1000 };

  it("names the first key while its second may still come", () => {
    expect(waitingAt(pending, 1000 + sequenceWaitMs - 1)).toBe("g");
  });

  it("forgets it once the wait is over", () => {
    expect(waitingAt(pending, 1000 + sequenceWaitMs)).toBeNull();
  });

  it("names nothing when no key waits", () => {
    expect(waitingAt(null, 1000)).toBeNull();
  });
});
