# frozen_string_literal: true

module Peal
  module Inbox
    module Messages
      module Types
        class SetChannelMessagesRequest < Internal::Types::Model
          field :channel_id, -> { String }, optional: false, nullable: false, api_name: "channelId"

          field :enabled, -> { Internal::Types::Boolean }, optional: false, nullable: false
        end
      end
    end
  end
end
