# frozen_string_literal: true

module Peal
  module Usage
    module Types
      class PartnerUsageRequest < Internal::Types::Model
        field :before, -> { String }, optional: true, nullable: false

        field :from, -> { String }, optional: true, nullable: false

        field :limit, -> { String }, optional: true, nullable: false

        field :to, -> { String }, optional: true, nullable: false
      end
    end
  end
end
