# frozen_string_literal: true

module Peal
  module PartnerAccount
    module Types
      class NewPartnerKey < Internal::Types::Model
        field :expires_in_days, -> { Integer }, optional: true, nullable: false, api_name: "expiresInDays"

        field :name, -> { String }, optional: false, nullable: false

        field :permissions, -> { Internal::Types::Array[Peal::Types::Permission] }, optional: false, nullable: false

        field :scopes, -> { Internal::Types::Array[Peal::Types::PartnerScope] }, optional: false, nullable: false
      end
    end
  end
end
