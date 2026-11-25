import { describe, expect, it } from "@effect/vitest";
import { DateTime, Duration, Result, Schema } from "effect";
import {
  FollowUpAbilitySchema,
  FollowUpEndReasonSchema as ContractEndReasonSchema,
  FollowUpKindSchema as ContractKindSchema,
  FollowUpStatusSchema as ContractStatusSchema,
  followUpWindowDays,
  followUpsShown as contractShown,
  maxFollowUpCommentLength as contractCommentLength,
  maxFollowUpRulesPerWorkspace as contractRules,
  maxFollowUpsPerChannelDay as contractPerDay,
  maxLikesThreshold as contractMaxLikes,
  minLikesThreshold as contractMinLikes,
  PlatformFollowUpCommentSchema as ContractPlatformCommentSchema,
  PlatformFollowUpRepostSchema as ContractPlatformRepostSchema,
} from "peal-contract";

import { followUpView } from "#publishing/api/follow-ups/follow-up-view.ts";
import {
  followUpsShown,
  maxFollowUpCommentLength,
} from "#publishing/application/follow-ups/follow-up-rules.ts";
import { FollowUpAbilitySchema as AbilitySchema } from "#publishing/domain/follow-ups/follow-up-ability.ts";
import { FollowUpEndReasonSchema } from "#publishing/domain/follow-ups/follow-up-end-reason.ts";
import { FollowUpIdSchema } from "#publishing/domain/follow-ups/follow-up-id.ts";
import { FollowUpRuleIdSchema } from "#publishing/domain/follow-ups/follow-up-rule-id.ts";
import {
  followUpWindow,
  maxFollowUpRulesPerWorkspace,
  maxFollowUpsPerChannelDay,
  maxLikesThreshold,
  minLikesThreshold,
} from "#publishing/domain/follow-ups/follow-up-rule.ts";
import {
  FollowUpBlockerSchema,
  followUpSupport,
} from "#publishing/domain/follow-ups/follow-up-support.ts";
import {
  FollowUpKindSchema,
  FollowUpStatusSchema,
  armFollowUp,
  settleFollowUp,
  triggerFollowUp,
  waitFollowUp,
} from "#publishing/domain/follow-ups/follow-up.ts";
import {
  PlatformFollowUpCommentSchema,
  PlatformFollowUpRepostSchema,
} from "#publishing/domain/follow-ups/platform-follow-ups.ts";
import {
  ChannelIdSchema,
  PostIdSchema,
  PostTargetIdSchema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";

// The contract's copy of follow-up rules' limits and words, which clients
// read: equal to the server's.

describe("the follow-ups' contract", () => {
  it("copies the server's limits", () => {
    expect({
      commentLength: contractCommentLength,
      maxLikes: contractMaxLikes,
      minLikes: contractMinLikes,
      perDay: contractPerDay,
      rules: contractRules,
      shown: contractShown,
    }).toStrictEqual({
      commentLength: maxFollowUpCommentLength,
      maxLikes: maxLikesThreshold,
      minLikes: minLikesThreshold,
      perDay: maxFollowUpsPerChannelDay,
      rules: maxFollowUpRulesPerWorkspace,
      shown: followUpsShown,
    });
    expect(Duration.days(followUpWindowDays)).toStrictEqual(followUpWindow);
  });

  it("names what the server stores and answers", () => {
    expect(ContractKindSchema.literals).toStrictEqual(
      FollowUpKindSchema.literals
    );
    expect(ContractEndReasonSchema.literals).toStrictEqual(
      FollowUpEndReasonSchema.literals
    );
    expect(ContractStatusSchema.literals).toStrictEqual(
      FollowUpStatusSchema.members.map(
        ({ fields }) => fields._tag.schema.literal
      )
    );
    // Every ability the contract names is one the server answers, and the
    // server answers no other.
    const isAbility = Schema.is(AbilitySchema);

    expect(FollowUpAbilitySchema.literals.every(isAbility)).toBeTruthy();
    expect(
      [
        ...FollowUpBlockerSchema.literals,
        "available",
        "notAsked",
        "turnedOff",
        "reconnect",
        "notCounted",
        "textTooLong",
      ].toSorted()
    ).toStrictEqual([...FollowUpAbilitySchema.literals].toSorted());
  });

  it("copies the server's words for where rules act, and no channel's", () => {
    expect([
      ContractPlatformCommentSchema.literals,
      ContractPlatformRepostSchema.literals,
    ]).toStrictEqual([
      PlatformFollowUpCommentSchema.literals,
      PlatformFollowUpRepostSchema.literals,
    ]);

    // A platform's answer names no channel's standing.
    const channelOnly = new Set<string>([
      "notAsked",
      "reconnect",
      "textTooLong",
    ]);

    expect(
      [
        ...PlatformFollowUpCommentSchema.literals,
        ...PlatformFollowUpRepostSchema.literals,
      ].filter((word) => channelOnly.has(word))
    ).toStrictEqual([]);

    // A repost answers only what some platform's support may say, and the
    // server's own reason, so no SDK offers a word it never gets.
    const reposts = new Set<string>(
      Object.values(followUpSupport).map(({ repost }) => repost)
    );

    expect(
      PlatformFollowUpRepostSchema.literals.filter(
        (word) => word !== "notCounted" && !reposts.has(word)
      )
    ).toStrictEqual([]);
  });

  it("says until when a follow-up waits for its channel", () => {
    const waiting = waitFollowUp(
      {
        channelId: ChannelIdSchema.make("00000000-0000-7000-8000-000000000101"),
        id: FollowUpIdSchema.make("00000000-0000-7000-8000-000000000401"),
        kind: "repost",
        postId: PostIdSchema.make("00000000-0000-7000-8000-000000000201"),
        ruleId: FollowUpRuleIdSchema.make(
          "00000000-0000-7000-8000-000000000301"
        ),
        targetId: PostTargetIdSchema.make(
          "00000000-0000-7000-8000-000000000501"
        ),
        until: DateTime.makeUnsafe("2026-07-13T07:00:00Z"),
        workspaceId: WorkspaceIdSchema.make(
          "00000000-0000-7000-8000-000000000601"
        ),
      },
      DateTime.makeUnsafe("2026-07-06T07:00:00Z")
    );

    const shown = followUpView(waiting);

    expect(shown.status).toBe("waiting");
    expect(shown.until).toStrictEqual(
      DateTime.makeUnsafe("2026-07-13T07:00:00Z")
    );
  });

  it("says when a follow-up the platform put off is tried next", () => {
    const at = DateTime.makeUnsafe("2026-07-06T07:00:00Z");

    const armed = armFollowUp(
      {
        channelId: ChannelIdSchema.make("00000000-0000-7000-8000-000000000101"),
        id: FollowUpIdSchema.make("00000000-0000-7000-8000-000000000402"),
        kind: "comment",
        postId: PostIdSchema.make("00000000-0000-7000-8000-000000000201"),
        ruleId: FollowUpRuleIdSchema.make(
          "00000000-0000-7000-8000-000000000301"
        ),
        targetId: PostTargetIdSchema.make(
          "00000000-0000-7000-8000-000000000501"
        ),
        until: DateTime.makeUnsafe("2026-07-13T07:00:00Z"),
        workspaceId: WorkspaceIdSchema.make(
          "00000000-0000-7000-8000-000000000601"
        ),
      },
      at
    );

    expect(followUpView(armed).notBefore).toBeNull();

    const putOff = settleFollowUp(
      Result.getOrThrow(triggerFollowUp(armed, 12, at)),
      { _tag: "refused", failure: new PlatformUnavailable() },
      at
    );

    const shown = followUpView(Result.getOrThrow(putOff));

    expect(shown.status).toBe("armed");
    expect(shown.notBefore).toStrictEqual(
      DateTime.makeUnsafe("2026-07-06T07:10:00Z")
    );
  });
});
