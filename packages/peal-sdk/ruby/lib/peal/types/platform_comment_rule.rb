# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class PlatformCommentRule < Internal::Types::Model
      field :platform, -> { Peal::Types::Platform }, optional: false, nullable: false

      field :private_reply, -> { Peal::Types::CommentRulePrivateAbility }, optional: false, nullable: false, api_name: "privateReply"

      field :reply, -> { Peal::Types::CommentRuleAbility }, optional: false, nullable: false
    end
  end
end
