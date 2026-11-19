import { describe, expect, it } from "@effect/vitest";

import { oneAfterAnother } from "#review/decision-queue.ts";

// A task that waits until it is let go, and notes when it started.
const held = <A>(value: A, started: string[], name: string) => {
  const gate = Promise.withResolvers<undefined>();

  return {
    letGo: () => {
      gate.resolve(undefined);
    },
    task: async () => {
      started.push(name);
      await gate.promise;

      return value;
    },
  };
};

describe(oneAfterAnother, () => {
  it("starts a task once the one before it settled, and answers each with its own result", async () => {
    const started: string[] = [];
    const inTurn = oneAfterAnother();
    const first = held("a", started, "first");
    const second = held("b", started, "second");

    const firstResult = inTurn(first.task);
    const secondResult = inTurn(second.task);

    await Promise.resolve();
    expect(started).toStrictEqual(["first"]);

    second.letGo();
    first.letGo();

    await expect(firstResult).resolves.toBe("a");
    await expect(secondResult).resolves.toBe("b");
    expect(started).toStrictEqual(["first", "second"]);
  });

  it("runs the next task after one that failed", async () => {
    const inTurn = oneAfterAnother();

    const failed = inTurn(async () => {
      await Promise.resolve();

      throw new Error("refused");
    });

    const next = inTurn(async () => {
      await Promise.resolve();

      return "next";
    });

    await expect(failed).rejects.toThrow("refused");
    await expect(next).resolves.toBe("next");
  });
});
