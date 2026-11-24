# frozen_string_literal: true

module Peal
  module Automations
    module Recycling
      module Types
        class ListRecyclingRequest < Internal::Types::Model
          field :cursor, -> { String }, optional: true, nullable: false

          field :limit, -> { String }, optional: true, nullable: false

          field :status, -> { Peal::Types::RecyclingStatus }, optional: true, nullable: false
        end
      end
    end
  end
end
