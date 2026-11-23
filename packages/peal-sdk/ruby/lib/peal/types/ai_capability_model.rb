# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class AiCapabilityModel < Internal::Types::Model
      field :capability, -> { Peal::Types::AiCapability }, optional: false, nullable: false

      field :model, -> { String }, optional: false, nullable: true

      field :provider, -> { Peal::Types::AiProvider }, optional: false, nullable: true

      field :server_model, -> { Internal::Types::Boolean }, optional: false, nullable: false, api_name: "serverModel"

      field :updated_at, -> { String }, optional: false, nullable: true, api_name: "updatedAt"
    end
  end
end
