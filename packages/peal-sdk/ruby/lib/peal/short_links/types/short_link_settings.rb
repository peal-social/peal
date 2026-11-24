# frozen_string_literal: true

module Peal
  module ShortLinks
    module Types
      class ShortLinkSettings < Internal::Types::Model
        field :by_default, -> { Internal::Types::Boolean }, optional: false, nullable: false, api_name: "byDefault"
      end
    end
  end
end
