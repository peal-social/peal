# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module VideoUnavailableEncodedReason
      extend Peal::Internal::Types::Enum

      NOT_SET = "notSet"
      KEY_UNREADABLE = "keyUnreadable"
    end
  end
end
