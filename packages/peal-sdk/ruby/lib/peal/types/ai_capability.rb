# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module AiCapability
      extend Peal::Internal::Types::Enum

      TEXT = "text"
      IMAGE = "image"
      VIDEO = "video"
      SPEECH = "speech"
      TRANSCRIPTION = "transcription"
      COMPOSITION = "composition"
    end
  end
end
