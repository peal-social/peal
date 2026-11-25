import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";

import {
  fittedName,
  holdsLinkMarker,
  maxPersonNameLength,
  typedName,
} from "#shared/domain/display-name.ts";

describe(typedName, () => {
  it("keeps a name on one line, without control characters", () => {
    expect(
      typedName("  Jane\n\tDoe\u0000 ", maxPersonNameLength)
    ).toStrictEqual(Result.succeed("Jane Doe"));
  });

  it("takes names that look like hosts, which emails leave out instead", () => {
    for (const name of ["Node.js", "Next.js Paris", "Booking.com", "J.LO"]) {
      expect(typedName(name, maxPersonNameLength)).toStrictEqual(
        Result.succeed(name)
      );
    }
  });

  it("refuses what is empty, too long, or holds a link's markers", () => {
    expect(
      typedName(` ${String.fromCodePoint(0x20_2e)} `, maxPersonNameLength)
    ).toStrictEqual(Result.fail("empty"));
    expect(
      typedName("a".repeat(maxPersonNameLength + 1), maxPersonNameLength)
    ).toStrictEqual(Result.fail("tooLong"));
    expect(
      typedName("a".repeat(maxPersonNameLength), maxPersonNameLength)
    ).toStrictEqual(Result.succeed("a".repeat(maxPersonNameLength)));

    for (const name of ["Prize at https://evil.example", "see www.evil"]) {
      expect(typedName(name, maxPersonNameLength)).toStrictEqual(
        Result.fail("link")
      );
    }
  });
});

describe(fittedName, () => {
  it("takes a link's markers out of a name it is given, rather than refusing it", () => {
    expect(fittedName("Prize at https://evil.com/x", 100)).toBe(
      "Prize at https evil.com/x"
    );
    expect(holdsLinkMarker(fittedName("go to www.evil.com", 100))).toBeFalsy();
    expect(fittedName("Jane Doe", 100)).toBe("Jane Doe");
    expect(fittedName("Jane\nDoe", 4)).toBe("Jane");
  });
});
