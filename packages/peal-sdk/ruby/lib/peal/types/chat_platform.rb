# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module ChatPlatform
      extend Peal::Internal::Types::Enum

      DISCORD = "discord"
      TELEGRAM = "telegram"
    end
  end
end
