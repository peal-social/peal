# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module AudioAllowanceReachedEncodedCapability
      extend Peal::Internal::Types::Enum

      SPEECH = "speech"
      TRANSCRIPTION = "transcription"
    end
  end
end
