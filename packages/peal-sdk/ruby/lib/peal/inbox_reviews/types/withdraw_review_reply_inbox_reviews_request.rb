# frozen_string_literal: true

module Peal
  module InboxReviews
    module Types
      class WithdrawReviewReplyInboxReviewsRequest < Internal::Types::Model
        field :review_id, -> { String }, optional: false, nullable: false, api_name: "reviewId"
      end
    end
  end
end
