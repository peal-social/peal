# frozen_string_literal: true

module Peal
  module Inbox
    module Messages
      module Types
        class GetConversationMessagesRequest < Internal::Types::Model
          field :conversation_id, -> { String }, optional: false, nullable: false, api_name: "conversationId"

          field :cursor, -> { String }, optional: true, nullable: false

          field :limit, -> { String }, optional: true, nullable: false
        end
      end
    end
  end
end
