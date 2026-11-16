import { describe, expect, it } from "@effect/vitest";
import {
  CommentRuleAbilitySchema as ContractAbilitySchema,
  CommentRuleEndReasonSchema as ContractEndReasonSchema,
  CommentRulePrivateAbilitySchema as ContractPrivateAbilitySchema,
  CommentRulePrivateStatusSchema as ContractPrivateStatusSchema,
  CommentRuleRefusalSchema as ContractRefusalSchema,
  maxChannelRepliesPerDay as contractPerChannelDay,
  maxCommentRulesPerWorkspace as contractRules,
  maxKeywordLength as contractKeywordLength,
  maxKeywords as contractKeywords,
  maxRuleRepliesPerDay as contractPerDay,
  commentRuleMatchesShown as contractShown,
} from "peal-contract";

import { CommentRuleNotPossible } from "#engagement/application/comment-rule-not-possible.ts";
import {
  CommentRuleAbilitySchema,
  CommentRulePrivateAbilitySchema,
  matchesShown,
} from "#engagement/application/comment-rules.ts";
import { CommentRuleEndReasonSchema } from "#engagement/domain/comment-rule-end-reason.ts";
import {
  maxChannelRepliesPerDay,
  maxCommentRulesPerWorkspace,
  maxKeywordLength,
  maxKeywords,
  maxRuleRepliesPerDay,
} from "#engagement/domain/comment-rule.ts";
import { PrivateReplyStatusTagSchema } from "#engagement/domain/private-reply.ts";

// The contract's copy of comment rules' limits and words, which clients
// read: equal to the server's.

describe("the comment rules' contract", () => {
  it("copies the server's limits and words", () => {
    expect({
      keywordLength: contractKeywordLength,
      keywords: contractKeywords,
      perChannelDay: contractPerChannelDay,
      perDay: contractPerDay,
      rules: contractRules,
      shown: contractShown,
    }).toStrictEqual({
      keywordLength: maxKeywordLength,
      keywords: maxKeywords,
      perChannelDay: maxChannelRepliesPerDay,
      perDay: maxRuleRepliesPerDay,
      rules: maxCommentRulesPerWorkspace,
      shown: matchesShown,
    });
    expect(ContractAbilitySchema.literals).toStrictEqual(
      CommentRuleAbilitySchema.literals
    );
    expect(ContractEndReasonSchema.literals).toStrictEqual(
      CommentRuleEndReasonSchema.literals
    );
  });

  it("copies the server's words for private replies", () => {
    expect(ContractPrivateAbilitySchema.literals).toStrictEqual(
      CommentRulePrivateAbilitySchema.literals
    );
    expect(ContractPrivateStatusSchema.literals).toStrictEqual(
      PrivateReplyStatusTagSchema.literals
    );
    expect(ContractRefusalSchema.literals).toStrictEqual(
      CommentRuleNotPossible.fields.reason.literals
    );
  });
});
