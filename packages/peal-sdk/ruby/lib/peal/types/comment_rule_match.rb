# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class CommentRuleMatch < Internal::Types::Model
      field :code, -> { String }, optional: false, nullable: true

      field :comment_id, -> { String }, optional: false, nullable: false, api_name: "commentId"

      field :looked_at, -> { String }, optional: false, nullable: false, api_name: "lookedAt"

      field :outcome, -> { Peal::Types::CommentRuleOutcome }, optional: false, nullable: false

      field :private_code, -> { String }, optional: false, nullable: true, api_name: "privateCode"

      field :private_reply_id, -> { String }, optional: false, nullable: true, api_name: "privateReplyId"

      field :private_status, -> { Peal::Types::CommentRulePrivateStatus }, optional: false, nullable: true, api_name: "privateStatus"

      field :reply_id, -> { String }, optional: false, nullable: true, api_name: "replyId"
    end
  end
end
