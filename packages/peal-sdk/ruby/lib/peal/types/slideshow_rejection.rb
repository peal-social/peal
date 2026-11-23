# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module SlideshowRejection
      extend Peal::Internal::Types::Enum

      IMAGE_NOT_FOUND = "imageNotFound"
      IMAGE_NOT_SUPPORTED = "imageNotSupported"
      VOICEOVER_NOT_FOUND = "voiceoverNotFound"
      TOO_LONG = "tooLong"
      VOICEOVER_TOO_LONG = "voiceoverTooLong"
      VOICEOVER_TOO_SHORT = "voiceoverTooShort"
    end
  end
end
