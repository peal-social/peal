# frozen_string_literal: true

module Peal
  module Assistant
    module Types
      class UnsetModelAssistantRequest < Internal::Types::Model
        field :capability, -> { Peal::Types::AiCapability }, optional: false, nullable: false
      end
    end
  end
end
