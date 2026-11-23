# frozen_string_literal: true

require_relative "../../peal"

module Peal
  module Types
    module AiImageProvider
      extend Peal::Internal::Types::Enum

      OPENAI = "openai"
      GOOGLE = "google"
      XAI = "xai"
      TOGETHERAI = "togetherai"
      OPENAI_COMPATIBLE = "openai-compatible"
      FAL = "fal"
    end
  end
end
