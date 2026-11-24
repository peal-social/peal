# frozen_string_literal: true

module Peal
  module InboxMessages
    module Types
      class ConfirmMessageInboxMessagesRequest < Internal::Types::Model
        field :message_id, -> { String }, optional: false, nullable: false, api_name: "messageId"

        field :sent, -> { Internal::Types::Boolean }, optional: false, nullable: false
      end
    end
  end
end
