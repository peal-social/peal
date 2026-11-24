# frozen_string_literal: true

module Peal
  module Assistant
    module Types
      class AiCapabilityModelChange < Internal::Types::Model
        field :capability, -> { Peal::Types::AiCapability }, optional: false, nullable: false

        field :model, -> { String }, optional: true, nullable: false

        field :provider, -> { Peal::Types::AiProvider }, optional: false, nullable: false
      end
    end
  end
end
