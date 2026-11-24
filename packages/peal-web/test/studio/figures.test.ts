import { describe, expect, it } from "@effect/vitest";
import { editSchema } from "@shotstack/schemas/zod";

import { emptyEdit, storedOf } from "#studio/edit-document.ts";
import { figureClipOf } from "#studio/figures.ts";
import type { FigureKind } from "#studio/figures.ts";

const kinds: readonly FigureKind[] = ["circle", "rectangle"];

describe("the editor's shapes", () => {
  it("are clips Shotstack's schema takes, stored as they are", () => {
    expect(
      kinds.map((kind) => {
        const edit = emptyEdit([figureClipOf(kind, 1)]);
        const stored = storedOf(edit, () => null, "https://app.example.com");

        return [
          editSchema.safeParse(structuredClone(stored)).success,
          JSON.stringify(stored) === JSON.stringify(edit),
        ];
      })
    ).toStrictEqual([
      [true, true],
      [true, true],
    ]);
  });
});
