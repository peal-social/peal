# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ConnectDiscordChat < Internal::Types::Model
      field :channel_id, -> { String }, optional: true, nullable: false, api_name: "channelId"

      field :webhook_url, -> { String }, optional: false, nullable: false, api_name: "webhookUrl"
    end
  end
end
