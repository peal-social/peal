# frozen_string_literal: true

module Peal
  module Automations
    module Feeds
      module Types
        class GetFeedsRequest < Internal::Types::Model
          field :feed_id, -> { String }, optional: false, nullable: false, api_name: "feedId"
        end
      end
    end
  end
end
