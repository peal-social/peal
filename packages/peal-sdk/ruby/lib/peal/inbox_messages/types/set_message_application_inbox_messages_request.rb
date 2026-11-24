# frozen_string_literal: true

module Peal
  module InboxMessages
    module Types
      class SetMessageApplicationInboxMessagesRequest < Internal::Types::Model
        field :allowed, -> { Internal::Types::Boolean }, optional: false, nullable: false

        field :client_id, -> { String }, optional: false, nullable: false, api_name: "clientId"
      end
    end
  end
end
