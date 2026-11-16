# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module CommentRulePrivateAbility
      extend Peal::Internal::Types::Enum

      AVAILABLE = "available"
      NO_API = "noApi"
      UNSUPPORTED = "unsupported"
      MESSAGES_OFF = "messagesOff"
      RECONNECT = "reconnect"
      TEXT_TOO_LONG = "textTooLong"
    end
  end
end
