# frozen_string_literal: true

module Peal
  module Ads
    module Types
      class AdAccountsToConnect < Internal::Types::Model
        field :connection_id, -> { String }, optional: false, nullable: false, api_name: "connectionId"

        field :external_ids, -> { Internal::Types::Array[String] }, optional: false, nullable: false, api_name: "externalIds"
      end
    end
  end
end
