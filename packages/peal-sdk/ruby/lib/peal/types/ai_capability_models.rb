# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class AiCapabilityModels < Internal::Types::Model
      field :models, -> { Internal::Types::Array[Peal::Types::AiCapabilityModel] }, optional: false, nullable: false
    end
  end
end
