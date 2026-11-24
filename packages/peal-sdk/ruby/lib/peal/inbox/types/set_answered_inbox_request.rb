# frozen_string_literal: true

module Peal
  module Inbox
    module Types
      class SetAnsweredInboxRequest < Internal::Types::Model
        field :comment_id, -> { String }, optional: false, nullable: false, api_name: "commentId"

        field :answered, -> { Internal::Types::Boolean }, optional: false, nullable: false
      end
    end
  end
end
