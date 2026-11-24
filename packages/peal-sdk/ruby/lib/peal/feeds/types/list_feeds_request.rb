# frozen_string_literal: true

module Peal
  module Feeds
    module Types
      class ListFeedsRequest < Internal::Types::Model
        field :cursor, -> { String }, optional: true, nullable: false

        field :limit, -> { String }, optional: true, nullable: false
      end
    end
  end
end
