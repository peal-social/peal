# frozen_string_literal: true

module Peal
  module Inbox
    module Types
      class GetAbilitiesInboxRequest < Internal::Types::Model
        field :channel_id, -> { String }, optional: false, nullable: false, api_name: "channelId"
      end
    end
  end
end
