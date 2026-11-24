# frozen_string_literal: true

module Peal
  module Inbox
    module Reviews
      module Types
        class SetAnsweredReviewsRequest < Internal::Types::Model
          field :review_id, -> { String }, optional: false, nullable: false, api_name: "reviewId"

          field :answered, -> { Internal::Types::Boolean }, optional: false, nullable: false
        end
      end
    end
  end
end
