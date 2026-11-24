# frozen_string_literal: true

module Peal
  module Automations
    module FollowUps
      module Types
        class DeleteFollowUpsRequest < Internal::Types::Model
          field :rule_id, -> { String }, optional: false, nullable: false, api_name: "ruleId"
        end
      end
    end
  end
end
