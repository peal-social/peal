# frozen_string_literal: true

module Peal
  module Inbox
    module Messages
      module Types
        class ConfirmMessagesRequest < Internal::Types::Model
          field :message_id, -> { String }, optional: false, nullable: false, api_name: "messageId"

          field :sent, -> { Internal::Types::Boolean }, optional: false, nullable: false
        end
      end
    end
  end
end
