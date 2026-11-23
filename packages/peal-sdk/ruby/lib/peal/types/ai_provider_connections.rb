# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class AiProviderConnections < Internal::Types::Model
      field :providers, -> { Internal::Types::Array[Peal::Types::AiProviderConnection] }, optional: false, nullable: false
    end
  end
end
