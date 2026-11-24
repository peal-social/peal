# frozen_string_literal: true

module Peal
  module Channels
    module Types
      class ChannelUpdate < Internal::Types::Model
        field :channel_id, -> { String }, optional: false, nullable: false, api_name: "channelId"

        field :label, -> { String }, optional: false, nullable: true
      end
    end
  end
end
