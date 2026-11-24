# frozen_string_literal: true

module Peal
  module Assistant
    module Types
      class AiProviderTest < Internal::Types::Model
        field :provider, -> { Peal::Types::AiProvider }, optional: false, nullable: false

        field :model, -> { String }, optional: true, nullable: false
      end
    end
  end
end
