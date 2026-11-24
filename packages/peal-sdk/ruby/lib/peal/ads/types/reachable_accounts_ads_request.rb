# frozen_string_literal: true

module Peal
  module Ads
    module Types
      class ReachableAccountsAdsRequest < Internal::Types::Model
        field :connection_id, -> { String }, optional: false, nullable: false, api_name: "connectionId"
      end
    end
  end
end
