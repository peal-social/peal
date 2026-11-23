# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module TranscriptionRejectedEncodedReason
      extend Peal::Internal::Types::Enum

      NOT_AUDIO = "notAudio"
      NOT_READY = "notReady"
      TOO_LARGE = "tooLarge"
    end
  end
end
