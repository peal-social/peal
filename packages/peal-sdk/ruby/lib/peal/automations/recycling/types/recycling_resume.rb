# frozen_string_literal: true

module Peal
  module Automations
    module Recycling
      module Types
        class RecyclingResume < Internal::Types::Model
          field :rule_id, -> { String }, optional: false, nullable: false, api_name: "ruleId"

          field :variants, -> { Internal::Types::Array[Peal::Types::RecyclingVariant] }, optional: true, nullable: false
        end
      end
    end
  end
end
