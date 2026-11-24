# frozen_string_literal: true

module Peal
  module Inbox
    module Reviews
      module Types
        class ListThreadsReviewsRequest < Internal::Types::Model
          field :channel_id, -> { String }, optional: true, nullable: false, api_name: "channelId"

          field :cursor, -> { String }, optional: true, nullable: false

          field :limit, -> { String }, optional: true, nullable: false

          field :unanswered, -> { Peal::Inbox::Reviews::Types::ListThreadsReviewsRequestUnanswered }, optional: true, nullable: false
        end
      end
    end
  end
end
