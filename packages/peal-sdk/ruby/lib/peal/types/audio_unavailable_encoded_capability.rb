# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module AudioUnavailableEncodedCapability
      extend Peal::Internal::Types::Enum

      SPEECH = "speech"
      TRANSCRIPTION = "transcription"
    end
  end
end
