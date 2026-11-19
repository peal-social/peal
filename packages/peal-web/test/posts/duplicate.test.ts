import { describe, expect, it } from "@effect/vitest";

import { duplicateFailureOf, mayDuplicate } from "#posts/duplicate.ts";

describe(mayDuplicate, () => {
  it("asks for both reading and creating posts", () => {
    expect(mayDuplicate(["post:read", "post:create"])).toBeTruthy();
    expect(mayDuplicate(["post:read"])).toBeFalsy();
    expect(mayDuplicate(["post:create"])).toBeFalsy();
  });
});

describe(duplicateFailureOf, () => {
  it("tells a refusal and a post that is gone from anything else", () => {
    expect(duplicateFailureOf("Forbidden")).toBe("forbidden");
    expect(duplicateFailureOf("PostNotFound")).toBe("notFound");
    expect(duplicateFailureOf("PostContentInvalid")).toBe("other");
    expect(duplicateFailureOf(undefined)).toBe("other");
  });
});
