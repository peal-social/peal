# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module AudioFailureReason
      extend Peal::Internal::Types::Enum

      SETTINGS_REFUSED = "settingsRefused"
      ADDRESS_REFUSED = "addressRefused"
      REDIRECTED = "redirected"
      UNREACHABLE = "unreachable"
      REFUSED = "refused"
      TIMED_OUT = "timedOut"
      UNUSABLE_ANSWER = "unusableAnswer"
    end
  end
end
