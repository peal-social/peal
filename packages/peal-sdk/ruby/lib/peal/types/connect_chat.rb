# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    class ConnectChat < Internal::Types::Model
      extend Peal::Internal::Types::Union

      discriminant :platform

      member -> { Peal::Types::ConnectDiscordChat }, key: "DISCORD"

      member -> { Peal::Types::ConnectTelegramChat }, key: "TELEGRAM"
    end
  end
end
