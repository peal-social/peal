# frozen_string_literal: true

module Peal
  module Inbox
    module Messages
      module Types
        class ListConversationsMessagesRequest < Internal::Types::Model
          field :channel_id, -> { String }, optional: true, nullable: false, api_name: "channelId"

          field :cursor, -> { String }, optional: true, nullable: false

          field :limit, -> { String }, optional: true, nullable: false

          field :unread, -> { Peal::Inbox::Messages::Types::ListConversationsMessagesRequestUnread }, optional: true, nullable: false
        end
      end
    end
  end
end
