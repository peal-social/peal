# frozen_string_literal: true

module Peal
  module Ads
    module Types
      class AuditTrailAdsRequest < Internal::Types::Model
        field :cursor, -> { String }, optional: true, nullable: false
      end
    end
  end
end
