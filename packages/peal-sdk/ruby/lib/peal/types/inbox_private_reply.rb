# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class InboxPrivateReply < Internal::Types::Model
      field :author_id, -> { String }, optional: false, nullable: true, api_name: "authorId"

      field :comment_id, -> { String }, optional: false, nullable: false, api_name: "commentId"

      field :created_at, -> { String }, optional: false, nullable: false, api_name: "createdAt"

      field :id, -> { String }, optional: false, nullable: false

      field :reason, -> { Peal::Types::InboxPrivateReplyReason }, optional: false, nullable: true

      field :rule_id, -> { String }, optional: false, nullable: true, api_name: "ruleId"

      field :settled_at, -> { String }, optional: false, nullable: true, api_name: "settledAt"

      field :status, -> { Peal::Types::InboxPrivateReplyStatus }, optional: false, nullable: false

      field :text, -> { String }, optional: false, nullable: false
    end
  end
end
