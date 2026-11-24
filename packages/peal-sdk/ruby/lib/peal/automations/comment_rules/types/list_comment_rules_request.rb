# frozen_string_literal: true

module Peal
  module Automations
    module CommentRules
      module Types
        class ListCommentRulesRequest < Internal::Types::Model
          field :cursor, -> { String }, optional: true, nullable: false

          field :limit, -> { String }, optional: true, nullable: false

          field :status, -> { Peal::Types::CommentRuleStatus }, optional: true, nullable: false
        end
      end
    end
  end
end
