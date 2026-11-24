# frozen_string_literal: true

module Peal
  module Ads
    module Types
      class CreateBoostAdsRequest < Internal::Types::Model
        field :idempotency_key, -> { String }, optional: false, nullable: false, api_name: "idempotency-key"

        field :body, -> { Peal::Types::NewBoost }, optional: false, nullable: false
      end
    end
  end
end
