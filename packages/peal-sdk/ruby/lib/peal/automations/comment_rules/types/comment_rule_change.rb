# frozen_string_literal: true

module Peal
  module Automations
    module CommentRules
      module Types
        class CommentRuleChange < Internal::Types::Model
          field :rule_id, -> { String }, optional: false, nullable: false, api_name: "ruleId"

          field :keywords, -> { Internal::Types::Array[String] }, optional: true, nullable: false

          field :paused, -> { Internal::Types::Boolean }, optional: true, nullable: false

          field :private_reply, -> { String }, optional: true, nullable: true, api_name: "privateReply"

          field :reply, -> { String }, optional: true, nullable: false
        end
      end
    end
  end
end
