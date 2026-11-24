# frozen_string_literal: true

module Peal
  module Assistant
    module Types
      class DisconnectProviderAssistantRequest < Internal::Types::Model
        field :provider, -> { Peal::Types::AiProvider }, optional: false, nullable: false
      end
    end
  end
end
