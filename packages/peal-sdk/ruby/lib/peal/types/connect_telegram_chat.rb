# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ConnectTelegramChat < Internal::Types::Model
      field :bot_token, -> { String }, optional: false, nullable: false, api_name: "botToken"

      field :chat, -> { String }, optional: false, nullable: false

      field :channel_id, -> { String }, optional: true, nullable: false, api_name: "channelId"
    end
  end
end
