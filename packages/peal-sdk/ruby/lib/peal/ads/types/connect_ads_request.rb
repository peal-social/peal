# frozen_string_literal: true

module Peal
  module Ads
    module Types
      class ConnectAdsRequest < Internal::Types::Model
        field :network, -> { Peal::Types::AdNetwork }, optional: false, nullable: false
      end
    end
  end
end
