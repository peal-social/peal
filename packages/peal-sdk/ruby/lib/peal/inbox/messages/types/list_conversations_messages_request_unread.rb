# frozen_string_literal: true

require_relative "../../../../peal"

module Peal
  module Inbox
    module Messages
      module Types
        module ListConversationsMessagesRequestUnread
          extend Peal::Internal::Types::Enum

          TRUE = "true"
          FALSE = "false"
        end
      end
    end
  end
end
