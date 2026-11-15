import { describe, expect, it } from "@effect/vitest";
import { DateTime, Option, Result } from "effect";

import { expiryOf } from "#publishing/application/follow-ups.ts";
import { FollowUpIdSchema } from "#publishing/domain/follow-up-id.ts";
import { FollowUpRuleIdSchema } from "#publishing/domain/follow-up-rule-id.ts";
import { startFollowUpRule } from "#publishing/domain/follow-up-rule.ts";
import {
  armFollowUp,
  settleFollowUp,
  triggerFollowUp,
} from "#publishing/domain/follow-up.ts";
import type { FollowUpCallOutcome } from "#publishing/domain/follow-up.ts";
import { PostTargetIdSchema } from "#publishing/domain/post-target-id.ts";
import {
  ChannelIdSchema,
  PostIdSchema,
  WorkspaceIdSchema,
} from "#shared/domain/ids.ts";
import { PlatformUnavailable } from "#shared/domain/platform-unavailable.ts";

// Why a follow-up's window passed, as members are told: the platform put
// it off, or Peal held it back as its rule could not act then.

const at = DateTime.makeUnsafe("2026-07-06T07:00:00Z");

const workspaceId = WorkspaceIdSchema.make(
  "0b1c5f7e-3d2a-4c1b-9e8f-7a6b5c4d3e2f"
);

const rule = startFollowUpRule(
  {
    comment: Option.some("Thank you all for reading!"),
    id: FollowUpRuleIdSchema.make("00000000-0000-7000-8000-00000000f001"),
    likes: 10,
    needsApproval: true,
    repost: false,
    scope: {
      _tag: "post",
      postId: PostIdSchema.make("00000000-0000-7000-8000-000000000201"),
    },
    startedBy: Option.none(),
    startedVia: { _tag: "web" },
    workspaceId,
  },
  at
);

const putOff = (outcome: FollowUpCallOutcome) =>
  Result.getOrThrow(
    settleFollowUp(
      Result.getOrThrow(
        triggerFollowUp(
          armFollowUp(
            {
              channelId: ChannelIdSchema.make(
                "00000000-0000-7000-8000-000000000101"
              ),
              id: FollowUpIdSchema.make("00000000-0000-7000-8000-000000000401"),
              kind: "comment",
              postId: PostIdSchema.make("00000000-0000-7000-8000-000000000201"),
              ruleId: rule.id,
              targetId: PostTargetIdSchema.make(
                "00000000-0000-7000-8000-000000000501"
              ),
              until: DateTime.add(at, { days: 7 }),
              workspaceId,
            },
            at
          ),
          12,
          at
        )
      ),
      outcome,
      at
    )
  );

describe(expiryOf, () => {
  it("says the platform put it off when it did", () => {
    expect(
      expiryOf(
        {
          followUp: putOff({
            _tag: "refused",
            failure: new PlatformUnavailable(),
          }),
          rule,
        },
        Option.some(12),
        true
      )
    ).toBe("windowEnded");
  });

  it("says what held it back when Peal did", () => {
    expect(
      expiryOf(
        { followUp: putOff({ _tag: "heldBack" }), rule },
        Option.some(12),
        true
      )
    ).toBe("notApproved");
  });
});
