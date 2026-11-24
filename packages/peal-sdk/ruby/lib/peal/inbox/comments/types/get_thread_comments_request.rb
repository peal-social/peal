# frozen_string_literal: true

module Peal
  module Inbox
    module Comments
      module Types
        class GetThreadCommentsRequest < Internal::Types::Model
          field :thread_id, -> { String }, optional: false, nullable: false, api_name: "threadId"
        end
      end
    end
  end
end
