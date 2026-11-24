# frozen_string_literal: true

module Peal
  module Inbox
    module Messages
      module Types
        class SetConversationReadMessagesRequest < Internal::Types::Model
          field :conversation_id, -> { String }, optional: false, nullable: false, api_name: "conversationId"

          field :read, -> { Internal::Types::Boolean }, optional: false, nullable: false
        end
      end
    end
  end
end
