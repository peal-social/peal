# frozen_string_literal: true

module Peal
  module Inbox
    module Comments
      module Types
        class ListThreadsCommentsRequest < Internal::Types::Model
          field :channel_id, -> { String }, optional: true, nullable: false, api_name: "channelId"

          field :cursor, -> { String }, optional: true, nullable: false

          field :limit, -> { String }, optional: true, nullable: false

          field :post_id, -> { String }, optional: true, nullable: false, api_name: "postId"

          field :unanswered, -> { Peal::Inbox::Comments::Types::ListThreadsCommentsRequestUnanswered }, optional: true, nullable: false
        end
      end
    end
  end
end
