# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ConnectChat < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :platform

      member -> { Peal::Types::ConnectDiscordChat }, key: "discord"

      member -> { Peal::Types::ConnectTelegramChat }, key: "telegram"
    end
  end
end
