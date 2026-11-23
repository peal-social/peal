# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module SlideshowFailureReason
      extend Peal::Internal::Types::Enum

      UNAVAILABLE = "unavailable"
      KEY_UNREADABLE = "keyUnreadable"
      SETTINGS_REFUSED = "settingsRefused"
      ADDRESS_REFUSED = "addressRefused"
      REDIRECTED = "redirected"
      UNREACHABLE = "unreachable"
      REFUSED = "refused"
      TIMED_OUT = "timedOut"
      UNUSABLE_ANSWER = "unusableAnswer"
      MEDIA_UNAVAILABLE = "mediaUnavailable"
      STORAGE_FULL = "storageFull"
      NOT_STORED = "notStored"
      INTERRUPTED = "interrupted"
    end
  end
end
