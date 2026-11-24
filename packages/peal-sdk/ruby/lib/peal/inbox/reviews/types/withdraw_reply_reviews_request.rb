# frozen_string_literal: true

module Peal
  module Inbox
    module Reviews
      module Types
        class WithdrawReplyReviewsRequest < Internal::Types::Model
          field :review_id, -> { String }, optional: false, nullable: false, api_name: "reviewId"
        end
      end
    end
  end
end
