import { describe, expect, it } from "@effect/vitest";
import { DateTime, Duration, Option } from "effect";

import { takenIdsOf } from "#engagement/infrastructure/platforms/platform-messages.ts";
import { directMessage, outgoingMessageId } from "#test/engagement/support.ts";

// What a resumed message may not take for its own: the account's messages
// sent before it was written (less a minute of clocks apart), and those
// another message of Peal's went out as. One of the account's sent since,
// that nothing of Peal's claims, may be this one, read back from its echo.

const writtenAt = DateTime.makeUnsafe("2026-11-16T10:00:00.000Z");

const own = (n: number, sentAt: DateTime.Utc) =>
  directMessage(n, { fromAccount: true, sentAt });

describe("the ids a resumed message may not take", () => {
  it("leave out the account's messages sent since it was written that nothing claims", () => {
    const before = own(1, DateTime.subtractDuration(writtenAt, "2 minutes"));
    const echo = own(2, DateTime.addDuration(writtenAt, "5 seconds"));
    const claimed = own(3, DateTime.addDuration(writtenAt, "6 seconds"));

    expect(
      takenIdsOf(
        [before, echo, claimed],
        [
          {
            id: outgoingMessageId(2),
            platformMessageId: Option.some(claimed.platformMessageId),
          },
        ],
        { createdAt: writtenAt, id: outgoingMessageId(1) },
        Duration.minutes(1)
      ).toSorted()
    ).toStrictEqual(
      [before.platformMessageId, claimed.platformMessageId].toSorted()
    );
  });
});
