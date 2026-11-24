# frozen_string_literal: true

module Peal
  module Usage
    module Types
      class GetUsageRequest < Internal::Types::Model
        field :from, -> { String }, optional: true, nullable: false

        field :to, -> { String }, optional: true, nullable: false
      end
    end
  end
end
