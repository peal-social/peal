# frozen_string_literal: true

module Peal
  module Inbox
    module Messages
      module Types
        class ConfirmPrivateReplyMessagesRequest < Internal::Types::Model
          field :private_reply_id, -> { String }, optional: false, nullable: false, api_name: "privateReplyId"

          field :went, -> { Internal::Types::Boolean }, optional: false, nullable: false
        end
      end
    end
  end
end
