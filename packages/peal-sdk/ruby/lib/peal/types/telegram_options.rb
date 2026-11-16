# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    # How a post goes out on a Telegram channel or group, on every part of a thread. Scheduling needs none of them.
    class TelegramOptions < Internal::Types::Model
      field :link_preview, -> { Internal::Types::Boolean }, optional: true, nullable: false, api_name: "linkPreview"

      field :silent, -> { Internal::Types::Boolean }, optional: true, nullable: false
    end
  end
end
