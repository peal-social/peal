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
      EDIT_INVALID = "editInvalid"
      MEDIA_NOT_FOUND = "mediaNotFound"
      MEDIA_NOT_SUPPORTED = "mediaNotSupported"
      EDIT_TOO_LONG = "editTooLong"
      EDIT_TOO_LARGE = "editTooLarge"
      OUTPUT_NOT_SUPPORTED = "outputNotSupported"
    end
  end
end
