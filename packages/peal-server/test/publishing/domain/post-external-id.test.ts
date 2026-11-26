import { describe, expect, it } from "@effect/vitest";
import { DateTime, Option, Result, Schema } from "effect";

import { emptyContent } from "#publishing/domain/post-content.ts";
import {
  maxPostExternalIdLength,
  PostExternalIdSchema,
} from "#publishing/domain/post-external-id.ts";
import { readImport } from "#publishing/domain/post-import.ts";
import {
  awaitApproval,
  cancelPost,
  editDraft,
  finishPost,
  moveToDraft,
  Post,
  releasePost,
  schedulePost,
  startPublishing,
  tagPost,
  withExternalId,
  withLinksShortened,
} from "#publishing/domain/post.ts";
import {
  createdAtOf,
  PostIdSchema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import { Schedule } from "#shared/domain/schedule.ts";
import { TimeZoneIdSchema } from "#shared/domain/time-zone.ts";

// A post's own id, its caller's: no transition of the post loses it, and
// only `withExternalId` changes it.

const utc = (iso: string): DateTime.Utc => DateTime.makeUnsafe(iso);

const now = utc("2026-06-15T07:00:00Z");

const inAnHour = new Schedule({
  at: utc("2026-06-15T08:00:00Z"),
  timeZone: TimeZoneIdSchema.make("Europe/Paris"),
});

const own = PostExternalIdSchema.make("record-42");

const draft = withExternalId(
  new Post({
    authorId: Option.none(),
    content: emptyContent,
    id: PostIdSchema.make("00000000-0000-7000-8000-000000000001"),
    scheduleRevision: 0,
    status: { _tag: "draft" },
    workspaceId: WorkspaceIdSchema.make("00000000-0000-7000-8000-000000000002"),
  }),
  Option.some(own)
);

const ok = (result: Result.Result<Post, unknown>): Post =>
  Result.getOrThrow(result);

describe("a post's external id", () => {
  it("is kept by every transition of the post", () => {
    const scheduled = ok(schedulePost(draft, inAnHour, now));
    const held = ok(awaitApproval(scheduled));
    const released = ok(releasePost(held, now));
    const publishing = ok(startPublishing(released, inAnHour.at));

    const all = [
      ok(editDraft(draft, emptyContent)),
      scheduled,
      held,
      released,
      ok(moveToDraft(scheduled)),
      publishing,
      ok(finishPost(publishing, [], utc("2026-06-15T08:00:05Z"))),
      ok(cancelPost(draft, now)),
      tagPost(draft, []),
      withLinksShortened(draft, true),
    ];

    for (const post of all) {
      expect(post.externalId).toStrictEqual(Option.some(own));
    }

    expect(withExternalId(draft, Option.none()).externalId).toStrictEqual(
      Option.none()
    );
  });

  it("is 1 to 255 characters, without NUL or a lone surrogate", () => {
    const decode = Schema.decodeUnknownOption(PostExternalIdSchema);

    expect(Option.isSome(decode("a".repeat(maxPostExternalIdLength)))).toBe(
      true
    );

    for (const refused of [
      "",
      "a".repeat(maxPostExternalIdLength + 1),
      `record${String.fromCodePoint(0)}`,
      "half \uD83D",
    ]) {
      expect(Option.isNone(decode(refused))).toBe(true);
    }
  });

  it("is read from an import's external_id column, an empty cell giving none", () => {
    const read = readImport(
      [
        "text,channels,at,external_id",
        "One,c1,now,record-1",
        "Two,c1,now,",
        `Three,c1,now,${"a".repeat(maxPostExternalIdLength + 1)}`,
      ].join("\n")
    );

    const rows = Result.getOrThrow(read);

    expect(
      rows.map(({ post }) =>
        Result.match(post, {
          onFailure: (problems) => problems.map(({ column }) => column),
          onSuccess: ({ externalId }) => Option.getOrNull(externalId),
        })
      )
    ).toStrictEqual(["record-1", null, ["external_id"]]);
  });
});

describe(createdAtOf, () => {
  it("reads when an id was issued from its first 48 bits", () => {
    expect(
      DateTime.formatIso(
        createdAtOf(PostIdSchema.make("019eca14-7980-7593-8b99-cca1dfe8ccb9"))
      )
    ).toBe("2026-06-15T07:00:00.000Z");
    expect(
      DateTime.formatIso(
        createdAtOf(PostIdSchema.make("00000000-0000-7000-8000-000000000001"))
      )
    ).toBe("1970-01-01T00:00:00.000Z");
  });
});
